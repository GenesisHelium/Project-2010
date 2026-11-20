// Builds the five chat widget images the archive never captured.
//
// AllCSS.ashx references /css/available.png, /css/unavailable.png, /css/close.png,
// /css/mini.png and /css/chatbarback.jpg. None of them have a capture in the CDX
// index at any timestamp, so the widget renders with holes unless something fills
// them. These are drawn at the exact dimensions the stylesheet asks for and in the
// same palette as the rest of the 2010 chat bar.
import { writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CSS = join(ROOT, '..', 'site', 'css');

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
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

// RGBA pixel canvas with the few drawing helpers these icons need.
function canvas(w, h) {
  return { w, h, px: new Uint8Array(w * h * 4) };
}

function set(c, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  c.px[i] = r; c.px[i + 1] = g; c.px[i + 2] = b; c.px[i + 3] = a;
}

function disc(c, cx, cy, radius, colour) {
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      if (dx * dx + dy * dy <= radius * radius) set(c, x, y, colour);
    }
  }
}

function line(c, x0, y0, x1, y1, colour) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 || 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    set(c, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), colour);
  }
}

function png(c) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0);
  ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: RGBA
  const raw = Buffer.alloc(c.h * (c.w * 4 + 1));
  for (let y = 0; y < c.h; y++) {
    raw[y * (c.w * 4 + 1)] = 0; // filter: none
    Buffer.from(c.px.buffer, y * c.w * 4, c.w * 4).copy(raw, y * (c.w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const GREEN = [0x2e, 0xb2, 0x2e, 0xff];
const GREY = [0x9a, 0x9a, 0x9a, 0xff];
const WHITE = [0xff, 0xff, 0xff, 0xff];
const CLEAR = [0, 0, 0, 0];

// Chat presence dots: 15x15 as declared by .chat-available / .chat-unavailable.
function dot(colour) {
  const c = canvas(15, 15);
  disc(c, 7.5, 7.5, 6.5, colour);
  disc(c, 5.5, 5.5, 2.5, [255, 255, 255, 90]);
  return c;
}

// Window buttons on a 10x10 box, drawn for the #6E99C9 chat title bar.
function closeIcon() {
  const c = canvas(10, 10);
  line(c, 2, 2, 7, 7, WHITE);
  line(c, 3, 2, 8, 7, WHITE);
  line(c, 2, 3, 7, 8, WHITE);
  line(c, 7, 2, 2, 7, WHITE);
  line(c, 8, 2, 3, 7, WHITE);
  line(c, 7, 3, 2, 8, WHITE);
  return c;
}

function miniIcon() {
  const c = canvas(10, 10);
  for (let y = 4; y <= 5; y++) for (let x = 2; x <= 7; x++) set(c, x, y, WHITE);
  return c;
}

// 30 px tall bar behind the status strip: a light vertical gradient, repeated.
function chatBar() {
  const c = canvas(1, 30);
  for (let y = 0; y < 30; y++) {
    const t = y / 29;
    const v = Math.round(0xf2 - 0x10 * t);
    set(c, 0, y, [v, v, v, 0xff]);
  }
  return c;
}

const assets = [
  ['available.png', dot(GREEN)],
  ['unavailable.png', dot(GREY)],
  ['close.png', closeIcon()],
  ['mini.png', miniIcon()],
  // The stylesheet names this chatbarback.jpg. It is written as PNG and the
  // reference is updated to match, rather than serving PNG bytes under a JPEG
  // content type.
  ['chatbarback.png', chatBar()],
];

await mkdir(CSS, { recursive: true });
for (const [name, c] of assets) {
  await writeFile(join(CSS, name), png(c));
  console.log(`wrote ${name}  ${c.w}x${c.h}`);
}
