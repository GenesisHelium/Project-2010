// Final cleanup pass over the mirrored tree.
//
// Playback debris is removed by locating markers and slicing at those indices.
// No regex in this file crosses a file: a lazy pattern once ate a 51 KB page and a
// 274 KB script bundle, and that is not a mistake worth repeating.
//
// What goes:
//   - the __wm bootstrap block and every __wm.rw() call
//   - the Wayback toolbar (div#wm-ipp-base through div#wm-ipp-print)
//   - script/link tags that point at web.archive.org or web-static.archive.org
//   - tracker script/img tags whose hosts no longer serve anything
//   - leftover /web/<ts><mod>/http://... references, rewritten to the local path
//     and downloaded when the file is not already on disk
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listDocuments } from './lib/documents.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';

const TRACKERS = [
  'amgdgt.com', 'cpxadroit.com', 'fastclick.net', 'google-analytics.com',
  'quantserve', 'scorecardresearch', 'doubleclick.net', 'eyeblaster',
  'googleadservices', 'rubiconproject', 'contextweb', 'yieldmanager',
  'adbrite', 'adnxs', 'tacoda', 'specificclick', 'revsci', 'crwdcntrl',
];

const MOD_KIND = { im_: 'image', cs_: 'css', js_: 'js', if_: 'frame', oe_: 'object', id_: 'data' };
const MOD = { image: 'im_', css: 'cs_', js: 'js_', frame: 'if_', object: 'oe_', data: 'id_' };

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"');
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const isTracker = (u) => TRACKERS.some((t) => u.includes(t));

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

