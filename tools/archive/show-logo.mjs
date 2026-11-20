// Prints the #Logo anchor from pages that use the small header, to see whether
// any of them still carry the logo image.
import { readFile } from 'node:fs/promises';

const pages = [
  'site/p/Login/Default.aspx',
  'site/p/Friends.aspx',
  'site/p/Groups/group.aspx',
  'site/p/My/Home.aspx',
  'site/p/Login/NewAge.aspx',
];

for (const page of pages) {
  const body = await readFile(page, 'utf8');
  const at = body.indexOf('id="Logo"');
  console.log(`\n=== ${page}  ${at}`);
  if (at >= 0) console.log(JSON.stringify(body.slice(Math.max(0, at - 160), at + 280)));
}
