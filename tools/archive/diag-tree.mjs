// Inventories the page tree so duplicates between the two crawl naming schemes are
// visible before anything is consolidated.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';

const SITE = 'site';

async function walk(dir, prefix = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await walk(join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

const files = await walk(join(SITE, 'p'));

const withExt = files.filter((f) => /\.html?$/i.test(f));
const withoutExt = files.filter((f) => !/\.html?$/i.test(f));

const lowerNoExt = new Set(withoutExt.map((f) => f.toLowerCase()));
const lowerWithExt = new Set(withExt.map((f) => f.toLowerCase()));

const twins = withExt.filter((f) => lowerNoExt.has(f.toLowerCase().replace(/\.html?$/i, '')));

console.log(`p/ files: ${files.length}`);
console.log(`  extensionless: ${withoutExt.length}`);
console.log(`  .html:         ${withExt.length}`);
console.log(`  twins (same page in both schemes): ${twins.length}`);

// Compare one pair to see whether the duplicates differ in substance.
const sample = twins.slice(0, 3);
for (const t of sample) {
  const noExt = t.replace(/\.html?$/i, '');
  const a = await stat(join(SITE, 'p', t));
  const b = await stat(join(SITE, 'p', noExt));
  console.log(`  ${t}: html=${a.size}b  plain=${b.size}b`);
}

// Pages referenced by the routing table, and whether the file is really there.
const pages = JSON.parse(await readFile(join(SITE, '_pages.json'), 'utf8'));
let missing = 0;
for (const [, local] of pages) {
  try { await stat(join(SITE, local)); } catch { missing++; }
}
console.log(`routing entries: ${pages.length}, files absent: ${missing}`);
