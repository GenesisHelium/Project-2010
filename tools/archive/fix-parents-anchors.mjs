// Scopes the parents-register page's blanket white anchor colour to the header.
// As written it also coloured href-less anchors, which made "Parent Login" and
// "download" white on white.
import { readFile, writeFile } from 'node:fs/promises';

const file = 'site/p/Parents/Register.aspx';
const before = 'a { color: white; }';
const after = '#Header a { color: white; }';

const html = await readFile(file, 'utf8');
if (!html.includes(before)) {
  console.log('pattern already fixed or absent');
  process.exit(0);
}
await writeFile(file, html.replace(before, after));
console.log('scoped to #Header');
