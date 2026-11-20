// Reports pages that touch RobloxLaunch and load neither place-launcher.js,
// client-installer.js, nor scriptresource-shared.js — i.e. the pages that would
// still throw after the compat blocks land.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function* walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) yield* walk(join(dir, entry.name), rel);
    else yield rel;
  }
}

const covered = [];
const uncovered = [];

for await (const rel of walk('site')) {
  if (!rel.endsWith('.html') && !/\.aspx$/i.test(rel) && rel.includes('.')) {
    // Extensionless page files still count; only skip obvious assets.
    if (/\.(js|css|png|gif|jpg|ico|json|xml|swf|txt)$/i.test(rel)) continue;
  }
  const text = await readFile(join('site', rel), 'utf8');
  if (!/\bRobloxLaunch\b/.test(text)) continue;
  const has =
    /place-launcher\.js/i.test(text) ||
    /client-installer\.js/i.test(text) ||
    /scriptresource-shared\.js/i.test(text);
  (has ? covered : uncovered).push(rel);
}

console.log(`covered: ${covered.length}   uncovered: ${uncovered.length}`);
for (const p of uncovered.slice(0, 40)) console.log(`  ${p}`);
