// Repairs the script and stylesheet references that the crawl mangled.
//
// Three separate problems, all visible on the served pages:
//
//   1. Every page loads two ScriptResource.axd bundles. The big one carries
//      MicrosoftAjax and jQuery; the small one carries Roblox.Thumbs. The crawl
//      collapsed both onto one file name, so pages that need jQuery got only the
//      thumbs namespace and threw on every line. The first bundle reference on a
//      page is the big one, so it is pointed back at the real thing.
//   2. Two page scripts were saved under their page namespace instead of the js/
//      tree.
//   3. A stylesheet href picked up an extra `&amp;t=` query that survived as a
//      literal `&amp;` inside the URL, and one chat stylesheet kept a full archive
//      path.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listDocuments } from './lib/documents.mjs';

const SITE = 'site';
const BUNDLE = '/js/scriptresource-CmAa0JUATF31D9rY.js';
const SHARED = '/js/scriptresource-shared.js';

const SCRIPT_ALIASES = new Map([
  ['/p/Game/PlaceLauncher.js', '/js/place-launcher.js'],
  ['/p/Install/ClientInstaller.js', '/js/client-installer.js'],
]);

let touched = 0;

for (const rel of (await listDocuments(SITE)).pages) {
  const file = join(SITE, rel);
  const before = await readFile(file, 'utf8');
  let out = before;

  // 1. First ScriptResource bundle on the page is the one with jQuery in it.
  const first = out.indexOf(SHARED);
  if (first !== -1) out = out.slice(0, first) + BUNDLE + out.slice(first + SHARED.length);

  // 2. Page-namespaced script files.
  for (const [from, to] of SCRIPT_ALIASES) out = out.split(`"${from}"`).join(`"${to}"`);

  // 3. Stylesheet hrefs.
  out = out.replace(/\/css\/allcss\.css&amp;t=[A-Za-z]+/g, '/css/allcss.css');
  out = out.replace(/\/web\/\d{14}cs_\/(?:https?:)?\/\/[^"']*\/chat\.css/g, '');

  if (out !== before) {
    await writeFile(file, out);
    touched++;
  }
}

console.log(`repaired script and stylesheet references in ${touched} pages`);
