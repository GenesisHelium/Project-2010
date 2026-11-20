// Prints the rules that draw the blue 18px header button, so its height,
// padding and background can be aligned with the artwork.
import { readFile } from 'node:fs/promises';

const css = await readFile('site/css/allcss.css', 'utf8');
let at = -1;
while ((at = css.indexOf('btn_blue18h', at + 1)) >= 0) {
  const start = css.lastIndexOf('}', at) + 1;
  const end = css.indexOf('}', at) + 1;
  console.log(`\n@${at}`);
  console.log(css.slice(start, end).slice(0, 420));
}
