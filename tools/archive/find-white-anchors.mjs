// Finds blanket "a { color: white; }" rules in page markup. They were meant
// for header links but also hit href-less anchors and make them invisible.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const pattern = /a\s*\{\s*color\s*:\s*white\s*;?\s*\}/gi;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let files = 0;
for await (const file of walk('site/p')) {
  const name = file.replace(/\\/g, '/');
  if (!/\.(aspx|html)$/i.test(name) && !/\/[a-z-]+$/i.test(name)) continue;
  let text;
  try { text = await readFile(file, 'utf8'); } catch { continue; }
  if (pattern.test(text)) {
    console.log(name);
    files += 1;
    pattern.lastIndex = 0;
  }
}
console.log(`\n${files} file(s)`);
