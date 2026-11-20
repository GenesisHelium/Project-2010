// Asks the Wayback CDX index whether a page was ever captured at any timestamp.
// The playback URL can answer 200 with an interstitial even when nothing exists,
// so the index is the only reliable answer.
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');

const dead = JSON.parse(await readFile(join(SITE, '_unavailable.json'), 'utf8'));

const found = [];
const never = [];

async function cdx(url) {
  const q = `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=3&filter=statuscode:200`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(q, { headers: { 'user-agent': 'mirror' } });
      if (r.status === 504 || r.status === 503) { continue; }
      if (!r.ok) return null;
      const rows = await r.json();
      if (!Array.isArray(rows) || rows.length < 2) return [];
      return rows.slice(1).map((row) => ({ ts: row[1], original: row[2] }));
    } catch {
      /* retry */
    }
  }
  return null;
}

let index = 0;
for (const [url, local] of dead) {
  index++;
  const hits = await cdx(url);
  if (hits === null) { console.log(`?     ${url}`); continue; }
  if (!hits.length) { never.push([url, local]); continue; }
  found.push([url, local, hits[0]]);
  console.log(`HIT   ${hits[0].ts}  ${url}`);
  if (index % 20 === 0) console.log(`-- ${index}/${dead.length}`);
}

await writeFile(join(SITE, '_recoverable.json'), JSON.stringify(found, null, 2));
await writeFile(join(SITE, '_never-captured.json'), JSON.stringify(never, null, 2));

console.log(`\nrecoverable: ${found.length}`);
console.log(`never captured: ${never.length}`);
