// Shows what the page-specific matchers actually receive, so a silent miss is visible.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function* walkHtml(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkHtml(full);
    else if (/\.(html|aspx)$/i.test(entry.name) || !/\.[a-z0-9]{1,5}$/i.test(entry.name)) yield full;
  }
}

const patterns = [
  ['catalog', /\/Catalog\.aspx$/],
  ['contests', /\/Contests\/index\.aspx$/],
  ['forum', /\/Forum\/Default\.aspx$/],
  ['games', /\/Games\.aspx$/],
];

for await (const file of walkHtml('site')) {
  const at = file.replace(/\\/g, '/');
  for (const [name, re] of patterns) {
    if (re.test(at)) console.log(`${name}\t${JSON.stringify(file)}\t${JSON.stringify(at)}`);
  }
}
