// Rewrites every internal link in the mirrored pages to the local file that holds
// that page, so navigation lands on the mirrored copy instead of a dead path.
//
// Two things make this less obvious than it looks:
//
//   1. A relative link is relative to the ORIGINAL url of the page it sits in, not
//      to the local file. A page stored at /p/Default.aspx was served from
//      http://www.roblox.com/Default.aspx, so `Games.aspx` in it means
//      /Games.aspx on roblox.com, not /p/Games.aspx.
//   2. Pages are stored as /p/<original path>, so the local name and the original
//      path are the same string once the /p/ prefix is gone.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listDocuments } from './lib/documents.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');

const pages = JSON.parse(await readFile(join(SITE, '_pages.json'), 'utf8'));

// original url (path+query, lowercased) -> local path
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

// Assets count too. A page that says `images/Foo.png` needs that file found on
// disk, and listDocuments only reports documents.
async function indexAssets(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await indexAssets(join(dir, entry.name), rel);
    else onDisk.add(rel.toLowerCase());
  }
}
await indexAssets(SITE);

const has = (candidate) => onDisk.has(candidate.toLowerCase());

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#38;/g, '&');
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

// The original site url a stored page came from. Falls back to reconstructing it
// from the /p/<path> name, which is the same path the capture used.
function originOf(rel) {
  const known = pages.find(([, local]) => local.replace(/^\//, '').toLowerCase() === rel.toLowerCase());
  if (known) return known[0];
  if (rel === 'index.html' || rel === 'index.htm') return 'http://www.roblox.com/';
  if (rel.startsWith('p/')) return 'http://www.roblox.com/' + rel.slice(2);
  return 'http://www.roblox.com/';
}

function lookup(pathname, search = '') {
  return byFull.get((pathname + search).toLowerCase())
    || byPath.get(pathname.toLowerCase())
    || null;
}

function resolve(href, baseUrl) {
  let raw = decode(href.trim());
  if (!raw || raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('data:') || raw.startsWith('mailto:')) return null;

  // Leftover wayback reference.
  const wb = raw.match(/^(?:https?:\/\/web\.archive\.org)?\/web\/\d{14}(?:[a-z]{2}_)?\/(.+)$/);
  if (wb) raw = wb[1];

  // A protocol-relative URL only when what follows looks like a host. A leading
  // `//` before a path segment is a doubled slash from an earlier rewrite pass.
  if (raw.startsWith('//')) {
    const first = raw.slice(2).split('/')[0];
    raw = /\./.test(first) ? 'http:' + raw : raw.replace(/^\/+/, '/');
  }

  let url;
  try {
    url = new URL(raw, baseUrl);
  } catch {
    return null;
  }
  if (!/^(www\.)?roblox\.com$/i.test(url.hostname)) return null;

  const path = url.pathname;
  const bare = path.replace(/^\//, '');

  // A link already written in this mirror's own page namespace. Earlier passes
  // produced `/p/Games.aspx.html` for a file now stored as `/p/Games.aspx`, so a
  // `/p/` prefix is stripped and the remainder re-tested against the tree.
  if (/^p\//i.test(bare)) {
    const inner = bare.slice(2);
    for (const candidate of [inner, inner.replace(/\.html?$/i, '')]) {
      if (has(candidate)) return '/' + enc(candidate);
      if (has('p/' + candidate)) return '/p/' + enc(candidate);
    }
  }

  // A file that already exists in the tree.
  if (has(bare)) return '/' + enc(bare);

  // A page stored under its original path.
  if (has('p/' + bare)) return '/p/' + enc(bare);

  // An .html suffix left over from the second crawl's naming scheme.
  const withoutHtml = bare.replace(/\.html?$/i, '');
  if (withoutHtml !== bare && has('p/' + withoutHtml)) return '/p/' + enc(withoutHtml);

  // Anything the routing table knows about.
  const hit = lookup(path, url.search) || lookup(path);
  if (hit) return '/' + enc(hit.replace(/^\/+/, ''));

  return null;
}

let files = 0, links = 0, unresolved = 0;

for (const rel of pageFiles) {
  const file = join(SITE, rel);
  const baseUrl = originOf(rel);

  const before = await readFile(file, 'utf8');
  let changed = 0;
  // Both attributes go through the same resolution. A page saved under /p/ has
  // `images/foo.png` and `Games.aspx` written relative to its ORIGINAL url, so
  // the browser would otherwise look for them under /p/.
  const after = before.replace(/\b(href|src)="([^"]*)"/g, (full, attr, ref) => {
    const resolved = resolve(ref, baseUrl);
    if (!resolved) {
      const raw = decode(ref.trim());
      if (attr === 'href' && raw && !raw.startsWith('#') && !raw.startsWith('javascript:') && !raw.startsWith('mailto:')) {
        if (!/^https?:/i.test(raw) && !raw.startsWith('//')) unresolved++;
      }
      return full;
    }
    if (resolved === ref) return full;
    changed++;
    return `${attr}="${resolved}"`;
  });

  if (changed) {
    await writeFile(file, after);
    files++;
    links += changed;
  }
}

// Doubled slashes left by earlier passes collapse to one.
let collapsed = 0;
for (const rel of pageFiles) {
  const file = join(SITE, rel);
  const before = await readFile(file, 'utf8');
  const after = before.replace(/href="\/\/(p|css|js|images|ext|ads|web)\//g, (full, tree) => {
    collapsed++;
    return `href="/${tree}/`;
  });
  if (after !== before) await writeFile(file, after);
}

console.log(`relinked ${links} links across ${files} pages`);
console.log(`collapsed ${collapsed} doubled slashes`);
console.log(`relative hrefs still unresolved: ${unresolved}`);
