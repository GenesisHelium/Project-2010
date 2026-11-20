// Trims the genre landing pages down to the ones the archive actually holds at a
// date near the mirror's target. The rest are 2012 pages or Wayback debris with a
// 2012 stylesheet version; a 2012 page inside a December 2010 mirror would be a
// worse lie than an honest 404.
import { readFileSync, unlinkSync, existsSync } from 'node:fs';

const DROP = [
  'building-games', 'comedy-games', 'military-games', 'naval-games',
  'fps-games', 'rpg-games', 'fighting-games',
];

for (const name of DROP) {
  const p = `site/p/${name}`;
  if (!existsSync(p)) { console.log(`${name}: absent`); continue; }
  const s = readFileSync(p, 'utf8');
  const stamp = (s.match(/\/web\/(\d{14})/) || [, ''])[1];
  const allcss = (s.match(/AllCSS\.ashx\?v=([^&"]*)/) || [, '-'])[1];
  unlinkSync(p);
  console.log(`${name}: removed (capture ${stamp || '2012-era'}, allcss ${allcss})`);
}

for (const name of ['horror-games', 'western-games']) {
  const s = readFileSync(`site/p/${name}`, 'utf8');
  console.log(`${name}: kept, ${s.length} bytes`);
}
