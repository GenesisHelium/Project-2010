// Prints a line range of a genre page, numbered, so the archive runtime block
// and the tracker block can be read exactly before being removed.
import { readFile } from 'node:fs/promises';

const [page, from, to] = process.argv.slice(2);
const body = await readFile(`site/p/${page}`, 'utf8');
const lines = body.split('\n');
const start = Number(from || 1);
const end = Number(to || 60);

for (let i = start - 1; i < Math.min(end, lines.length); i++) {
  console.log(String(i + 1).padStart(4), lines[i].slice(0, 200));
}
