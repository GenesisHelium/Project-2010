// Collects every referenced image that is not on disk, tries the archive for each,
// and writes a neutral placeholder for the ones that were never captured.
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, extname, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';
const TIMES = ['20101210093455', '201012', '2011', '2009'];

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) yield* walk(f);
    else yield f;
  }
}

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };
const decode = (s) => decodeURIComponent(s.replace(/&amp;/g, '&'));

// Gather missing image references and remember which original URL they came from.
const manifest = JSON.parse(await readFile(join(SITE, '_manifest.json'), 'utf8').catch(() => '[]'));
const originByLocal = new Map(manifest.map(([local, v]) => [local, v.url]));

const wanted = new Map(); // local path -> original url (if known)
for await (const file of walk(SITE)) {
  if (extname(file).toLowerCase() !== '.html') continue;
  const text = await readFile(file, 'utf8');
  for (const m of text.matchAll(/(?:src|href)="(\/[^"]+\.(?:png|jpe?g|gif))"/gi)) {
    const local = decode(m[1]).replace(/^\//, '');
    if (await exists(join(SITE, local))) continue;
    if (!wanted.has(local)) wanted.set(local, originByLocal.get(local) || null);
  }
}

console.log(`missing images: ${wanted.size}`);

// Minimal PNG encoder for solid-colour placeholders.
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function solidPng(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const isImage = (b) => b.length > 60 && (
  (b[0] === 0x89 && b[1] === 0x50) || (b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x47 && b[1] === 0x49));

let recovered = 0, placed = 0;

for (const [local, origin] of wanted) {
  const dest = join(SITE, local);
  await mkdir(dirname(dest), { recursive: true });

  // Chat widget assets and thumbnails: try the archive before giving up.
  const candidates = [];
  if (origin) candidates.push(origin);
  const name = basename(local);
  if (/\.(png|gif|jpe?g)$/i.test(name) && !local.includes('roblox.com/')) {
    candidates.push(`http://www.roblox.com/images/${name}`, `http://www.roblox.com/css/${name}`);
  }

  let got = false;
  for (const url of candidates) {
    if (got) break;
    for (const ts of TIMES) {
      if (got) break;
      try {
        const r = await fetch(`${WB}/${ts}im_/${url}`, { headers: { 'user-agent': 'mirror' }, redirect: 'follow' });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        if (!isImage(buf)) continue;
        await writeFile(dest, buf);
        recovered++; got = true;
      } catch { /* next */ }
    }
  }

  if (!got) {
    await writeFile(dest, solidPng(4, 4, [0xe8, 0xee, 0xf5]));
    placed++;
  }
}

console.log(`recovered from archive: ${recovered}`);
console.log(`placeholder written: ${placed}`);
