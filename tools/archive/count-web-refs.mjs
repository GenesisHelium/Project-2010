// Counts archive-relative (/web/...) references per page, including pages that
// were stored without a file extension. Those are the ones the crawler reports
// as dead /web/... targets.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
  }
}

for await (const file of walk('site')) {
  if (!file.endsWith('.html') && !file.endsWith('.aspx') && !file.endsWith('.js') && !file.endsWith('.css')) continue;
  const body = await readFile(file, 'utf8');
  const refs = [...body.matchAll(/(?:href|src|action)="(\/web\/[^"]+)"/g)].map((m) => m[1]);
  if (!refs.length) continue;
  console.log(`${file}: ${refs.length}`);
  for (const r of refs.slice(0, 4)) console.log('    ' + r.slice(0, 110));
}
