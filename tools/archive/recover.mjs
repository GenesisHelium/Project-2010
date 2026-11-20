// Finds a live capture for each missing asset via the Wayback CDX index,
// trying the original path first and then known historical fallbacks.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';

const candidates = [
  ['css/available.png', ['http://www.roblox.com/CSS/Base/CSS/available.png', 'http://www.roblox.com/images/available.png']],
  ['css/catalog_options_back.png', ['http://www.roblox.com/CSS/Base/images/catalog_options_back.png', 'http://www.roblox.com/images/catalog_options_back.png']],
  ['css/chatbarback.jpg', ['http://www.roblox.com/CSS/Base/CSS/chatbarback.jpg', 'http://www.roblox.com/images/chatbarback.jpg']],
  ['css/close.png', ['http://www.roblox.com/CSS/Base/CSS/close.png', 'http://www.roblox.com/images/close.png']],
  ['css/mini.png', ['http://www.roblox.com/CSS/Base/CSS/mini.png', 'http://www.roblox.com/images/mini.png']],
  ['css/unavailable.png', ['http://www.roblox.com/CSS/Base/CSS/unavailable.png', 'http://www.roblox.com/images/unavailable.png']],
  ['ext/t0bg.roblox.com/1aa7b0b2fb6ddac704ae6f8482884b1e.png', [
    'http://t0bg.roblox.com/1aa7b0b2fb6ddac704ae6f8482884b1e',
    'http://t3bg.roblox.com/1aa7b0b2fb6ddac704ae6f8482884b1e',
    'http://t5bg.roblox.com/1aa7b0b2fb6ddac704ae6f8482884b1e',
  ]],
];

async function cdx(url) {
  const q = `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=5&filter=statuscode:200&collapse=digest`;
  try {
    const res = await fetch(q, { headers: { 'user-agent': 'mirror' } });
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length < 2) return [];
    return rows.slice(1).map((r) => ({ ts: r[1], orig: r[2] }));
  } catch { return []; }
}

async function tryFetch(orig, ts, mod) {
  const targets = ts
    ? [`${WB}/${ts}${mod}/${orig}`]
    : [`${WB}/2010${mod}/${orig}`, `${WB}/2011${mod}/${orig}`, `${WB}/${mod}/${orig}`];
  for (const t of targets) {
    try {
      const res = await fetch(t, { headers: { 'user-agent': 'mirror' }, redirect: 'follow' });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 100) return { buf, from: res.url };
      }
    } catch { /* next */ }
  }
  return null;
}

let fixed = 0;
for (const [local, urls] of candidates) {
  let done = false;
  for (const u of urls) {
    const hits = await cdx(u);
    for (const h of hits) {
      const r = await tryFetch(h.orig, h.ts, 'im_');
      if (r) {
        const dest = join(SITE, local);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, r.buf);
        console.log(`OK   ${local}  (${r.buf.length}b) ${h.ts}`);
        fixed++; done = true; break;
      }
    }
    if (done) break;
  }
  if (!done) console.log(`MISS ${local}`);
}
console.log(`recovered ${fixed}/${candidates.length}`);
