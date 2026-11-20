// Maps the home page panels so the news, stats and featured-game removals can
// be cut against real markers instead of guessed line ranges.
import { readFile } from 'node:fs/promises';

const html = await readFile('site/p/Default.aspx', 'utf8');
const lines = html.split('\n');
console.log(`bytes ${html.length}, lines ${lines.length}`);

const markers = [
  'Roblox News',
  'Roblox Stats',
  'Featured Free Game',
  'Updated:',
  'Favorited:',
  'Visited:',
  'By:',
  'Play This',
];

lines.forEach((line, i) => {
  for (const m of markers) {
    if (line.includes(m)) {
      console.log(`${String(i + 1).padStart(5)}  ${line.trim().slice(0, 150)}`);
      break;
    }
  }
});
