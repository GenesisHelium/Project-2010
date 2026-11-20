// Shows what archive references survive in the pages the normaliser just ran
// over, grouped by the shape of the surrounding markup.
import { readFile } from 'node:fs/promises';

const PAGES = ['p/building-games', 'p/comedy-games', 'p/military-games', 'p/naval-games',
  'p/Parents/BuildersClub.aspx', 'p/Parents/KeepingKidsSafe.aspx', 'p/My/Home.aspx'];

for (const page of PAGES) {
  const body = await readFile(`site/${page}`, 'utf8');
  const hits = [...body.matchAll(/.{40}\/web\/\d{14}[^"' <>]{0,60}/g)].map((m) => m[0]);
  console.log(`\n${page}: ${hits.length}`);
  const seen = new Set();
  for (const h of hits) {
    const shape = h.replace(/\d{14}/, '<ts>').replace(/\d{6,}/g, '<n>');
    if (seen.has(shape)) continue;
    seen.add(shape);
    console.log('   ...' + shape.slice(0, 120));
  }
}
