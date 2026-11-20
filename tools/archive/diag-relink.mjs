// Probes one href through relink's resolution path to see where it gives up.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const SITE = 'site';
const pages = JSON.parse(await readFile(join(SITE, '_pages.json'), 'utf8'));

const byFull = new Map();
const byPath = new Map();
for (const [url, local] of pages) {
  const u = new URL(url);
  byFull.set((u.pathname + u.search).toLowerCase(), local);
  const p = u.pathname.toLowerCase();
  if (!byPath.has(p)) byPath.set(p, local);
}

const onDisk = new Set();
async function indexTree(dir, prefix = '') {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) await indexTree(join(dir, e.name), rel);
    else onDisk.add(rel.toLowerCase());
  }
}
await indexTree(SITE);

console.log('onDisk size', onDisk.size);
console.log('has images/joinbuildersclubnow.png:', onDisk.has('images/joinbuildersclubnow.png'));
console.log('has p/games.aspx.html:', onDisk.has('p/games.aspx.html'));
console.log('byPath /games.aspx:', byPath.get('/games.aspx'));
console.log('byFull /games.aspx:', byFull.get('/games.aspx'));

const target = join(SITE, 'p/Upgrades/BuildersClub.aspx.html');
console.log('target exists:', await stat(target).then(() => true).catch(() => false));
const text = await readFile(target, 'utf8');
const hrefs = [...text.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
console.log('href count', hrefs.length);
console.log('sample', hrefs.slice(0, 12));
console.log('joinbuilders present:', hrefs.filter((h) => h.includes('JoinBuilders')));
