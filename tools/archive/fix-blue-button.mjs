// Aligns the blue header button with its artwork. The rule set an 18px height
// on an inline anchor, so the height was ignored, the 2px vertical padding won,
// and the 18px background was cropped to a 15px box with the label sitting low.
import { readFile, writeFile } from 'node:fs/promises';

const file = 'site/css/allcss.css';
const before = '#Banner #Authentication a{height:18px;';
const after = '#Banner #Authentication a{display:inline-block;box-sizing:border-box;height:18px;line-height:18px;vertical-align:middle;';

const css = await readFile(file, 'utf8');
if (!css.includes(before)) {
  console.error('rule not found');
  process.exit(1);
}

let next = css.replace(before, after);
const pad = '#Banner #Authentication a{display:inline-block;box-sizing:border-box;height:18px;line-height:18px;vertical-align:middle;background:url("/css/btn_blue18h.png") repeat-x;background-position:0 0;margin:0 5px;font-weight:bold;font-size:10px;padding:2px 5px;}';
next = next.replace(pad, pad.replace('padding:2px 5px;', 'padding:0 5px;'));

await writeFile(file, next);
console.log(`padding fixed: ${next.includes('padding:0 5px;}')}`);
