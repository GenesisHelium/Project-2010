// Lists the image files the BBB seal sheet and its modal page ask for. They are
// third-party assets the original crawl never followed.
import { readFile } from 'node:fs/promises';

const sources = [
  'site/ext/bbb.org/online/brand/css/popup.css',
  'site/ext/bbb.org/online/brand/css/resizeable_form_table.css',
  'site/ext/bbb.org/online/consumer/cks.aspx',
];

const want = new Set();
for (const file of sources) {
  const body = await readFile(file, 'utf8');
  for (const m of body.matchAll(/url\(["']?([^"')]+)["']?\)/g)) want.add(m[1]);
  for (const m of body.matchAll(/<img[^>]*\bsrc="([^"]+)"/gi)) want.add(m[1]);
}

for (const ref of [...want].sort()) {
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:')) continue;
  console.log(ref);
}
