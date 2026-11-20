// Shared page detection for the maintenance tools.
//
// The mirror stores pages as `p/<original path>` with no extension, so a file
// name is not enough to tell a page from an asset. The first bytes are.
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const HEAD_BYTES = 512;

export function looksLikePage(head) {
  const t = head.replace(/^\uFEFF/, '').trimStart().toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html');
}

// Walks the whole site and returns pages and stylesheets as relative paths.
export async function listDocuments(site) {
  const pages = [];
  const stylesheets = [];

  async function walk(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, rel);
        continue;
      }
      if (extname(entry.name).toLowerCase() === '.css') {
        stylesheets.push(rel);
        continue;
      }
      // Binary assets are large and cheap to skip by extension.
      if (/\.(png|jpe?g|gif|ico|swf|woff2?|ttf|eot|zip|gz)$/i.test(entry.name)) continue;
      const head = (await readFile(full, 'utf8')).slice(0, HEAD_BYTES);
      if (looksLikePage(head)) pages.push(rel);
    }
  }

  await walk(site);
  return { pages, stylesheets };
}
