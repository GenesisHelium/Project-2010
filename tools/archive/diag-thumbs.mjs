// Counts how many mirrored pages still point at the thumbnail CDN with an
// absolute URL, and prints one sample.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const RE = /https?:\/\/t\d?bg\.roblox\.com\/[^"' ]+/;
let files = 0;
let hits = 0;
let sample = null;

for await (const file of walk('site/p')) {
  files++;
  const text = await readFile(file, 'utf8');
  const m = text.match(RE);
  if (m) { hits++; if (!sample) sample = `${file}: ${m[0]}`; }
}

console.log(`pages with absolute t*bg refs: ${hits} of ${files}`);
if (sample) console.log(sample);
