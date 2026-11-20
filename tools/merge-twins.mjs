// Collapses the page pairs the two crawl passes left behind.
//
// Pass one saved pages under the URL the site actually served (`p/all-games`).
// Pass two saved the same pages under a `.aspx` suffix bolted onto that URL
// (`p/all-games.aspx`). Both are real captures, but only one of them has been
// through the cleanup passes, and the pair is invisible in the browser: the page
// served at /p/all-games is the raw one.
//
// The copy with less archive debris wins, and it is written to the URL-shaped
// name so a link to /adventure-games and a link to /adventure-games.aspx land on
// the same page.
import { readdir, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');

const exists = async (p) => { try { const s = await stat(p); return s.isFile(); } catch { return false; } };

async function list(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await list(join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

// Archive debris is the cheapest reliable signal for which copy is cleaned.
const debris = (text) =>
  (text.match(/web\.archive\.org|__wm\.|archive\.org|ERR_TUNNEL/g) || []).length;

const files = await list(join(SITE, 'p'));
const aspx = files.filter((f) => /\.aspx$/i.test(f));

let merged = 0;
for (const rel of aspx) {
  const bare = rel.replace(/\.aspx$/i, '');
  if (!(await exists(join(SITE, 'p', bare)))) continue;

  const a = join(SITE, 'p', bare);
  const b = join(SITE, 'p', rel);
  const textA = await readFile(a, 'utf8');
  const textB = await readFile(b, 'utf8');

  if (textA.length < 500 && textB.length > textA.length) {
    // A truncated capture at the bare name: the .aspx copy is the real page.
    await writeFile(a, textB);
  } else if (debris(textB) < debris(textA)) {
    // The .aspx copy went through cleanup; keep its body under the URL-shaped name.
    await writeFile(a, textB);
  }

  await unlink(b);
  merged++;
}

// A page named with no extension can still carry the other crawl's `.html`.
for (const rel of files) {
  if (!/\.html?$/i.test(rel)) continue;
  const bare = rel.replace(/\.html?$/i, '');
  if (!(await exists(join(SITE, 'p', bare)))) continue;
  const a = join(SITE, 'p', bare);
  const b = join(SITE, 'p', rel);
  const textA = await readFile(a, 'utf8');
  const textB = await readFile(b, 'utf8');
  if (debris(textB) < debris(textA) || textA.length < 500) await writeFile(a, textB);
  await unlink(b);
  merged++;
}

console.log(`merged ${merged} page pairs onto their URL-shaped names`);
