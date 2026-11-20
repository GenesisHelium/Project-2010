// A dead path that already exists on disk is a routing gap, not an honest 404.
// Cross-checks every /p/ dead link against the served tree, case-insensitively.
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const dead = JSON.parse(await readFile('tools/_dead.json', 'utf8'));
const paths = Array.isArray(dead) ? dead : Object.values(dead);

const index = new Map();
async function walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await walk(join(dir, entry.name), rel);
    else index.set(rel.toLowerCase(), rel);
  }
}
await walk('site');

const mismatches = [];
for (const p of paths) {
  if (!p.startsWith('/p/')) continue;
  const key = p.slice(1).split('?')[0].toLowerCase();
  if (index.has(key)) mismatches.push({ url: p, file: index.get(key) });
}

console.log(`${paths.length} dead; ${mismatches.length} /p/ dead links resolve to a file on disk`);
for (const m of mismatches.slice(0, 30)) console.log(`${m.url}\n   -> site/${m.file}`);
