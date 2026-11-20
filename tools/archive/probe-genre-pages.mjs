// Probes Wayback for the nine genre landing pages the 2010 nav links to.
// They are the only remaining p/ URLs in the dead list that are not item pages.
const names = [
  'building-games', 'horror-games', 'military-games', 'comedy-games',
  'naval-games', 'fps-games', 'rpg-games', 'fighting-games', 'western-games',
];

const lines = [];
for (const name of names) {
  const url = `https://web.archive.org/web/20101210093455id_/http://www.roblox.com/${name}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    lines.push(`${name} ${res.status} ${res.headers.get('content-type') ?? '-'}`);
  } catch (err) {
    lines.push(`${name} ERR ${err.message}`);
  }
}

await writeFile('tools/_genre-probe.txt', lines.join('\n') + '\n');
console.log(lines.join('\n'));
