// Sanity check: does the attribute rewrite actually fire on the real files?
import { readFile } from 'node:fs/promises';

const WRAPPED = /^(?:(?:https?:)?\/\/web\.archive\.org)?\/web\/\d{14}(?:[a-z]{2}_)?\/(.+)$/;

const body = await readFile('site/p/building-games', 'utf8');
const values = [...body.matchAll(/\b(href|src|action)="([^"]*)"/gi)].map((m) => m[2]);
const wrapped = values.filter((v) => v.includes('/web/'));

console.log('attrs', values.length, 'with /web/', wrapped.length);
for (const v of wrapped.slice(0, 5)) {
  const m = v.match(WRAPPED);
  console.log(m ? `MATCH ${m[1].slice(0, 80)}` : `NOMATCH ${v.slice(0, 90)}`);
}
