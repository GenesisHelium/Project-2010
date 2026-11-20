// Rebuilds the entry page from the capture. Resolves references through the existing
// manifest so mirrored assets are reused, and strips the playback toolbar by literal
// index rather than regex, which previously ate the document.
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';
const TS = '20101210093455';

const MOD_KIND = { im_: 'image', cs_: 'css', js_: 'js', if_: 'frame', oe_: 'object', id_: 'data' };
const TRACKERS = ['amgdgt.com', 'cpxadroit.com', 'fastclick.net', 'google-analytics.com'];

const ARCHIVE_RE =
  /(?:https?:\/\/web\.archive\.org)?\/web\/(\d{14})([a-z]{2}_)?\/((?:https?:)?\/\/[^"'\s)>\\]+)/g;

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"');
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const isTracker = (u) => TRACKERS.some((t) => u.includes(t));

const manifest = JSON.parse(await readFile(join(SITE, '_manifest.json'), 'utf8'));
const byUrl = new Map(manifest.map(([local, v]) => [v.url, local]));

function cutBetween(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) return src;
  const end = src.indexOf(endMarker, start);
  if (end === -1) return src;
  return src.slice(0, start) + src.slice(end + endMarker.length);
}

function stripTrailingComment(html, needle) {
  const marker = html.lastIndexOf(needle);
  if (marker === -1) return html;
  const open = html.lastIndexOf('<!--', marker);
  if (open === -1 || marker - open > 800) return html;
  const close = html.indexOf('-->', marker);
  if (close === -1) return html;
  if (html.slice(close + 3).trim().length > 0) return html;
  return html.slice(0, open);
}

const html = await (
  await fetch(`${WB}/${TS}if_/http://www.roblox.com/`, { headers: { 'user-agent': 'mirror' } })
).text();

let missing = 0;
let out = html.replace(ARCHIVE_RE, (full, ts, mod, rawUrl) => {
  let url = decode(rawUrl);
  if (url.startsWith('//')) url = 'http:' + url;
  if (isTracker(url)) return full;
  const local = byUrl.get(url);
  if (!local) { missing++; return full; }
  return '/' + enc(local);
});

out = cutBetween(out, '<!-- BEGIN WAYBACK TOOLBAR INSERT -->', '<!-- END WAYBACK TOOLBAR INSERT -->');
out = cutBetween(out, '<div id="wm-ipp-print">', '</div>');
out = stripTrailingComment(out, 'playback timings');
out = out.replace(/<script[^>]+web-static\.archive\.org[^>]*><\/script>/g, '');
out = out.replace(/<link[^>]+web-static\.archive\.org[^>]*>/g, '');
out = out.replace(/<script[^>]*>\s*__wm\.init\([\s\S]*?\);\s*__wm\.wombat\([\s\S]*?\);\s*<\/script>/g, '');
out = out.replace(/__wm\.rw\([01]\);/g, '');

// The capture ships a clock-drift guard that alerts whenever the system date is
// later than the capture date. On a rebuilt archive it fires on every load.
out = out.replace(
  /if \(new Date\(\) > new Date\('12\/18\/2010 [^']*'\)\)\{alert\('Your system time is incorrect'\) \};/g,
  ''
);

// Tracker elements reference hosts that no longer resolve. Remove the element
// rather than ship a dead URL into the page.
const TRACKER_ALT = TRACKERS.join('|');
out = out.replace(
  new RegExp(`<script[^>]*src="[^"]*(?:${TRACKER_ALT})[^"]*"[^>]*>\\s*</script>`, 'gi'), '');
out = out.replace(
  new RegExp(`<img[^>]*src="[^"]*(?:${TRACKER_ALT})[^"]*"[^>]*/?>`, 'gi'), '');
out = out.replace(
  new RegExp(`<noscript>\\s*<iframe[^>]*(?:${TRACKER_ALT})[^>]*>\\s*</iframe>\\s*</noscript>`, 'gi'), '');

await mkdir(SITE, { recursive: true });
await writeFile(join(SITE, 'index.html'), out);

console.log(`index.html rebuilt: ${out.length} bytes`);
console.log(`references unresolved: ${missing}`);
console.log(`wayback markers left: ${(out.match(/web\.archive\.org|__wm\.|wm-ipp/g) || []).length}`);
