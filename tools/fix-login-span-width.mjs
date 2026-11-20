// The big-header pages carry an inline width on the login span (usually 40px)
// sized for the old text login. It is narrower than the blue button plus its
// margins, so the button overflows to the right. Drop the inline width and let
// the span size itself.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const pattern = /(<span id="AuthenticationBannerSpan")\s+style="width:\s*\d+px;"\s*>/g;
let changed = 0;
for await (const file of walk('site')) {
  const name = file.replace(/\\/g, '/');
  if (!/\.(aspx|html)$/i.test(name) && !/\/[a-z-]+$/i.test(name)) continue;
  let text;
  try { text = await readFile(file, 'utf8'); } catch { continue; }
  if (!/AuthenticationBannerSpan"\s+style="width:/.test(text)) continue;
  const next = text.replace(pattern, '$1>');
  if (next !== text) {
    await writeFile(file, next);
    changed += 1;
  }
}
console.log(`${changed} file(s) updated`);
