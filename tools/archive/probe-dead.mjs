// Checks whether specific paths are present in the last crawl's dead list, and
// re-requests them live so a stale crawl can be told apart from a stale server.
import { readFile } from 'node:fs/promises';

const probes = ['/horror-games', '/western-games', '/games', '/Catalog',
  '/building-games', '/fps-games', '/chat/chat.css'];

const dead = new Set(JSON.parse(await readFile('tools/_dead.json', 'utf8')));
for (const p of probes) {
  const res = await fetch('http://localhost:2010' + p, { redirect: 'manual' });
  console.log(`${p.padEnd(18)} live=${res.status}  inDeadJson=${dead.has(p)}`);
}
console.log(`dead.json entries: ${dead.size}`);
