// Gives the pages that reference RobloxLaunch without a defining script an
// object to reference.
//
// The reference is inside a Sys.Application.add_load callback that assigns
// `RobloxLaunch._LaunchGamePage`; if the name is unbound when the callback runs,
// that assignment throws and the rest of the boot block (Roblox.Controls.Image
// setup) never happens. The guard is placed just before </body>, which is after
// every script tag has been parsed and before the load handlers fire.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const GUARD = `<script type="text/javascript">
// place-launcher.js defines RobloxLaunch and was not part of this page's
// captured script list; the boot callback below still assigns to it.
if (typeof RobloxLaunch === 'undefined') {
    window.RobloxLaunch = { _LaunchGamePage: null, _Timer: null, _ClientMetricType: null, _Launcher: null };
}
</script>`;

const MARK = 'window.RobloxLaunch = { _LaunchGamePage: null';

async function* walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) yield* walk(join(dir, entry.name), rel);
    else yield rel;
  }
}

let patched = 0;
let done = 0;

for await (const rel of walk('site')) {
  if (/\.(js|css|png|gif|jpg|jpeg|ico|json|xml|swf|txt|eot|ttf|woff|woff2|svg)$/i.test(rel)) continue;
  const text = await readFile(join('site', rel), 'utf8');
  if (!/\bRobloxLaunch\b/.test(text)) continue;
  if (/place-launcher\.js|client-installer\.js|scriptresource-shared\.js/i.test(text)) { done++; continue; }
  if (text.includes(MARK)) { done++; continue; }

  const at = text.lastIndexOf('</body>');
  if (at === -1) { console.log(`skip (no body close): ${rel}`); continue; }
  await writeFile(join('site', rel), text.slice(0, at) + GUARD + '\n' + text.slice(at));
  console.log(`guarded: ${rel}`);
  patched++;
}

console.log(`guarded ${patched} pages, ${done} already covered`);
