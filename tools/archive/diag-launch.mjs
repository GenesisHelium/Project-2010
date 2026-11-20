// Reports pages that call RobloxLaunch without loading place-launcher.js.
//
// place-launcher.js defines the namespace. A page that assigns to RobloxLaunch
// but does not include the script throws on load, because the inline
// Sys.Application callback runs after every script tag has executed.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function* walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) yield* walk(join(dir, entry.name), rel);
    else yield rel;
  }
}

const missing = [];
for await (const rel of walk('site')) {
  const text = await readFile(join('site', rel), 'utf8');
  if (!/\bRobloxLaunch\b/.test(text)) continue;
  if (/place-launcher\.js/i.test(text)) continue;
  missing.push(rel);
}

console.log(`pages using RobloxLaunch without the launcher: ${missing.length}`);
for (const p of missing.slice(0, 40)) console.log(`  ${p}`);
