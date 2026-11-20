// Groups the dead list by path prefix so a routing bug is distinguishable from
// the honest 404s the archive never captured.
import { readFile } from 'node:fs/promises';

const dead = JSON.parse(await readFile('tools/_dead.json', 'utf8'));
const paths = Array.isArray(dead) ? dead : Object.values(dead);

const underP = paths.filter((p) => p.startsWith('/p/'));
const ext = {};
for (const p of underP) {
  const leaf = p.slice(p.lastIndexOf('.'));
  const key = /^\.[a-z0-9]{1,6}$/i.test(leaf) ? leaf.toLowerCase() : '(none)';
  ext[key] = (ext[key] || 0) + 1;
}

console.log(`total dead ${paths.length}`);
console.log(`under /p/ ${underP.length}`);
console.log(ext);
console.log('\nfirst 20 under /p/:');
console.log(underP.slice(0, 20).join('\n'));
