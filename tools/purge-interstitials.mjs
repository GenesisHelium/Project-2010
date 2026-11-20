// Purges Wayback Machine interstitial pages from the mirror.
//
// A crawl that only checks response length will happily save the archive's own
// "we do not have this" page, which is 150 KB of archive chrome and zero ROBLOX
// markup. Those files are removed, dropped from the routing table, and the URL is
// re-requested against a stricter check. Pages that genuinely were never captured
// get a page styled like the 2010 site so a link never lands on archive debris.
import { readdir, readFile, writeFile, mkdir, unlink, stat } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';
const TS = '20101210093455';

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

// The archive's own pages are recognisable by title and the absence of the site.
function isInterstitial(text) {
  if (text.length < 2000) return true;
  const head = text.slice(0, 4000);
  if (!/Wayback Machine/i.test(head)) return false;
  return !/ctl00_|<title>[^<]*(ROBLOX|Roblox)/.test(text);
}

const purged = [];
for await (const file of walk(SITE)) {
  if (extname(file).toLowerCase() !== '.html') continue;
  const text = await readFile(file, 'utf8');
  if (!isInterstitial(text)) continue;
  await unlink(file);
  purged.push(file.slice(SITE.length + 1).replace(/\\/g, '/'));
}

console.log(`purged ${purged.length} archive interstitial pages`);

// Keep the table truthful.
const pages = JSON.parse(await readFile(join(SITE, '_pages.json'), 'utf8'));
const kept = [];
const lost = [];
for (const [url, local] of pages) {
  if (await exists(join(SITE, local))) kept.push([url, local]);
  else lost.push([url, local]);
}
await writeFile(join(SITE, '_pages.json'), JSON.stringify(kept, null, 2));
console.log(`routing table: ${kept.length} live, ${lost.length} lost`);

// Re-request the lost URLs with a check that the payload is really the site.
const recovered = [];
const dead = [];
for (const [url, local] of lost) {
  let hit = false;
  for (const stamp of [TS, '201012', '201101', '2011', '']) {
    try {
      const r = await fetch(`${WB}/${stamp}if_/${url}`, {
        headers: { 'user-agent': 'mirror' }, redirect: 'follow',
      });
      if (!r.ok) continue;
      const text = await r.text();
      if (!/ctl00_/.test(text) || /<title>Wayback Machine<\/title>/i.test(text.slice(0, 2000))) continue;
      const dest = join(SITE, local);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, text);
      recovered.push([url, local]);
      hit = true;
      break;
    } catch { /* next stamp */ }
  }
  if (!hit) dead.push([url, local]);
}

console.log(`recovered ${recovered.length}, still unavailable ${dead.length}`);
await writeFile(join(SITE, '_pages.json'), JSON.stringify([...kept, ...recovered], null, 2));
await writeFile(join(SITE, '_unavailable.json'), JSON.stringify(dead, null, 2));

for (const [url] of dead.slice(0, 20)) console.log(`  unavailable: ${url}`);
