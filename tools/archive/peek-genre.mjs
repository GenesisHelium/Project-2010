import { readFileSync, existsSync } from 'node:fs';

for (const n of ['horror-games', 'fps-games', 'rpg-games', 'fighting-games', 'western-games']) {
  const p = 'site/p/' + n;
  if (!existsSync(p)) { console.log(n, 'MISSING'); continue; }
  const s = readFileSync(p, 'utf8');
  const refs = [...s.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  const uniq = [...new Set(refs)];
  const abs = uniq.filter((r) => r.startsWith('http'));
  const web = uniq.filter((r) => r.includes('/web/'));
  console.log(`${n} ${s.length} bytes, ${uniq.length} unique refs, ${web.length} web-archive, ${abs.length} absolute`);
  console.log('  ' + uniq.slice(0, 8).join('\n  '));
}
