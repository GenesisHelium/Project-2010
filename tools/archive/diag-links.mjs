// Reports what relink still cannot resolve, grouped by shape.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listDocuments } from './lib/documents.mjs';

const SITE = 'site';
const pages = JSON.parse(await readFile(join(SITE, '_pages.json'), 'utf8'));

const byFull = new Map();
const byPath = new Map();
for (const [url, local] of pages) {
  const u = new URL(url);
  byFull.set((u.pathname + u.search).toLowerCase(), local);
  const p = u.pathname.toLowerCase();
  if (!byPath.has(p)) byPath.set(p, local);
}

const onDisk = new Set();
const { pages: pageFiles } = await listDocuments(SITE);
for (const rel of pageFiles) onDisk.add(rel.toLowerCase());

function originOf(rel) {
  const known = pages.find(([, local]) => local.replace(/^\//, '').toLowerCase() === rel.toLowerCase());
  if (known) return known[0];
  if (rel.startsWith('p/')) return 'http://www.roblox.com/' + rel.slice(2);
  return 'http://www.roblox.com/';
}

const buckets = new Map();
for (const rel of pageFiles) {
  const base = originOf(rel);
  const text = await readFile(join(SITE, rel), 'utf8');
  for (const m of text.matchAll(/href="([^"]*)"/g)) {
    const raw = m[1].replace(/&amp;/g, '&').trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('mailto:') || raw.startsWith('data:')) continue;
    if (/^https?:/i.test(raw)) continue;
    let url;
    try { url = new URL(raw.startsWith('//') && !/\./.test(raw.slice(2).split('/')[0]) ? raw.replace(/^\/+/, '/') : raw, base); } catch { continue; }
    if (!/^(www\.)?roblox\.com$/i.test(url.hostname)) continue;
    const bare = url.pathname.replace(/^\//, '');
    if (onDisk.has(bare.toLowerCase())
        || onDisk.has(('p/' + bare).toLowerCase())
        || onDisk.has(('p/' + bare.replace(/\.html?$/i, '')).toLowerCase())) continue;
    if (byFull.has((url.pathname + url.search).toLowerCase()) || byPath.has(url.pathname.toLowerCase())) continue;
    buckets.set(url.pathname, (buckets.get(url.pathname) || 0) + 1);
  }
}

const sorted = [...buckets].sort((a, b) => b[1] - a[1]);
console.log(`distinct unresolved targets: ${sorted.length}`);
for (const [k, v] of sorted.slice(0, 30)) console.log(`${String(v).padStart(6)}  ${k}`);
