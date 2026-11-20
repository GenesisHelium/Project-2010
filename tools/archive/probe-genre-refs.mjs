// Dumps every distinct archive-relative target inside the four 2012-era genre
// pages, grouped by the attribute that carries it, so the rewrite covers the
// real shapes rather than a sample.
import { readFile } from 'node:fs/promises';

const PAGES = ['building-games', 'comedy-games', 'military-games', 'naval-games'];
const targets = new Map();

for (const name of PAGES) {
  const body = await readFile(`site/p/${name}`, 'utf8');
  const re = /\b(href|src|action|data|value)="([^"]*\/web\/\d{14}[^"]*)"/g;
  for (const m of body.matchAll(re)) {
    const key = m[1] + ' ' + m[2];
    targets.set(key, (targets.get(key) || 0) + 1);
  }
}

console.log(`${targets.size} distinct (attribute, target) pairs`);
for (const [key, count] of [...targets].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(String(count).padStart(3), key.slice(0, 170));
}
