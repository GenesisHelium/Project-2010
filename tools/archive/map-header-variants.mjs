// Lists the header containers and the pages that use each one, so the button
// rules can cover every variant instead of only the small header.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const css = await readFile('site/css/allcss.css', 'utf8');
for (const selector of ['#HeaderContainer', '#SmallHeaderContainer', '#AuthenticationButton']) {
  let at = -1;
  let count = 0;
  while ((at = css.indexOf(selector, at + 1)) >= 0 && count < 6) {
    const start = css.lastIndexOf('}', at) + 1;
    const end = css.indexOf('}', at) + 1;
    console.log(`\n[${selector}] @${at}`);
    console.log(css.slice(start, end).slice(0, 300));
    count += 1;
  }
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.aspx') || /^[a-z-]+$/i.test(entry.name)) yield full;
  }
}

const hits = { HeaderContainer: [], SmallHeaderContainer: [], AuthenticationButton: [] };
for await (const file of walk('site/p')) {
  let text;
  try { text = await readFile(file, 'utf8'); } catch { continue; }
  for (const key of Object.keys(hits)) if (text.includes(`id="${key}"`)) hits[key].push(file.replace(/\\/g, '/'));
}
for (const [key, list] of Object.entries(hits)) {
  console.log(`\n=== ${key} (${list.length})`);
  console.log(list.slice(0, 40).join('\n'));
}
