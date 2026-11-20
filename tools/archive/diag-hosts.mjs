// Lists the external hosts one or more pages reference, and how often.
import { readFile } from 'node:fs/promises';

const counts = new Map();
for (const file of process.argv.slice(2)) {
  const text = await readFile(file, 'utf8');
  for (const m of text.matchAll(/(?:src|href|action)="(https?:\/\/[^"]+)"/g)) {
    const host = new URL(m[1]).hostname;
    counts.set(host, (counts.get(host) || 0) + 1);
  }
}

if (!counts.size) console.log('no external hosts');
for (const [host, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${host}`);
