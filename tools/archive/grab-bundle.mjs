// Pulls the ScriptResource bundle from any nearby capture that has one, since the
// signed descriptor rotates per deployment and the December one was never archived.
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';

const dates = ['20101205', '20101208', '20101212', '20101215', '20101220', '20101201', '20101125'];

const jars = [
  { name: 'js/scriptresource-cmaa.js', picks: [] },
];

const found = [];

for (const d of dates) {
  const pageUrl = `${WB}/${d}000000id_/http://www.roblox.com/`;
  let html;
  try {
    const r = await fetch(pageUrl, { headers: { 'user-agent': 'mirror' } });
    if (!r.ok) continue;
    html = await r.text();
  } catch { continue; }

  const re = /ScriptResource\.axd\?d=([A-Za-z0-9_-]{300,})/g;
  let m;
  while ((m = re.exec(html))) found.push({ d, desc: m[1] });
}

console.log(`candidates: ${found.length}`);

for (const { d, desc } of found) {
  for (const ts of [...new Set([d + '000000', '20101210093455', '20101208', '20101220'])]) {
    const url = `${WB}/${ts}js_/http://www.roblox.com/ScriptResource.axd?d=${desc}`;
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'mirror' }, redirect: 'follow' });
      if (!r.ok) continue;
      const txt = await r.text();
      if (txt.length < 50000) continue;
      if (!txt.includes('jQuery') || !txt.includes('Type.registerNamespace')) continue;
      console.log(`HIT ${d} ts=${ts} bytes=${txt.length}`);
      // Strip the Wayback runtime wrapper before storing.
      const clean = stripWombat(txt);
      const dest = join(SITE, 'js/scriptresource-cmaa.js');
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, clean);
      console.log(`wrote ${dest} (${clean.length} bytes)`);
      process.exit(0);
    } catch { /* next */ }
  }
}

console.log('no usable bundle found');

function stripWombat(src) {
  // Wayback injects a prologue that re-declares window/self/document and a
  // matching epilogue closing the block. Both must go or the script misbehaves.
  const start = src.indexOf('var _____WB$wombat$assign$function_____');
  if (start === -1) return src;
  const open = src.indexOf('{', src.indexOf('__WB_pmw'));
  if (open === -1) return src;
  // Find the matching closing brace of the injected block.
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(0, start) + src.slice(i + 1);
}
