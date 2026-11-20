// Pulls the two BBB seal stylesheets the mirrored seal page asks for. They are
// third-party assets the original crawler did not follow; the archive still has
// them, and without them the seal modal renders unstyled.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const OUT = join('site', 'ext', 'bbb.org', 'online', 'brand', 'css');

const files = [
  'popup.css',
  'resizeable_form_table.css',
];

await mkdir(OUT, { recursive: true });

for (const name of files) {
  const url = `https://web.archive.org/web/2010id_/http://www.bbb.org/online/brand/css/${name}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`miss ${name}: ${res.status}`);
    continue;
  }
  const body = await res.text();
  // Relative image refs inside the sheet resolve under brand/images already.
  await writeFile(join(OUT, name), body);
  console.log(`wrote ${name} (${body.length} bytes)`);
}
