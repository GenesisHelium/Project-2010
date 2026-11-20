// Crawls one hop out from the captured entry page and stores each internal page.
//
// Links are read from the raw capture, never from a rewritten file, so the crawl
// cannot chase its own local paths. A page is stored at `p/<path>.html`, which the
// dev server resolves for the `/p/<path>` hrefs the entry rewrite produces.
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';
const TS = '20101210093455';

const MAX_PAGES = 45;
const MOD_KIND = { im_: 'image', cs_: 'css', js_: 'js', if_: 'frame', oe_: 'object', id_: 'data' };
const TRACKERS = ['amgdgt.com', 'cpxadroit.com', 'fastclick.net', 'google-analytics.com', 'quantserve', 'scorecard'];

const ARCHIVE_RE =
  /(?:https?:\/\/web\.archive\.org)?\/web\/(\d{14})([a-z]{2}_)?\/((?:https?:)?\/\/[^"'\s)>\\]+)/g;

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"');
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const isTracker = (u) => TRACKERS.some((t) => u.includes(t));

// Mirrors the mapping used for the entry page so hrefs already in index.html
// resolve to the file this script writes.
function pageLocal(originalUrl) {
  const u = new URL(originalUrl);
  let local = 'p' + u.pathname;
  if (local.endsWith('/')) local += 'index';
  if (!/\.(aspx|html?)$/i.test(local)) local += '.aspx';
  // Distinguish pages that differ only by query so they cannot overwrite each other.
  if (u.search && u.search.length > 1) {
    const key = [...u.searchParams.entries()]
      .map(([k, v]) => `${k}${v}`)
      .join('');
    const tag = key.replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
    if (tag) local = local.replace(/\.(aspx|html?)$/i, '') + '-' + tag + '.aspx';
  }
  // Windows rejects the colon in a scheme and the crawl can emit odd segments.
  local = local.replace(/[^A-Za-z0-9._/-]/g, '_');
  return local + '.html';
}

async function findCapture(url) {
  for (const ts of [TS, '20101215', '20110101', '20110501', '']) {
    try {
      const r = await fetch(`${WB}/${ts}if_/${url}`, {
        headers: { 'user-agent': 'mirror' }, redirect: 'follow',
      });
      if (!r.ok) continue;
      const text = await r.text();
      if (text.length < 2000) continue;
      return { text, ts: ts || TS };
    } catch { /* next */ }
  }
  return null;
}

function rewrite(html) {
  return html.replace(ARCHIVE_RE, (full, ts, mod, rawUrl) => {
    let url = decode(rawUrl);
    if (url.startsWith('//')) url = 'http:' + url;
    if (isTracker(url)) return full;
    // Reuse whatever the entry mirror already downloaded.
    const guess = url.replace(/^https?:\/\/(www\.)?/, '');
    if (!guess.startsWith('roblox.com')) return full;
    return full;
  });
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

function internalLinks(html) {
  const out = new Set();
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    let href = decode(m[1]);
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
    if (/^\/web\/\d{14}/.test(href)) href = href.replace(/^\/web\/\d{14}(?:[a-z]{2}_)?\//, '');
    if (/^https?:\/\/(?:www\.)?roblox\.com/i.test(href)) {
      const parsed = new URL(href);
      href = parsed.pathname + parsed.search;
    }
    if (/^https?:/i.test(href) || href.startsWith('//')) continue;
    if (!href.startsWith('/')) continue;
    if (/\.(css|js|png|jpe?g|gif|ico|swf|bin|ashx)$/i.test(href.split('?')[0])) continue;
    if (href.startsWith('/p/')) continue;
    out.add(href);
  }
  return [...out];
}

// Remove output from the previous, broken crawl.
await rm(join(SITE, 'p'), { recursive: true, force: true });

const entry = await findCapture('http://www.roblox.com/');
const queue = [];
for (const href of internalLinks(entry.text)) {
  queue.push({ url: 'http://www.roblox.com' + href, depth: 1 });
}

const built = [];
const seen = new Set();
let pages = 0;

while (queue.length && pages < MAX_PAGES) {
  const { url, depth } = queue.shift();
  if (seen.has(url)) continue;
  seen.add(url);

  const hit = await findCapture(url);
  if (!hit) { console.log(`miss  ${url}`); continue; }

  const local = pageLocal(url);
  const out = strip(rewrite(hit.text));
  const dest = join(SITE, local);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, out);
  built.push([url, '/' + enc(local)]);
  pages++;
  console.log(`page  ${url}  ->  ${local}  (${out.length}b)`);

  if (depth < 2) {
    for (const href of internalLinks(out)) {
      const abs = 'http://www.roblox.com' + href;
      if (!seen.has(abs)) queue.push({ url: abs, depth: depth + 1 });
    }
  }
}

await writeFile(join(SITE, '_pages.json'), JSON.stringify(built, null, 2));
console.log(`\nmirrored ${pages} pages`);
