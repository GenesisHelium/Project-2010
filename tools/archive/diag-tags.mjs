// Lists the script and stylesheet tags a page loads, in order.
import { readFile } from 'node:fs/promises';

for (const file of process.argv.slice(2)) {
  const text = await readFile(file, 'utf8');
  console.log(`=== ${file}`);
  for (const m of text.matchAll(/<script[^>]*\ssrc="([^"]+)"/gi)) console.log(`  script  ${m[1]}`);
  for (const m of text.matchAll(/<link[^>]*href="([^"]+\.css[^"]*)"/gi)) console.log(`  css     ${m[1]}`);
}
