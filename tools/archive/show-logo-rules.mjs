// Lists every #Logo / #Banner / #SmallHeaderContainer rule in the stylesheet
// with its byte offset, so the late small-header block is visible in order.
import { readFile } from 'node:fs/promises';

const css = await readFile('site/css/allcss.css', 'utf8');
const needle = /#Logo[^a-zA-Z0-9_-]/g;
let m;
while ((m = needle.exec(css))) {
  const start = css.lastIndexOf('}', m.index) + 1;
  const end = css.indexOf('}', m.index) + 1;
  console.log(`\n@${m.index}`);
  console.log(css.slice(start, end).slice(0, 400));
}
