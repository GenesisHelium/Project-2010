// Reports, for each genre landing page, which archive capture the mirror would get
// and when that capture was actually taken. A 2012 capture is not a 2010 page: the
// mirror is a 2010 snapshot, so only period-correct captures are worth keeping.
import { existsSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

const NAMES = [
  'horror-games', 'fps-games', 'rpg-games', 'fighting-games', 'western-games',
  'building-games', 'comedy-games', 'military-games', 'naval-games',
];

const lines = [];

for (const name of NAMES) {
  const local = `site/p/${name}`;
  const size = existsSync(local) ? statSync(local).size : 0;
  let when = '-';
  let status = '-';
  try {
    const res = await fetch(`https://web.archive.org/web/20101210093455id_/http://www.roblox.com/${name}`, {
      headers: { 'user-agent': 'mirror' }, redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });
    status = String(res.status);
    when = res.headers.get('memento-datetime') || res.headers.get('x-archive-orig-date') || '?';
  } catch (err) {
    status = 'ERR';
    when = err.message;
  }
  lines.push(`${name.padEnd(16)} local=${String(size).padStart(7)}  status=${status.padEnd(4)} capture=${when}`);
}

await writeFile('tools/_genre-dates.txt', lines.join('\n') + '\n');
console.log(lines.join('\n'));
