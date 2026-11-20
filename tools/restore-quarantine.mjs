// Restores the four preserved 2012-era genre pages to the served tree.
// They live in tools/quarantine/ after having been moved out; this copies them
// back byte for byte.
import { copyFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const PAGES = ['building-games', 'comedy-games', 'military-games', 'naval-games'];

const size = async (p) => { try { return (await stat(p)).size; } catch { return 0; } };

for (const name of PAGES) {
  const from = join('tools', 'quarantine', name);
  const bytes = await size(from);
  if (!bytes) { console.log(`${name}: nothing in quarantine`); continue; }
  await copyFile(from, join('site', 'p', name));
  console.log(`${name}: ${bytes} bytes restored to site/p/${name}`);
}
