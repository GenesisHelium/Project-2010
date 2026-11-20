// Consolidates the two crawl naming schemes into one.
//
// Pass one stored pages as `p/<original path>` with no extension. Pass two stored
// the same pages as `p/<original path>.html`. Both trees hold real captures, so the
// pair is collapsed onto the extensionless name: it matches the original URL, and
// the dev server can serve it without special casing.
//
// A page document is any file under site/p whose body starts with a document tag.
// Extensions are unreliable here because `.aspx` and no-extension both appear.
import { readdir, readFile, writeFile, rename, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

async function walk(dir, prefix = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...await walk(join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

const isDocument = async (rel) => {
  if (!/\.(html?|aspx)$/i.test(rel) && /\.[a-z0-9]{2,5}$/i.test(rel)) return false;
  const head = (await readFile(join(SITE, 'p', rel), 'utf8')).slice(0, 400).trimStart().toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('\ufeff<!doctype');
};

const files = await walk(join(SITE, 'p'));
const docs = [];
for (const rel of files) {
  if (await isDocument(rel)) docs.push(rel);
}
console.log(`page documents under p/: ${docs.length}`);

const htmlDocs = docs.filter((f) => /\.html?$/i.test(f));

let merged = 0, renamed = 0, dropped = 0;
for (const rel of htmlDocs) {
  const plain = rel.replace(/\.html?$/i, '');
  if (await exists(join(SITE, 'p', plain))) {
    // Twin: the .html copy went through the cleanup passes, so its content wins.
    await writeFile(join(SITE, 'p', plain), await readFile(join(SITE, 'p', rel)));
    await unlink(join(SITE, 'p', rel));
    merged++;
  } else {
    await rename(join(SITE, 'p', rel), join(SITE, 'p', plain));
    renamed++;
  }
}

// Refresh the routing table so it points at the consolidated names.
const pages = JSON.parse(await readFile(join(SITE, '_pages.json'), 'utf8'));
const updated = [];
let stale = 0;
for (const [url, local] of pages) {
  const plain = local.replace(/\.html?$/i, '');
  if (await exists(join(SITE, plain))) updated.push([url, plain]);
  else if (await exists(join(SITE, local))) updated.push([url, local]);
  else stale++;
}
await writeFile(join(SITE, '_pages.json'), JSON.stringify(updated, null, 2));

console.log(`merged ${merged} twins, renamed ${renamed}, dropped ${dropped}`);
console.log(`routing table: ${updated.length} entries, ${stale} stale`);

// Whatever is on disk but absent from the table still needs a URL, since links
// point straight at /p/<path>. Recover the original URL from the file name.
const tablePaths = new Set(updated.map(([, local]) => local.toLowerCase()));
const orphans = [];
for (const rel of docs) {
  const plain = rel.replace(/\.html?$/i, '');
  if (tablePaths.has(('/p/' + plain).toLowerCase())) continue;
  orphans.push(plain);
}
console.log(`unmapped page documents: ${orphans.length}`);
for (const o of orphans.slice(0, 10)) console.log(`  ${o}`);
