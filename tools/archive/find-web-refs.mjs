// Shows the raw href/src values that point at the archive (/web/...) so the
// pages carrying Wayback leftovers can be fixed rather than counted.
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (['.html', '.aspx'].includes(extname(full))) yield full;
  }
}

let total = 0;
for await (const file of walk('site')) {
  const body = await readFile(file, 'utf8');
  const hits = [...body.matchAll(/(?:href|src)="(\/web\/[^"]+)"/g)].map((m) => m[1]);
  if (!hits.length) continue;
  console.log(`${file}: ${hits.length}`);
  for (const h of hits.slice(0, 6)) console.log('   ' + h);
  total += hits.length;
}
console.log(`total raw /web refs in pages: ${total}`);
