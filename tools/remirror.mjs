// Second mirror pass over crawled pages, concurrent and host-aware.
//
// Absolute Wayback references left by the crawler are resolved to local paths and
// downloaded. Thumbnail hosts that were never crawled by the archive are skipped
// immediately and filled with a placeholder instead of costing a network round trip.
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, extname, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';
const CONCURRENCY = 8;

const TRACKERS = ['amgdgt.com', 'cpxadroit.com', 'fastclick.net', 'google-analytics.com',
  'quantserve', 'scorecard', 'adroll', 'rubiconproject', 'contextweb', 'yieldmanager',
  'ds.eyeblaster', 'partner.googleadservices'];

// Content-addressed thumbnail CDNs that the crawler never captured.
const DEAD_HOSTS = [/^t\d?bg\.roblox\.com$/, /^t\d\.rbxcdn\.com$/, /^assetgame\.roblox\.com$/];

const MOD_KIND = { im_: 'image', cs_: 'css', js_: 'js', if_: 'frame', oe_: 'object', id_: 'data' };
const REF_RE = /(?:https?:\/\/web\.archive\.org)?\/web\/(\d{14})([a-z]{2}_)?\/((?:https?:)?\/\/[^"'\s)>\\]+)/g;

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"');
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const isTracker = (u) => TRACKERS.some((t) => u.includes(t));
const isDeadHost = (u) => { try { return DEAD_HOSTS.some((re) => re.test(new URL(u).hostname)); } catch { return false; } };

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
    if (/^\/ScriptResource\.axd$/i.test(path)) return 'js/scriptresource-shared.js';
    if (/^\/Thumbs\/Asset\.asmx\/js$/i.test(path)) return 'js/asset-asmx.js';
    if (/^\/images\//i.test(path)) return 'images' + path.replace(/^\/images/i, '');
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

const MOD = { image: 'im_', css: 'cs_', js: 'js_', frame: 'if_', object: 'oe_', data: 'id_' };

// Solid-colour PNG so a missing archive asset never leaves a hole in the layout.
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function solidPng(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const cache = new Map();
let downloaded = 0, placeholders = 0, failed = 0;

async function materialise(originalUrl, kind, ts) {
  const local = localPath(originalUrl, kind);
  if (cache.has(local)) return local;
  const dest = join(SITE, local);

  if (await exists(dest)) { cache.set(local, local); return local; }

  if (isDeadHost(originalUrl)) {
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, solidPng(4, 4, [0xe8, 0xee, 0xf5]));
    placeholders++; cache.set(local, local); return local;
  }

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
      downloaded++; cache.set(local, local); return local;
    } catch { /* next stamp */ }
  }

  failed++;
  return null;
}

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) yield* walk(f); else yield f;
  }
}

async function pool(items, limit, worker) {
  const running = new Set();
  for (const item of items) {
    const p = worker(item).finally(() => running.delete(p));
    running.add(p);
    if (running.size >= limit) await Promise.race(running);
  }
  await Promise.all(running);
}

const pageFiles = [];
for await (const f of walk(SITE)) if (extname(f).toLowerCase() === '.html') pageFiles.push(f);

let rewritten = 0, pageIndex = 0;

for (const file of pageFiles) {
  const before = await readFile(file, 'utf8');
  const refs = [...before.matchAll(REF_RE)];
  pageIndex++;
  if (!refs.length) continue;

  const replacements = new Map();
  await pool(refs, CONCURRENCY, async (m) => {
    const [full, ts, mod, rawUrl] = m;
    let url = decode(rawUrl);
    if (url.startsWith('//')) url = 'http:' + url;
    if (isTracker(url)) return;
    const local = await materialise(url, MOD_KIND[mod] || 'data', ts);
    if (local) replacements.set(full, '/' + enc(local));
  });

  if (replacements.size) {
    let out = before;
    for (const [from, to] of replacements) out = out.split(from).join(to);
    await writeFile(file, out);
    rewritten += replacements.size;
  }
  if (pageIndex % 10 === 0) process.stdout.write(`[${pageIndex}/${pageFiles.length}] `);
}

console.log(`\npages: ${pageFiles.length}`);
console.log(`downloaded: ${downloaded}`);
console.log(`placeholders: ${placeholders}`);
console.log(`rewritten: ${rewritten}`);
console.log(`unavailable: ${failed}`);