function localPath(originalUrl, kind) {
  const u = new URL(originalUrl);
  const host = u.hostname.replace(/^www\./, '');
  const path = decodeURIComponent(u.pathname);

  if (host === 'roblox.com') {
    if (/^\/CSS\/Base\/CSS\/AllCSS\.ashx$/i.test(path)) return 'css/allcss.css';
    if (/^\/chat\/css\//i.test(path)) return 'css/' + posix.basename(path);
    if (/^\/css\//i.test(path)) return 'css/' + posix.basename(path);
    if (/^\/js\//i.test(path)) return 'js/' + posix.basename(path);
    if (/^\/ScriptResource\.axd$/i.test(path)) return 'js/scriptresource-CmAa0JUATF31D9rY.js';
    if (/^\/Thumbs\/Asset\.asmx\/js$/i.test(path)) return 'js/asset-asmx.js';
    if (/^\/images\//i.test(path)) return 'images' + path.replace(/^\/images/i, '');
    if (/^\/Forum\/skins\//i.test(path)) return 'images' + path;
    if (/^\/favicon\.ico$/i.test(path)) return 'favicon.ico';
    if (/^\/Ads\/IFrameAdContent\.aspx$/i.test(path)) {
      const slot = u.searchParams.get('slot') || 'ad';
      return 'ads/' + slot.replace(/[^a-z0-9_-]/gi, '_') + '.html';
    }
    return 'p' + path;
  }

  const safeHost = host.replace(/[^a-z0-9.-]/gi, '_');
  let base = 'ext/' + safeHost + path;
  if (base.endsWith('/')) base += 'index';
  if (!/\.[a-z0-9]{2,5}$/i.test(base)) {
    const m = path.match(/\.([a-z0-9]{2,5})$/i);
    base += '.' + (m ? m[1] : kind === 'image' ? 'png' : 'bin');
  }
  return base;
}

async function materialise(originalUrl, kind, ts) {
  const local = localPath(originalUrl, kind);
  const dest = join(SITE, local);
  if (await exists(dest)) return local;
  for (const stamp of [ts, '201012', '2011']) {
    try {
      const r = await fetch(`${WB}/${stamp}${MOD[kind] || ''}/${originalUrl}`, {
        headers: { 'user-agent': 'mirror' }, redirect: 'follow',
      });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 20) continue;
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      return local;
    } catch { /* next stamp */ }
  }
  return null;
}

function cutBlock(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) return src;
  const end = src.indexOf(endMarker, start);
  if (end === -1) return src;
  return src.slice(0, start) + src.slice(end + endMarker.length);
}

// Remove every <tag ...> element whose opening tag contains `needle`.
function dropElementWith(src, tag, needle) {
  let out = src;
  let cursor = 0;
  for (;;) {
    const open = out.toLowerCase().indexOf(`<${tag}`, cursor);
    if (open === -1) return out;
    const close = out.indexOf('>', open);
    if (close === -1) return out;
    const tagText = out.slice(open, close + 1);
    if (!tagText.includes(needle)) {
      cursor = close + 1;
      continue;
    }
    const end = tag === 'script' ? out.toLowerCase().indexOf('</script>', close) : close;
    const stop = end === -1 ? out.length : (tag === 'script' ? end + '</script>'.length : close + 1);
    out = out.slice(0, open) + out.slice(stop);
    cursor = open;
  }
}

function scrubHtml(src) {
  let out = src;

  // Wayback bootstrap: one inline script containing both __wm.init and __wm.wombat.
  for (let i = 0; i < 40; i++) {
    const at = out.indexOf('__wm.init(');
    if (at === -1) break;
    const open = out.lastIndexOf('<script', at);
    if (open === -1) break;
    const close = out.indexOf('</script>', at);
    if (close === -1) break;
    out = out.slice(0, open) + out.slice(close + '</script>'.length);
  }
  out = out.replace(/__wm\.rw\([01]\);/g, '');

  const tb = out.indexOf('<div id="wm-ipp-base"');
  if (tb !== -1) {
    const printEnd = out.indexOf('</div>', out.indexOf('<div id="wm-ipp-print"', tb));
    if (printEnd !== -1) out = out.slice(0, tb) + out.slice(printEnd + '</div>'.length);
  }

  for (const needle of ['web.archive.org', 'web-static.archive.org', 'archive.org', 'archive-it.org']) {
    for (let i = 0; i < 20; i++) {
      const before = out;
      out = dropElementWith(out, 'script', needle);
      out = dropElementWith(out, 'link', needle);
      out = dropElementWith(out, 'img', needle);
      out = dropElementWith(out, 'iframe', needle);
      if (out === before) break;
    }
  }

  for (const host of TRACKERS) {
    for (let i = 0; i < 10; i++) {
      const before = out;
      out = dropElementWith(out, 'script', host);
      out = dropElementWith(out, 'img', host);
      out = dropElementWith(out, 'iframe', host);
      if (out === before) break;
    }
  }

  // The capture's clock guard fires on every load once the date passes, and the
  // exact spelling varies between pages: with or without a trailing period, and
  // with the closing brace in either place.
  out = out.replace(
    /if\s*\(\s*new Date\(\)\s*>\s*new Date\('[^']*'\)\s*\)\s*\{\s*alert\('[^']*'\)\s*;?\s*\}\s*;?/g,
    '',
  );
  out = out.replace(
    /if\s*\(\s*new Date\(\)\s*>\s*new Date\('[^']*'\)\s*\)\s*alert\('[^']*'\)\s*;?/g,
    '',
  );

  // Google Analytics. The tracker script is dropped above, but the pages also
  // call into it inline, and a 2010 page whose urchinTracker is missing throws on
  // every load. The calls go, along with the inline block that loads ga.js.
  for (let i = 0; i < 40; i++) {
    const at = out.indexOf('ga.src = (');
    if (at === -1) break;
    const open = out.lastIndexOf('<script', at);
    const close = out.indexOf('</script>', at);
    if (open === -1 || close === -1) break;
    out = out.slice(0, open) + out.slice(close + '</script>'.length);
  }
  out = out.replace(/urchinTracker\(\);/g, '');
  out = out.replace(/__utmSetVar\('[^']*'\);/g, '');
  out = out.replace(/_uacct\s*=\s*"[^"]*";\s*/g, '');
  out = out.replace(/_udn\s*=\s*"[^"]*";\s*/g, '');

  // Kontagent was the other analytics vendor on the page. Its listener script was
  // an external tracker, so what is left behind references nothing: both the calls
  // and the property assignments that configure it.
  out = out.replace(/KontagentListener\.[A-Za-z_$]+\([^)]*\);/g, '');
  out = out.replace(/KontagentListener\.[A-Za-z_$]+\s*=\s*[^;]+;/g, '');

  return out;
}

const REF_RE = /(?:https?:\/\/web\.archive\.org)?\/web\/(\d{14})([a-z]{2}_)?\/((?:https?:)?\/\/[^"'\s)>\\)]+)/g;

async function rewriteArchiveRefs(src, kind) {
  const hits = [...src.matchAll(REF_RE)];
  if (!hits.length) return src;
  let out = src;
  for (const m of hits) {
    const [full, ts, mod, rawUrl] = m;
    let url = decode(rawUrl);
    if (url.startsWith('//')) url = 'http:' + url;
    if (isTracker(url)) { out = out.split(full).join(''); continue; }
    const resolvedKind = MOD_KIND[mod] || kind;
    const local = await materialise(url, resolvedKind, ts);
    if (local) out = out.split(full).join('/' + enc(local));
  }
  return out;
}

const { pages, stylesheets } = await listDocuments(SITE);

const stats = { pages: 0, css: 0 };

for (const rel of pages) {
  const file = join(SITE, rel);
  const before = await readFile(file, 'utf8');
  let after = scrubHtml(before);
  after = await rewriteArchiveRefs(after, 'image');
  if (after !== before) {
    await writeFile(file, after);
    stats.pages++;
  }
}

for (const rel of stylesheets) {
  const file = join(SITE, rel);
  const before = await readFile(file, 'utf8');
  const after = await rewriteArchiveRefs(before, 'image');
  if (after !== before) {
    await writeFile(file, after);
    stats.css++;
  }
}

console.log(`scrubbed: ${stats.pages} pages, ${stats.css} stylesheets`);
