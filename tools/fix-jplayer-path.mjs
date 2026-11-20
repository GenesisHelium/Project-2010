// Counts the pages that point at the uncaptured versioned jPlayer path and
// rewrites them to the copy that was archived.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const bad = '/js/jPlayer/1.2.0/jquery.jplayer.min.js';
const good = '/js/jquery.jplayer.min.js';
let changed = 0;
for await (const file of walk('site/p')) {
  const name = file.replace(/\\/g, '/');
  if (!/\.(aspx|html)$/i.test(name) && !/\/[a-z-]+$/i.test(name)) continue;
  let text;
  try { text = await readFile(file, 'utf8'); } catch { continue; }
  if (!text.includes(bad)) continue;
  await writeFile(file, text.replaceAll(bad, good));
  console.log(name);
  changed += 1;
}
console.log(`\n${changed} file(s) updated`);
