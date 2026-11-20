// Finds an archived thumbnail of the featured game so the homepage does not ship
// a broken image. Falls back to the first hash that resolves.
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';
const TS = '20101210093455';

const hashes = [
  ['t0bg', '1aa7b0b2fb6ddac704ae6f8482884b1e'], // exact one the homepage asks for
  ['t0bg', '459ea7000308a05c5f7294ccb31b7fa9'],
  ['t0bg', '77ea3960d3cac79c694a31462b552b71'],
  ['t0bg', '914f2b286a086fcf874652ecbe965f20'],
  ['t0bg', 'e6a888907cf980070f29a91204e526b4'],
  ['t0bg', 'e9b7c138a2a26ae1a83d7bd0ed2653cc'],
  ['t0bg', 'fe0324736707ffdaeee94601ccdeab47'],
  ['t1bg', '452f45a10acb4bf8344d5762d2513552'],
  ['t1bg', '5afc4dd97e556d97c9e6bcaff9d39d97'],
  ['t1bg', 'a2f9bb0aaf23aa3a33c5f92e593179cb'],
  ['t1bg', 'b07324b72d6f7502f87c0b5e4e6cae27'],
  ['t1bg', 'f2ed85be071965b898bd8e82c094b535'],
  ['t2bg', '9de6854dbdc01ba0f5c41c49d7f0334c'],
  ['t3bg', '95ffec43c0c6a2d61e2633b613ba7158'],
  ['t3bg', 'cf24945a056f8d723a7752a4a25f623e'],
  ['t4bg', '01ef2b9ce50b592b75d38329a836d822'],
  ['t5bg', '1c534af11f2ea1fd5983f716ee990351'],
  ['t6bg', '04d6a6b3a5610305b485a2ffffef9ec0'],
  ['t6bg', '169f2d0516940c036ddbf91750195445'],
  ['t7bg', '2d98349067ba0191703d2e1813bf7162'],
];

const times = ['20101210093455', '20101201', '20110101', '20110601'];
const isImage = (b) => b.length > 100 && ((b[0] === 0x89 && b[1] === 0x50) || (b[0] === 0xff && b[1] === 0xd8));

let hit = null;
for (const [host, hash] of hashes) {
  if (hit) break;
  for (const ts of times) {
    if (hit) break;
    try {
      const r = await fetch(`${WB}/${ts}im_/http://${host}.roblox.com/${hash}`, {
        headers: { 'user-agent': 'mirror' }, redirect: 'follow',
      });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (!isImage(buf)) continue;
      hit = { host, hash, buf, ts };
    } catch { /* next */ }
  }
}

if (!hit) {
  console.log('no archived thumbnail found');
} else {
  console.log(`hit ${hit.host}/${hit.hash} @${hit.ts} ${hit.buf.length}b`);
  const dest = join(SITE, `ext/${hit.host}.roblox.com/${hit.hash}.png`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, hit.buf);
  console.log('wrote', dest);
}
