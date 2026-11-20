// Fetches the assets referenced by pages that were added after the main crawl.
//
// The archive served these pages unrewritten, so their links are still relative to
// the original site root. relink.mjs has already pointed them at local paths; this
// walks those local paths, and for any that are not on disk, asks the archive for
// the original URL one more time.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const SITE = 'site';
const ORIGIN = 'http://www.roblox.com';
const WB = 'https://web.archive.org/web/2010id_';

// The pages added by mirror-genre-pages.mjs, with the URL each was served from.
const PAGES = [
  'horror-games', 'fps-games', 'rpg-games', 'fighting-games', 'western-games',
];

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

let fetched = 0;
let missed = 0;
const missing = [];

for (const name of PAGES) {
  const file = join(SITE, 'p', name);
  let html;
  try { html = await readFile(file, 'utf8'); } catch { continue; }

  const refs = new Set();
  for (const m of html.matchAll(/(?:href|src)="(\/[^"]+)"/g)) {
    const ref = m[1].split('#')[0].split('?')[0];
    if (ref.startsWith('//')) continue;
    refs.add(ref);
  }

  for (const ref of refs) {
    const local = ref.replace(/^\/+/, '');
    if (local.startsWith('p/')) continue;
    if (local.startsWith('ext/')) continue;
    if (await exists(join(SITE, local))) continue;

    try {
      const res = await fetch(`${WB}/${ORIGIN}${ref}`, {
        headers: { 'user-agent': 'mirror' }, redirect: 'follow',
      });
      if (!res.ok) { missed++; missing.push(`${name}: ${ref} ${res.status}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 20) { missed++; missing.push(`${name}: ${ref} empty`); continue; }
      await mkdir(dirname(join(SITE, local)), { recursive: true });
      await writeFile(join(SITE, local), buf);
      fetched++;
    } catch (err) {
      missed++;
      missing.push(`${name}: ${ref} ${err.message}`);
    }
  }
}

console.log(`fetched ${fetched}, missed ${missed}`);
for (const m of missing) console.log('  ' + m);
