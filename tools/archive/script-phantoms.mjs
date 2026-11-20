// Counts <script occurrences that live inside a JavaScript string, because a
// naive tag count treats those as opens while the escaped <\/script> never
// balances them. Used to explain the script:31/29 figure on the genre pages.
import { readFile } from 'node:fs/promises';

const PAGES = ['building-games', 'comedy-games', 'military-games', 'naval-games'];

for (const page of PAGES) {
  const body = await readFile(`site/p/${page}`, 'utf8');
  const lines = body.split('\n');
  const opens = (body.match(/<script\b/gi) || []).length;
  const closes = (body.match(/<\/script>/gi) || []).length;

  const phantoms = [];
  lines.forEach((line, i) => {
    if (/document\.write\([^)]*<script/i.test(line)) {
      phantoms.push(i + 1);
    }
  });

  console.log(`${page.padEnd(16)} opens ${opens}  closes ${closes}  gap ${opens - closes}  phantom lines ${phantoms.join(', ')}`);
  for (const n of phantoms) console.log(`  ${n}: ${lines[n - 1].trim().slice(0, 150)}`);
}
