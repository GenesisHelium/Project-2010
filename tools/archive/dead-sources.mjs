// Dumps the dead links in a given prefix bucket, with the page that links them,
// so a fix can be aimed at the source rather than the symptom.
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const prefix = process.argv[2] || '/web';
const dead = JSON.parse(await readFile('tools/_dead.json', 'utf8'));
const targets = dead.filter((d) => d.startsWith(prefix)).slice(0, 40);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (['.html', '.aspx', '.js', '.css'].includes(extname(full))) yield full;
  }
}

const pages = [];
for await (const f of walk('site')) pages.push(f);
const bodies = new Map();
for (const f of pages) bodies.set(f, await readFile(f, 'utf8'));

for (const target of targets) {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hits = [...bodies].filter(([, body]) => body.includes(target) || body.includes(escaped)).slice(0, 3).map(([f]) => f);
  console.log(`${target}\n   ${hits.join('\n   ') || '(no source page found)'}`);
}
