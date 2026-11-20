// Post-processing pass over the mirrored tree.
//
// Wayback playback wraps stored JS in a runtime shim:
//
//   var _____WB$wombat$assign$function_____ = ...;
//   if(!globalThis.__WB_pmw){...}{
//   let window = _____WB$wombat$assign$function_____("window");
//   ... more let bindings ...
//   <original file>
//   }
//
// and appends a footer comment after the original bytes. Both are removed here.
// Everything is located by index so no pattern can run away across the file.
import { readdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');

const WOMBAT = '_____WB$wombat$assign$function_____';
const LET_LINE = /^[ \t]*let \w+ = _____WB\$wombat\$assign\$function_____\("[^"]*"\);[ \t]*\r?\n/gm;

function stripTrailingBlock(src, needle) {
  const marker = src.lastIndexOf(needle);
  if (marker === -1) return src;
  const open = src.lastIndexOf('/*', marker);
  if (open === -1 || marker - open > 1200) return src;
  const close = src.indexOf('*/', marker);
  if (close === -1) return src;
  if (src.slice(close + 2).trim().length > 0) return src;
  return src.slice(0, open).replace(/\s+$/, '') + '\n';
}

function cleanJs(src) {
  let out = src;

  // Footer first, so the closing brace we look for is the wrapper's.
  out = stripTrailingBlock(out, 'playback timings');
  out = stripTrailingBlock(out, 'FILE ARCHIVED ON');

  if (!out.includes(WOMBAT)) return out;

  // Cut up to and including the last injected let binding. That also removes the
  // declaration and the if-block that precede the opening brace.
  let lastEnd = -1;
  LET_LINE.lastIndex = 0;
  let m;
  while ((m = LET_LINE.exec(out)) !== null) lastEnd = m.index + m[0].length;
  if (lastEnd === -1) return out;
  out = out.slice(lastEnd);

  // The wrapper opened with a brace we just removed, so its closing brace is now
  // the final one. Drop exactly that.
  const trimmed = out.replace(/\s+$/, '');
  if (trimmed.endsWith('}')) out = trimmed.slice(0, -1) + '\n';

  return out;
}

function cleanHtml(src) {
  let out = src;
  const begin = out.indexOf('<!-- BEGIN WAYBACK TOOLBAR INSERT -->');
  const end = out.indexOf('<!-- END WAYBACK TOOLBAR INSERT -->');
  if (begin !== -1 && end !== -1) {
    out = out.slice(0, begin) + out.slice(end + '<!-- END WAYBACK TOOLBAR INSERT -->'.length);
  }
  out = stripTrailingBlock(out.replace(/<!--/g, '/*').replace(/-->/g, '*/'), 'playback timings')
    .replace(/\/\*/g, '<!--')
    .replace(/\*\//g, '-->');
  return out;
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const stats = { js: 0, html: 0 };

for await (const file of walk(SITE)) {
  const ext = extname(file).toLowerCase();
  if (ext !== '.js' && ext !== '.html') continue;
  const before = await readFile(file, 'utf8');
  const after = ext === '.js' ? cleanJs(before) : cleanHtml(before);
  if (after !== before) {
    await writeFile(file, after);
    stats[ext.slice(1)]++;
  }
}

console.log(`cleaned: ${stats.js} js, ${stats.html} html`);

const recovered = join(SITE, 'js/scriptresource-cmaa.js');
const expected = join(SITE, 'js/scriptresource-CmAa0JUATF31D9rY.js');
try {
  await stat(recovered);
  await rename(recovered, expected);
  console.log('bundle placed at js/scriptresource-CmAa0JUATF31D9rY.js');
} catch {
  /* already in place */
}
