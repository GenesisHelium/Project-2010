// Lists dead links under a prefix from tools/_dead.json.
// Usage: node tools/archive/dead-list.mjs /web
import { readFile } from 'node:fs/promises';

const prefix = process.argv[2] || '/web';
const limit = Number(process.argv[3] || 40);
const dead = JSON.parse(await readFile('tools/_dead.json', 'utf8'));
const hits = dead.filter((d) => d.startsWith(prefix));
console.log(`${hits.length} dead under ${prefix}`);
for (const h of hits.slice(0, limit)) console.log('  ' + h);
