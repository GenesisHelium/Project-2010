// Crawls the served site and writes the dead links to tools/_dead.json so the
// grouping pass can work on the full list without re-crawling.
import { writeFile } from 'node:fs/promises';

const BASE = process.env.BASE || 'http://localhost:2010';
const LIMIT = Number(process.env.LIMIT || 6000);

const seen = new Set();
const dead = new Map();
const queue = ['/'];
let checked = 0;

const decode = (s) => s.replace(/&amp;/g, '&');

while (queue.length && checked < LIMIT) {
  const path = queue.shift();
  if (seen.has(path)) continue;
  seen.add(path);

  let res;
  try {
    res = await fetch(BASE + path, { redirect: 'manual', headers: { 'user-agent': 'linkcheck' } });
  } catch (err) {
    dead.set(path, `network: ${err.message}`);
    continue;
  }

  checked++;
  if (res.status === 301 || res.status === 302 || res.status === 303) {
    const loc = res.headers.get('location');
    if (loc && !seen.has(loc)) queue.push(loc);
    continue;
  }
  if (res.status === 404) { dead.set(path, '404'); continue; }
  if (res.status !== 200) continue;

  const type = res.headers.get('content-type') || '';
  if (!type.startsWith('text/html')) continue;

  const body = await res.text();
  for (const m of body.matchAll(/href="([^"#]+)"/g)) {
    const href = decode(m[1].trim());
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('data:')) continue;
    if (/^https?:/i.test(href) || href.startsWith('//')) continue;
    let url;
    try { url = new URL(href, BASE + path); } catch { continue; }
    if (url.origin !== BASE) continue;
    const next = url.pathname + url.search;
    if (!seen.has(next)) queue.push(next);
  }
}

await writeFile(new URL('./_dead.json', import.meta.url), JSON.stringify([...dead.keys()], null, 1));
console.log(`checked ${checked}, dead ${dead.size}`);
