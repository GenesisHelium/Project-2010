// Moves the four 2012-era genre pages out of the served tree.
//
// They were pulled from 2012 captures and carry the archive runtime and
// `/web/2012…` references, so they serve the wrong-era build and add 128 dead
// links to every crawl. Copies are kept in tools/quarantine/ so nothing is lost;
// the mirror answers an honest 404 for those four URLs instead.
import { copyFile, mkdir, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';

const PAGES = ['building-games', 'comedy-games', 'military-games', 'naval-games'];
const OUT = join('tools', 'quarantine');

await mkdir(OUT, { recursive: true });

const size = async (p) => { try { return (await stat(p)).size; } catch { return 0; } };

for (const name of PAGES) {
  const from = join('site', 'p', name);
  const bytes = await size(from);
  if (!bytes) { console.log(`${name}: not in site/p`); continue; }
  await copyFile(from, join(OUT, name));
  await unlink(from);
  console.log(`${name}: ${bytes} bytes moved to tools/quarantine/${name}`);
}
