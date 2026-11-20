// Sweeps every mirrored page for img tags whose src is empty or literally
// "undefined". An empty src resolves to the page URL, so the browser requests
// the document again and gets HTML where it expected a picture.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function* walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) yield* walk(join(dir, entry.name), rel);
    else yield rel;
  }
}

let pages = 0;
const hits = [];

for await (const rel of walk('site')) {
  if (/\.(js|css|png|gif|jpg|jpeg|ico|json|xml|swf|txt|eot|ttf|woff|woff2|svg)$/i.test(rel)) continue;
  const text = await readFile(join('site', rel), 'utf8');
  if (!text.includes('<img') && !text.includes('<IMG')) continue;
  pages++;
  for (const m of text.matchAll(/<img\b[^>]*>/gi)) {
    const src = m[0].match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
    const value = src ? src[2].trim() : null;
    if (value === null || value === '' || value === 'undefined') {
      hits.push(`${rel}  src=${JSON.stringify(value)}  ${m[0].slice(0, 150).replace(/\s+/g, ' ')}`);
    }
  }
}

console.log(`pages with img tags: ${pages}`);
console.log(`empty or undefined src: ${hits.length}`);
for (const h of hits.slice(0, 30)) console.log(`  ${h}`);
