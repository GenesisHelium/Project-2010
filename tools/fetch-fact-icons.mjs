// The home page's random-facts rotator asks for eight 16px icons. Only Admin.png
// survived the crawl; the rest are fetched here from their own image captures.
import { writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';

const NAMES = ['Shirt', 'Admin', 'House', 'Shield', 'Pants', 'Bux', 'ShoppingBag'];

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

const isImage = (b) => b.length > 60 && (
  (b[0] === 0x89 && b[1] === 0x50) ||
  (b[0] === 0xff && b[1] === 0xd8) ||
  (b[0] === 0x47 && b[1] === 0x49));

for (const name of NAMES) {
  const dest = join(SITE, 'images', 'RandomFactsIcons', `${name}.png`);
  if (await exists(dest)) continue;

  const source = `http://www.roblox.com/images/RandomFactsIcons/${name}.png`;
  let got = false;
  for (const stamp of ['20101210093455', '201012', '201101', '2011', '']) {
    if (got) break;
    try {
      const r = await fetch(`${WB}/${stamp}im_/${source}`, {
        headers: { 'user-agent': 'mirror' }, redirect: 'follow',
      });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (!isImage(buf)) continue;
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      console.log(`fetched ${name}.png (${buf.length}b @${stamp || 'latest'})`);
      got = true;
    } catch { /* next stamp */ }
  }
  if (!got) console.log(`miss    ${name}.png`);
}
