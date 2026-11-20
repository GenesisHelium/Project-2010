// Drops inline IE6Hack calls whose target element is no longer in the page.
// The archived pages bake one call per catalog/game tile; once the tiles are
// removed those calls pass null to the shim, which is a console error on load.
import { readFile, writeFile, readdir, mkdir, copyFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const DRY = process.argv.includes('--dry');
const CALL = /Roblox\.Controls\.Image\.IE6Hack\(\$get\('([^']+)'\)\);/g;

async function* walkHtml(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkHtml(full);
    else if (/\.(html|aspx)$/i.test(entry.name) || !/\.[a-z0-9]{1,5}$/i.test(entry.name)) yield full;
  }
}

let files = 0;
let calls = 0;

for await (const file of walkHtml('site')) {
  const before = await readFile(file, 'utf8');
  let removed = 0;

  const after = before.replace(CALL, (match, id) => {
    if (before.includes(`id="${id}"`)) return match;
    removed++;
    return '';
  });

  if (!removed) continue;

  files++;
  calls += removed;
  console.log(`${file}  ${removed} stale IE6Hack call(s)`);
  if (DRY) continue;
  const backup = join('tools/pre-reset', file.replace(/^site[\\/]/, ''));
  await mkdir(dirname(backup), { recursive: true });
  // Keep the first backup: a re-run must not clobber the pristine capture.
  try { await access(backup); } catch { await copyFile(file, backup); }
  await writeFile(file, after);
}

console.log(`\n${files} file(s), ${calls} call(s) removed${DRY ? ' (dry run)' : ''}`);
