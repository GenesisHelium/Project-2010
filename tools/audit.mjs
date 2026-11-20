// Audits the mirrored tree: every local reference in HTML and CSS must exist on disk.
// Skips javascript: handlers, data URIs, and paths the dev server answers itself.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');

// Routes tools/server.mjs serves without a file behind them.
const SERVER_ROUTES = ['/ads/iframeadcontent.aspx', '/analytics/badhtmlimage.ashx', '/login/dologin.aspx', '/logout'];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const exists = async (p) => {
  try { await stat(p); return true; } catch { return false; }
};

const decode = (s) => {
  const t = s.replace(/&amp;/g, '&');
  try { return decodeURIComponent(t); } catch { return t; }
};

const missing = new Map();
const wayback = [];
const externals = new Set();

const noteMissing = (ref, from) => {
  if (!missing.has(ref)) missing.set(ref, new Set());
  missing.get(ref).add(from);
};

const files = [];
for await (const f of walk(SITE)) files.push(f);

for (const file of files) {
  const ext = extname(file).toLowerCase();
  const rel = file.slice(SITE.length + 1).replace(/\\/g, '/');
  if (!['.html', '.css'].includes(ext)) continue;
  const text = await readFile(file, 'utf8');

  if (/web\.archive\.org|__wm\.|wm-ipp/.test(text)) wayback.push(rel);

  // Commented-out declarations never load, so they are not references. The
  // forum skin keeps its header backgrounds commented out; both are checked
  // only when someone uncomments them.
  const live = text.replace(/\/\*[\s\S]{0,2000}?\*\//g, '');

  const refs = new Set();
  if (ext === '.html') {
    for (const m of live.matchAll(/(?:src|href)="([^"]+)"/g)) refs.add(m[1]);
    for (const m of live.matchAll(/url\(["']?([^"')]+)["']?\)/g)) refs.add(m[1]);
  } else {
    for (const m of live.matchAll(/url\(["']?([^"')]+)["']?\)/g)) refs.add(m[1]);
  }

  for (const raw of refs) {
    const ref = decode(raw.trim());
    if (!ref || ref.startsWith('#') || ref.startsWith('data:') || ref.startsWith('javascript:') || ref.startsWith('mailto:')) continue;
    if (/^https?:/i.test(ref) || ref.startsWith('//')) {
      externals.add(ref.split('/').slice(0, 3).join('/'));
      continue;
    }
    const path = ref.split('?')[0].split('#')[0];
    // Relative refs resolve against the containing file, absolute against the
    // site root — which is what the server does too.
    const local = path.startsWith('/')
      ? path.replace(/^\/+/, '')
      : join(dirname(rel), path).replace(/\\/g, '/');
    if (!local || local.startsWith('..')) continue;
    if (SERVER_ROUTES.includes('/' + local.toLowerCase())) continue;
    if (await exists(join(SITE, local))) continue;
    noteMissing(local, rel);
  }
}

console.log(`files checked: ${files.length}`);
console.log(`\nmissing (${missing.size}):`);
for (const [ref, from] of [...missing].sort()) {
  console.log(`  ${ref}   <- ${[...from].slice(0, 3).join(', ')}`);
}
console.log(`\nwayback debris (${wayback.length}): ${wayback.slice(0, 20).join(', ')}`);
console.log(`\nexternal references (${externals.size}):`);
for (const e of [...externals].sort()) console.log(`  ${e}`);
