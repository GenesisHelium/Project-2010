// Removes the Wayback runtime shim from the mirrored scripts.
//
// The archive injects a preamble into every script it serves:
//
//   var _____WB$wombat$assign$function_____=function(name){...};if(!globalThis.__WB_pmw){...}{
//   let window = _____WB$wombat$assign$function_____("window");
//   ...
//   let opener = _____WB$wombat$assign$function_____("opener");
//
// Left in place it shadows globals and breaks `this` binding. It is one contiguous
// run of lines wrapped in a bare block, so it comes out by lines: the marker lines
// go, and so do the `{` and `}` that wrapped them. The archive's trailer comment
// goes with it.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const SITE = 'site';

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const SHIM_LINE = /_____WB\$wombat|__WB_pmw|_____WB\$wombat\$assign\$function_____/;
const TRAILER_START = '/*\n     FILE ARCHIVED ON';

function stripShim(src) {
  const lines = src.split('\n');
  const keep = new Array(lines.length).fill(true);

  let first = -1;
  let last = -1;
  for (let i = 0; i < lines.length; i++) {
    if (SHIM_LINE.test(lines[i])) {
      keep[i] = false;
      if (first === -1) first = i;
      last = i;
    }
  }
  if (first === -1) return src;

  // The bare block that wrapped the shim: `{` before, `}` after.
  for (let i = first - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (!t) continue;
    if (t === '{') keep[i] = false;
    break;
  }
  for (let i = last + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (t === '}' || t === '};') keep[i] = false;
    break;
  }

  // Archive trailer comment.
  const joined = lines.join('\n');
  const trailer = joined.indexOf(TRAILER_START);
  if (trailer !== -1) {
    const end = joined.indexOf('*/', trailer);
    if (end !== -1) {
      // Translate the character range back into line indices.
      const before = joined.slice(0, trailer).split('\n').length - 1;
      const after = joined.slice(0, end + 2).split('\n').length - 1;
      for (let i = before; i <= after; i++) keep[i] = false;
    }
  }

  return lines.filter((_, i) => keep[i]).join('\n');
}

let files = 0;
for await (const file of walk(SITE)) {
  if (extname(file).toLowerCase() !== '.js') continue;
  const before = await readFile(file, 'utf8');
  if (!before.includes('_____WB$wombat') && !before.includes(TRAILER_START)) continue;
  const after = stripShim(before);
  if (after === before) continue;
  await writeFile(file, after);
  console.log(`stripped ${file.slice(SITE.length + 1)}  ${before.length} -> ${after.length}`);
  files++;
}
console.log(`${files} scripts cleaned`);
