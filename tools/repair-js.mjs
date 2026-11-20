// Repairs the scripts damaged by an earlier Wayback-shim stripper.
//
// That pass cut from the shim marker to the next blank line, which sometimes ran
// past the shim's closing brace and left a stray `}` at the join. The result is a
// file that throws `Unexpected token '}'` on load, and on a page whose only
// JavaScript is that file, nothing else runs.
//
// The archive also appends two comments to every script it serves: a copyright
// trailer and a playback-timings block. Both go.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import vm from 'node:vm';

const SITE = 'site';

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const ARCHIVE_TRAILER = '/*\n     FILE ARCHIVED ON';
const PLAYBACK = '/*\nplayback timings (ms):';

function cutComments(src) {
  let out = src;
  for (const marker of [ARCHIVE_TRAILER, PLAYBACK]) {
    const at = out.indexOf(marker);
    if (at === -1) continue;
    const end = out.indexOf('*/', at);
    if (end === -1) continue;
    out = out.slice(0, at) + out.slice(end + 2);
  }
  return out;
}

function parses(src) {
  try {
    new vm.Script(src);
    return true;
  } catch {
    return false;
  }
}

// Removes one unmatched closing brace from the end of the body. The shim left at
// most one, and it is always the last token before the archive trailer.
function dropStrayBrace(src) {
  const trimmedEnd = src.replace(/\s+$/, '');
  if (!trimmedEnd.endsWith('}')) return null;
  const body = trimmedEnd.slice(0, -1);
  for (const candidate of [body, body + '\n']) {
    if (parses(candidate)) return candidate;
  }
  return null;
}

let repaired = 0;
let broken = 0;

for await (const file of walk(SITE)) {
  if (extname(file).toLowerCase() !== '.js') continue;
  const before = await readFile(file, 'utf8');
  let after = cutComments(before);

  if (!parses(after)) {
    const fixed = dropStrayBrace(after);
    if (fixed !== null) after = fixed;
    else {
      console.log(`still broken: ${file.slice(SITE.length + 1)}`);
      broken++;
    }
  }

  if (after !== before) {
    await writeFile(file, after);
    repaired++;
  }
}

console.log(`repaired ${repaired} scripts, ${broken} still unparseable`);
