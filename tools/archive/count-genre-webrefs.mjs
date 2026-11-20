// Lists archive-relative references inside the genre pages, which the crawler
// turns into dead /web/... targets.
import { readFileSync } from 'node:fs';

const NAMES = ['horror-games', 'western-games', 'building-games', 'comedy-games',
  'military-games', 'naval-games'];

for (const name of NAMES) {
  const body = readFileSync(`site/p/${name}`, 'utf8');
  const refs = [...body.matchAll(/(?:href|src)="([^"]*\/web\/\d{14}[^"]*)"/g)].map((m) => m[1]);
  console.log(`${name.padEnd(16)} ${body.length} bytes, ${refs.length} archive refs`);
  for (const r of refs.slice(0, 3)) console.log('    ' + r.slice(0, 130));
}
