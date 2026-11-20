// Runs the reset tool's div remover against the games page to see where it bails.
import { readFile } from 'node:fs/promises';

const html = await readFile('site/p/Games.aspx', 'utf8');
const start = html.indexOf('<div style="height: 175px; width: 180px; float: left;">');
console.log('start', start);

const cap = 60000;
const limit = Math.min(html.length, start + cap);
let i = start;
let depth = 0;
let steps = 0;
while (i < limit) {
  const open = html.indexOf('<div', i);
  const close = html.indexOf('</div>', i);
  if (close < 0) { console.log('no close after', i); break; }
  if (open >= 0 && open < close) {
    depth++;
    i = open + 4;
  } else {
    depth--;
    i = close + 6;
  }
  steps++;
  if (depth === 0) { console.log('balanced at', i, 'steps', steps, 'len', i - start); break; }
  if (steps > 4000) { console.log('step cap hit, depth', depth, 'i', i); break; }
}
console.log('final i', i, 'limit', limit);
