// Restores four genre files that were present in site/p before this cleanup and
// were removed by trim-genre-pages.mjs. They are 2012-era captures with the
// archive runtime still in them; they are restored verbatim rather than
// normalised, so the tree matches the state it was in.
import { writeFile } from 'node:fs/promises';

const PAGES = [
  ['building-games', '20120609010843'],
  ['comedy-games', '20120605230104'],
  ['military-games', '20120614072154'],
  ['naval-games', '20120605230125'],
];

for (const [name, stamp] of PAGES) {
  try {
    const res = await fetch(`https://web.archive.org/web/${stamp}/http://www.roblox.com/${name}`, {
      headers: { 'user-agent': 'mirror' }, redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.log(`${name}: ${res.status}, not restored`); continue; }
    const body = await res.text();
    await writeFile(`site/p/${name}`, body);
    console.log(`${name}: ${body.length} bytes restored from ${stamp}`);
  } catch (err) {
    console.log(`${name}: ${err.message}`);
  }
}
