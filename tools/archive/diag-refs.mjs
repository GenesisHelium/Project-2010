// Lists the exact raw refs the audit cannot resolve, so repairs are driven by
// what is on disk rather than by guesswork.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const SITE = 'site';
const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };

async function* walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) yield* walk(join(dir, entry.name), rel);
    else yield `${rel}|${join(dir, entry.name)}`;
  }
}

const rows = new Map();
for await (const item of walk(SITE)) {
  const [rel, full] = item.split('|');
  if (!rel.endsWith('.html')) continue;
  const text = await readFile(full, 'utf8');
  for (const m of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const raw = m[1];
    if (raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('data:') || /^https?:/i.test(raw)) continue;
    const local = raw.split('?')[0].replace(/^\/+/, '');
    if (!local) continue;
    let decoded = local;
    try { decoded = decodeURIComponent(local); } catch { /* keep raw */ }
    if (await exists(join(SITE, decoded))) continue;
    if (!rows.has(raw)) rows.set(raw, new Set());
    rows.get(raw).add(rel);
  }
}

console.log(`distinct unresolved refs: ${rows.size}`);
for (const [raw, files] of [...rows].sort()) {
  console.log(`${raw}\n    <- ${[...files].slice(0, 2).join(', ')}`);
}
