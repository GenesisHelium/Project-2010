// Prints the home page's login panel and promo panel bodies with every child
// whose own height is set, to see what is holding the empty space open.
import { readFile } from 'node:fs/promises';

const html = await readFile('site/p/Default.aspx', 'utf8');
const start = html.indexOf('<!-- left column -->');
const end = html.indexOf('<!-- right column -->');
const body = html.slice(start, end);
const lines = body.split('\n');
lines.forEach((line, i) => {
  if (/height: \d+px|DarkGradientBox|DGB_|Content"|ShadowedStandardBox|Promo|promo|object|iframe|img /.test(line)) {
    console.log(String(i + 1).padStart(4), line.trim().slice(0, 190));
  }
});
