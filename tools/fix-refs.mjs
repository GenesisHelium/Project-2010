// Repairs the last handful of broken references left by earlier rewrite passes.
//
// Each rule here exists because a specific rewrite mangled a specific shape:
//
//   /ext/<host>/index.bin<suffix>   a third-party URL whose host was split at the
//                                   `www.` in a JS string and mirrored by mistake
//   /css/allcss.css <asp.net expr>  an unrendered `<%= %>` block inside href
//   /p/ext/<host>/...               an already-mirrored asset addressed through the
//                                   page namespace
//   /ads/*.html                     ad iframe bodies whose creative never survived
//   <img src=""> / <img src="/p/x">  a server-side image url the origin left empty,
//                                   rewritten into the page's own address by a pass
import { readdir, readFile, writeFile, mkdir, stat, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { listDocuments } from './lib/documents.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) yield* walk(f);
    else yield f;
  }
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

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

const isImage = (b) => b.length > 60 && (
  (b[0] === 0x89 && b[1] === 0x50) ||
  (b[0] === 0xff && b[1] === 0xd8) ||
  (b[0] === 0x47 && b[1] === 0x49));

let touched = 0;

async function fixFile(file, rel = '') {
  const before = await readFile(file, 'utf8');
  let out = before;

  // 1. Un-mirror a third-party URL that was split at `www.` and mirrored.
  out = out.replace(/\/ext\/www\/index\.bin\.([^"'\s)]+)/g, 'http://www.$1');
  out = out.replace(/\/ext\/ssl\/index\.bin\.([^"'\s)]+)/g, 'https://ssl.$1');
  out = out.replace(/\/ext\/([a-z0-9.-]+\.[a-z]{2,})\/index\.bin([^"'\s)]*)/g, 'http://$1$2');
  //    Same split, but the original crawler saved the host root as `index.png`.
  out = out.replace(/\/ext\/www\/index\.png\.([^"'\s)]+)/g, 'http://www.$1');
  out = out.replace(/\/ext\/([a-z0-9.-]+\.[a-z]{2,})\/index\.png(?=["'\s)]|$)/g, 'http://$1/');

  // 2. The unrendered server-side expression inside the stylesheet href. The whole
  //    query string after allcss.css is the broken expression plus its own `&t=`.
  out = out.replace(/\/css\/allcss\.css[^"]*?%>[^"]*/g, '/css/allcss.css');
  out = out.replace(/\/css\/allcss\.css&t=[A-Za-z]+/g, '/css/allcss.css');
  //    Two pages kept the handler address instead of the rewritten path, relative
  //    in one case and page-namespaced in the other.
  out = out.replace(/(?:\.\.\/|\/p\/)?CSS\/Base\/CSS\/AllCSS\.ashx\?[^"]*?%>[^"]*/gi, '/css/allcss.css');

  // 3. An asset addressed through the page namespace, with or without a stray
  //    `.aspx`/`.html` suffix bolted on by an earlier pass.
  out = out.replace(/\/p\/(ext\/[^"'\s)]+?)\.aspx/g, '/$1');
  out = out.replace(/\/p\/(ext\/[^"'\s)]+?)\.html/g, '/$1');

  // 4. Ad iframe bodies: point at the dev server's blank slot.
  out = out.replace(/\/ads\/[A-Za-z0-9_.-]+\.html/g, '/Ads/IFrameAdContent.aspx');

  // 5. A `http://` URL that an earlier pass prefixed with a page-namespace slash.
  out = out.replace(/\/p(https?:\/\/)/g, '$1');

  // 6. Thumbnail CDN. Every page carries an absolute t0bg-t7bg fallback image,
  //    and those hosts were never crawled. Routing them through the local tree
  //    keeps the browser from stalling on a host that no longer answers.
  out = out.replace(/https?:\/\/t(\d)?bg\.roblox\.com\//g, '/ext/t$1bg.roblox.com/');

  // 7. An img whose src is empty, or resolves back to its own page. The origin
  //    left the src unset and served it with an empty value; a later pass gave
  //    the empty value a location. Nothing is lost by dropping the attribute —
  //    the element has no picture in the capture either way, and an empty src
  //    makes the browser re-request the document as an image.
  if (rel) {
    const trimmed = rel.replace(/^p\//, '');
    const own = new Set([
      `/${rel}`,
      `/${trimmed}`,
      `/${trimmed.replace(/\.(aspx|html)$/i, '')}`,
      `/p/${trimmed.replace(/\.(aspx|html)$/i, '')}`,
    ]);
    if (rel === 'index.html') { own.add('/'); own.add('/index.html'); }

    out = out.replace(/<img\b[^>]*>/gi, (tag) => {
      const src = tag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
      if (!src) return tag;
      const value = src[2].trim();
      if (value !== '' && !own.has(value)) return tag;
      return tag.replace(/\s+src\s*=\s*(["'])(.*?)\1/i, '');
    });
  }

  if (out !== before) {
    await writeFile(file, out);
    touched++;
  }
}

const { pages: pageFiles, stylesheets } = await listDocuments(SITE);

for (const rel of [...pageFiles, ...stylesheets]) {
  await fixFile(join(SITE, rel), rel);
}

// An <img> whose src is empty or points back at the document is a server-side
// image URL that rendered blank in 2010. Wayback's rewriter filled the blank in
// with the page address, so it survives as `src="/p/Whatever.aspx"`. Rule 7 in
// fixFile drops the attribute instead of pointing it at a placeholder: the image
// never had a picture, and leaving the attribute makes Chrome re-request the
// page as an image.

// Any /ext/<host>/... reference with no mirrored file behind it is an outbound
// link, not a local asset. Send it back to the real host.
let unmirrored = 0;
for (const rel of pageFiles) {
  const file = join(SITE, rel);
  const before = await readFile(file, 'utf8');
  let out = before;
  for (const m of [...before.matchAll(/(?:href|src)="(\/ext\/[^"]+)"/g)]) {
    const local = m[1].split('?')[0].replace(/^\/+/, '');
    if (await exists(join(SITE, local))) continue;
    const host = m[1].split('/')[2];
    const rest = m[1].split('/').slice(3).join('/');
    if (!host || !/\./.test(host)) continue;
    // The thumbnail CDN is served by the dev server, not from disk.
    if (/^t\d?bg\.roblox\.com$/i.test(host)) continue;
    out = out.split(m[1]).join(`http://${host}/${rest}`);
    unmirrored++;
  }
  if (out !== before) await writeFile(file, out);
}

console.log(`repaired ${touched} files`);
console.log(`unmirrored ${unmirrored} outbound /ext links`);

// The ad creative files are archive leftovers with no ad in them.
await rm(join(SITE, 'ads'), { recursive: true, force: true });
console.log('removed site/ads (empty ad bodies)');

// Images the pages ask for that the mirror never got.
const MISSING_IMAGES = [
  { local: 'images/JoinBuildersClubNow.png', sources: ['http://www.roblox.com/images/JoinBuildersClubNow.png'] },
];

for (const { local, sources } of MISSING_IMAGES) {
  const dest = join(SITE, local);
  if (await exists(dest)) continue;
  let got = false;
  for (const url of sources) {
    if (got) break;
    for (const stamp of ['20101210093455', '201012', '2011', '2010']) {
      if (got) break;
      try {
        const r = await fetch(`${WB}/${stamp}im_/${url}`, {
          headers: { 'user-agent': 'mirror' }, redirect: 'follow',
        });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        if (!isImage(buf)) continue;
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, buf);
        console.log(`recovered ${local} (${buf.length}b)`);
        got = true;
      } catch { /* next */ }
    }
  }
  if (!got) {
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, solidPng(8, 8, [0xe8, 0xee, 0xf5]));
    console.log(`placeholder ${local}`);
  }
}
