// Summarises tools/_dead.json: how many dead targets sit under each prefix, and
// whether the genre roots the server now resolves are still being counted.
import { readFile } from 'node:fs/promises';

const dead = JSON.parse(await readFile('tools/_dead.json', 'utf8'));
const buckets = new Map();

for (const target of dead) {
  const clean = target.split('?')[0].split('#')[0];
  const parts = clean.split('/').filter(Boolean);
  const key = '/' + (parts[0] || '');
  buckets.set(key, (buckets.get(key) || 0) + 1);
}

console.log(`dead total: ${dead.length}`);
for (const [key, count] of [...buckets].sort((a, b) => b[1] - a[1])) {
  console.log(String(count).padStart(5), key);
}

const genres = ['/horror-games', '/western-games', '/building-games', '/comedy-games',
  '/military-games', '/naval-games', '/fps-games', '/rpg-games', '/fighting-games'];
console.log('\ngenre roots still listed as dead:');
for (const g of genres) console.log(' ', g, dead.includes(g) ? 'DEAD' : 'ok');

console.log('\nfirst 25');
for (const d of dead.slice(0, 25)) console.log(' ', d);
