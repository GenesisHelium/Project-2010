// Mirrors the genre landing pages the 2010 nav links to.
//
// The first crawl never followed them, so they are absent from the mirror and
// every /<genre>-games link lands on the 404 page. Most of them do exist in the
// archive at other timestamps. This pulls them the same way the original crawl
// did — replay URL with rewriting, so every asset arrives as an absolute Wayback
// reference — then lifts those references to local paths before handing the files
// to the normal pipeline.
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, dirname, posix } from 'node:path';
import { deflateSync } from 'node:zlib';

const SITE = 'site';
const WB = 'https://web.archive.org/web';

const PAGES = [
  'horror-games', 'fps-games', 'rpg-games', 'fighting-games', 'western-games',
  'building-games', 'comedy-games', 'military-games', 'naval-games',
];

const STAMPS = ['20101210093455', '2011', '2010'];

const TRACKERS = ['amgdgt.com', 'cpxadroit.com', 'fastclick.net', 'google-analytics.com',
  'quantserve', 'scorecard', 'adroll', 'rubiconproject', 'contextweb', 'yieldmanager',
  'ds.eyeblastar', 'ds.eyeblaster', 'partner.googleadservices'];

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

async function materialise(originalUrl, kind, ts) {
  const local = localPath(originalUrl, kind);
  if (cache.has(local)) return local;
  const dest = join(SITE, local);

  if (await exists(dest)) { cache.set(local, local); return local; }

  if (isDeadHost(originalUrl)) {
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, solidPng(4, 4, [0xe8, 0xee, 0xf5]));
    cache.set(local, local);
    return local;
  }

  for (const stamp of [ts, '201012', '2011']) {
    try {
      const r = await fetch(`${WB}/${stamp}${MOD_KIND[kind] || ''}/${originalUrl}`, {
        headers: { 'user-agent': 'mirror' }, redirect: 'follow',
      });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 20) continue;
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      cache.set(local, local);
      return local;
    } catch { /* next stamp */ }
  }
  return null;
}

const report = [];
const fetched = [];

for (const name of PAGES) {
  const dest = join(SITE, 'p', name);
  if (await exists(dest)) { report.push(`${name}: already present`); continue; }

  let body = null;
  let stamp = null;
  for (const s of STAMPS) {
    try {
      const r = await fetch(`${WB}/${s}/http://www.roblox.com/${name}`, {
        headers: { 'user-agent': 'mirror' }, redirect: 'follow',
      });
      if (!r.ok) continue;
      const text = await r.text();
      if (text.length < 5000) continue;
      body = text;
      stamp = s;
      break;
    } catch { /* next stamp */ }
  }
  if (!body) { report.push(`${name}: not in archive`); continue; }

  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, body);
  fetched.push({ name, stamp, chars: body.length });

  // Lift the absolute Wayback references to local paths, one at a time.
  const replacements = new Map();
  for (const m of body.matchAll(REF_RE)) {
    const [full, ts, mod, rawUrl] = m;
    let url = decode(rawUrl);
    if (url.startsWith('//')) url = 'http:' + url;
    if (isTracker(url)) continue;
    const local = await materialise(url, MOD_KIND[mod] || 'data', ts);
    if (local) replacements.set(full, '/' + enc(local));
  }
  if (replacements.size) {
    let out = body;
    for (const [from, to] of replacements) out = out.split(from).join(to);
    await writeFile(dest, out);
  }
  report.push(`${name}: ${stamp} ${body.length} chars, ${replacements.size} refs localised`);
}

await writeFile(join('tools', '_genre-mirror.txt'), report.join('\n') + '\n');
console.log(report.join('\n'));
console.log(`fetched ${fetched.length}`);
