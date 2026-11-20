// Compares the genre pages' game-entry markup with the main games page so the
// reset pass can target them with the same rule instead of a new guess.
import { readFile } from 'node:fs/promises';

const files = [
  'site/p/all-games',
  'site/p/town-and-city-games',
  'site/p/medieval-games',
  'site/p/gametutorials-games',
];

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const entries = html.match(/<div style="height: 175px; width: 180px; float: left;">/g) || [];
  const spacer = html.indexOf('<div style="height: 70px;">');
  const repeater = html.indexOf('GamesRepeater_ctl');
  console.log(`\n=== ${file}  ${html.length} bytes`);
  console.log(`entries ${entries.length}  spacer ${spacer}  repeater ${repeater}`);
  const at = html.indexOf('GamesRepeater_ctl');
  if (at >= 0) console.log(JSON.stringify(html.slice(Math.max(0, at - 320), at + 120)));
}
