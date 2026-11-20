// Same crawl as check-server, but keeps every dead URL and prints a breakdown by
// path shape so the report can be read without scrolling past a thousand items.
import { writeFile } from 'node:fs/promises';

const BASE = process.env.BASE || 'http://localhost:2010';
const LIMIT = Number(process.env.LIMIT || 8000);

const seen = new Set();
const dead = new Map();
const queue = ['/'];
let checked = 0;

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
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    if (loc && !seen.has(loc)) queue.push(loc);
    continue;
  }
  if (res.status === 404) { dead.set(path, '404'); continue; }
  if (res.status !== 200) continue;
  if (!(res.headers.get('content-type') || '').startsWith('text/html')) continue;

  const body = await res.text();
  for (const m of body.matchAll(/href="([^"#]+)"/g)) {
    const href = m[1].replace(/&amp;/g, '&').trim();
    if (!href || /^(javascript:|mailto:|data:)/i.test(href)) continue;
    if (/^https?:/i.test(href) || href.startsWith('//')) continue;
    let url;
    try { url = new URL(href, BASE + path); } catch { continue; }
    if (url.origin !== BASE) continue;
    const next = url.pathname + url.search;
    if (!seen.has(next)) queue.push(next);
  }
}

const rows = [...dead.keys()];
await writeFile('tools/_dead.json', JSON.stringify(rows, null, 1));

const buckets = new Map();
const bucketOf = (p) => {
  if (/-(item|place)(\/|\?|$)/i.test(p)) return 'item / place';
  if (/badge/i.test(p)) return 'badge';
  if (/^\/Forum\//i.test(p)) return 'forum';
  if (/^\/p\//i.test(p)) return 'p/ page';
  if (/^\/User\.aspx/i.test(p)) return 'user';
  if (/\.css(\?|$)/i.test(p)) return 'stylesheet';
  if (/\.(png|gif|jpg|jpeg|ico)(\?|$)/i.test(p)) return 'image';
  if (/\.(js|axd)(\?|$)/i.test(p)) return 'script';
  return 'other';
};
for (const p of rows) {
  const k = bucketOf(p);
  buckets.set(k, (buckets.get(k) || 0) + 1);
}

console.log(`checked ${checked}, dead ${rows.length}`);
for (const [k, n] of [...buckets.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${k}`);
}

const other = rows.filter((p) => bucketOf(p) === 'other');
console.log(`\nother (${other.length}):`);
for (const p of other.slice(0, 80)) console.log(`  ${p}`);
