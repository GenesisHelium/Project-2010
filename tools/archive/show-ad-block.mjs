// Prints the leaderboard ad block from a page so the removal markers can be
// chosen from the real markup rather than guessed.
import { readFile } from 'node:fs/promises';

const file = process.argv[2] || 'site/p/Catalog.aspx';
const body = await readFile(file, 'utf8');
const i = body.indexOf('<div id="AdvertisingLeaderboard">');
console.log('index', i);
if (i < 0) process.exit(0);
console.log(body.slice(Math.max(0, i - 200), i + 1500));
