import { readFileSync } from 'node:fs';

const NAMES = ['building-games', 'horror-games', 'military-games', 'comedy-games',
  'naval-games', 'fps-games', 'rpg-games', 'fighting-games', 'western-games'];

for (const n of NAMES) {
  const s = readFileSync(`site/p/${n}`, 'utf8');
  const web = (s.match(/\/web\/\d{14}/g) || []).length;
  const wombat = (s.match(/wombat|__WB_pmw|web-static\.archive\.org/g) || []).length;
  const title = (s.match(/<title>([\s\S]{0,90})/) || [, ''])[1].replace(/\s+/g, ' ').trim();
  const allcss = (s.match(/AllCSS\.ashx\?v=([^&"]*)/) || [, '-'])[1];
  console.log(`${n.padEnd(16)} web=${web} wombat=${wombat} allcss=${allcss}  ${title}`);
}
