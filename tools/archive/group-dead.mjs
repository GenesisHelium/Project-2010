// Groups the dead links from check-server.mjs by the shape of the request, so
// the report distinguishes "catalogue page the archive never took" from
// "navigation broke".
import { readFile, writeFile } from 'node:fs/promises';

const rows = JSON.parse(await readFile(new URL('./_dead.json', import.meta.url), 'utf8'));

const groups = new Map();
for (const r of rows) {
  let key = 'other';
  if (/\?/.test(r) && /item/i.test(r)) key = 'item (query)';
  else if (/-(item|place)(\/|$)/i.test(r)) key = 'item (friendly)';
  else if (/badge/i.test(r)) key = 'badge';
  else if (/^\/Forum\//i.test(r)) key = 'forum';
  else if (/^\/Item\.aspx/i.test(r)) key = 'Item.aspx';
  else if (/^\/p\//.test(r)) key = 'p/ page';
  groups.set(key, (groups.get(key) || 0) + 1);
}

console.log(`dead: ${rows.length}`);
for (const [k, v] of [...groups.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(5)}  ${k}`);
}

const interesting = rows.filter((r) =>
  !/item/i.test(r) && !/badge/i.test(r) && !/^\/Forum\//i.test(r));
await writeFile(new URL('./_dead-interesting.json', import.meta.url), JSON.stringify(interesting, null, 1));
console.log(`\nnon-catalogue, non-forum: ${interesting.length}`);
for (const r of interesting.slice(0, 80)) console.log(`  ${r}`);
