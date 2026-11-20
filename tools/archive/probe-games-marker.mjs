// Confirms the games entry marker matches the captured markup byte for byte.
import { readFile } from 'node:fs/promises';

const html = await readFile('site/p/Games.aspx', 'utf8');
const markers = [
  '<div style="height: 175px; width: 180px; float: left;">',
  'height: 175px',
  'width: 180px',
  'float: left',
];

for (const m of markers) {
  const at = html.indexOf(m);
  console.log(`${at}\t${JSON.stringify(m)}`);
  if (at < 0 && m.length > 12) {
    const near = html.indexOf(m.slice(0, 20));
    console.log('  partial at', near, near >= 0 ? JSON.stringify(html.slice(near, near + 90)) : '');
  }
}
