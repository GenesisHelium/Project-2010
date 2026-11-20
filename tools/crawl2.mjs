// Second crawl pass: follows internal links found inside pages the first pass built,
// so navigation from any mirrored page reaches another mirrored page.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';
const TS = '20101210093455';
const MAX_PAGES = Number(process.env.MAX_PAGES || 120);

const TRACKERS = ['amgdgt.com', 'cpxadroit.com', 'fastclick.net', 'google-analytics.com'];
const ARCHIVE_RE = /(?:https?:\/\/web\.archive\.org)?\/web\/(\d{14})([a-z]{2}_)?\/((?:https?:)?\/\/[^"'\s)>\\]+)/g;

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"');
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const isTracker = (u) => TRACKERS.some((t) => u.includes(t));
const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

const pages = JSON.parse(await readFile(join(SITE, '_pages.json'), 'utf8'));
const built = new Map(pages.map(([url, local]) => [url, local]));

function pageLocal(originalUrl) {
  const u = new URL(originalUrl);
  let local = 'p' + u.pathname;
  if (local.endsWith('/')) local += 'index';
  if (!/\.(aspx|html?)$/i.test(local)) local += '.aspx';
  if (u.search && u.search.length > 1) {
    const tag = [...u.searchParams.entries()].map(([k, v]) => `${k}${v}`).join('').replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
    if (tag) local = local.replace(/\.(aspx|html?)$/i, '') + '-' + tag + '.aspx';
  }
  return local.replace(/[^A-Za-z0-9._/-]/g, '_') + '.html';
}

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) yield* walk(f); else yield f;
  }
}

async function findCapture(url) {
  for (const ts of [TS, '20101215', '20110101', '20110501', '']) {
    try {
      const r = await fetch(`${WB}/${ts}if_/${url}`, { headers: { 'user-agent': 'mirror' }, redirect: 'follow' });
      if (!r.ok) continue;
      const text = await r.text();
      if (text.length < 2000) continue;
      return { text, ts: ts || TS };
    } catch { /* next */ }
  }
  return null;
}

function strip(html) {
  let out = html;
  const b = out.indexOf('<!-- BEGIN WAYBACK TOOLBAR INSERT -->');
  const e = out.indexOf('<!-- END WAYBACK TOOLBAR INSERT -->');
  if (b !== -1 && e !== -1) out = out.slice(0, b) + out.slice(e + '<!-- END WAYBACK TOOLBAR INSERT -->'.length);
  out = out.replace(/<script[^>]+web-static\.archive\.org[^>]*><\/script>/g, '');
  out = out.replace(/<link[^>]+web-static\.archive\.org[^>]*>/g, '');
  out = out.replace(/if \(new Date\(\) > new Date\('12\/18\/2010 [^']*'\)\)\{alert\('Your system time is incorrect'\) \};/g, '');
  return out;
}

function rewrite(html) {
  return html.replace(ARCHIVE_RE, (full, ts, mod, rawUrl) => {
    let url = decode(rawUrl);
    if (url.startsWith('//')) url = 'http:' + url;
    if (isTracker(url)) return full;
    return full;
  });
}

function internalLinks(html) {
  const out = new Set();
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    let href = decode(m[1]);
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('data:')) continue;
    if (/^\/web\/\d{14}/.test(href)) href = href.replace(/^\/web\/\d{14}(?:[a-z]{2}_)?\//, '');
    if (/^https?:\/\/(?:www\.)?roblox\.com/i.test(href)) {
      const p = new URL(href.split('&quot;')[0]);
      href = p.pathname + p.search;
    }
    if (/^https?:/i.test(href) || href.startsWith('//')) continue;
    if (!href.startsWith('/')) continue;
    if (/\.(css|js|png|jpe?g|gif|ico|swf|bin|ashx)$/i.test(href.split('?')[0])) continue;
    if (href.startsWith('/p/')) continue;
    out.add(href.split('&quot;')[0]);
  }
  return [...out];
}

// Seed from links inside pages already on disk.
const seeds = new Set();
for await (const file of walk(join(SITE, 'p'))) {
  if (!/\.html?$/i.test(file)) continue;
  const text = await readFile(file, 'utf8');
  for (const href of internalLinks(text)) seeds.add(href);
}
// And from the entry page.
for (const href of internalLinks(await readFile(join(SITE, 'index.html'), 'utf8'))) seeds.add(href);

console.log(`seeds: ${seeds.size}`);

let added = 0;
for (const href of seeds) {
  if (added >= MAX_PAGES) break;
  const url = 'http://www.roblox.com' + href;
  if (built.has(url)) continue;
  const local = pageLocal(url);
  if (await exists(join(SITE, local))) { built.set(url, '/' + enc(local)); continue; }

  const hit = await findCapture(url);
  if (!hit) { continue; }

  const out = strip(rewrite(hit.text));
  const dest = join(SITE, local);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, out);
  built.set(url, '/' + enc(local));
  added++;
  console.log(`page  ${href}  ->  ${local}  (${out.length}b)`);
}

await writeFile(join(SITE, '_pages.json'), JSON.stringify([...built], null, 2));
console.log(`\nadded ${added} pages, total ${built.size}`);
