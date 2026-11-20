// Walks the served site the way a browser would: starts at the home page, follows
// every internal href, and reports what answers 404.
//
// This is the honest measure. Static analysis of the tree cannot see the server's
// legacy-URL aliases, so it reports dead links for paths that resolve fine at
// request time.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.BASE || 'http://localhost:2010';
const LIMIT = Number(process.env.LIMIT || 4000);

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
  if (res.status === 404) {
    dead.set(path, '404');
    continue;
  }
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

const rows = [...dead.entries()].sort();
console.log(`checked ${checked} urls, ${seen.size} queued, ${queue.length} left`);
console.log(`dead: ${rows.length}`);

// Group the dead links by the shape of their path, so a run tells at a glance
// whether anything navigational broke or whether the whole list is the
// uncaptured item/badge catalogue.
const groups = new Map();
for (const [path] of rows) {
  let key = 'other';
  if (/-(item|place)(\/|\?|$)/i.test(path)) key = 'item / place';
  else if (/badge/i.test(path)) key = 'badge';
  else if (/^\/User\.aspx/i.test(path) || /^\/p\/User-/i.test(path)) key = 'user';
  else if (/\/Forum\//i.test(path)) key = 'forum';
  else if (/^\/p\//.test(path)) key = 'p/ page';
  groups.set(key, (groups.get(key) || 0) + 1);
}
for (const [key, n] of [...groups.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${key}`);
}

const rest = rows.filter(([path]) => !/-(item|place)(\/|\?|$)/i.test(path) && !/badge/i.test(path));
if (rest.length) {
  console.log('\nnot item-or-badge:');
  for (const [path, why] of rest.slice(0, 60)) console.log(`  ${why}  ${path}`);
}
