// Shows the leftover fixed-height wrapper the game list used to fill.
import { readFile } from 'node:fs/promises';

const html = await readFile('site/p/games.aspx', 'utf8');
const marker = '<div style="height: 70px;">';
const at = html.indexOf(marker);
console.log('index', at);
console.log(JSON.stringify(html.slice(Math.max(0, at - 200), at + 300)));
