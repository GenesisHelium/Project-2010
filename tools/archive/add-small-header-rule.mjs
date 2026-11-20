// Appends the one missing rule the capture lost: pages that use the small
// header variant place #Header absolutely, but #SmallHeaderContainer has no
// positioning context in the archived stylesheet, so the header escapes to the
// page bottom. Restoring the context keeps the header at the top.
import { readFile, writeFile } from 'node:fs/promises';

const file = 'site/css/allcss.css';
const marker = '/* reconstructed: small header positioning context */';
const body = await readFile(file, 'utf8');

if (body.includes(marker)) {
  console.log('rule already present');
  process.exit(0);
}

const rule = [
  '',
  marker,
  '#SmallHeaderContainer{position:relative;width:900px;height:130px;}',
  ''
].join('\n');

await writeFile(file, body + rule);
console.log(`appended ${rule.length} bytes to ${file}`);
