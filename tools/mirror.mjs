// Mirrors a Wayback capture into a static site tree.
// A reference may carry its own capture timestamp, which is different from the
// page's timestamp, so the resolver keeps the one each reference was archived at.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const TS = '20101210093455';
const ORIGIN = 'https://web.archive.org/web';
const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');

const TRACKERS = [
  'amgdgt.com', 'cpxadroit.com', 'fastclick.net', 'google-analytics.com',
  'scorecardresearch.com', 'quantserve.com', 'doubleclick.net', 'facebook.com/tr',
];

const manifest = new Map();
const queue = [];
const seen = new Map(); // local path -> entry

const MOD_KIND = { im_: 'image', cs_: 'css', js_: 'js', if_: 'frame', oe_: 'object', id_: 'data' };

// Handles both absolute and root-relative Wayback references, capturing the
// timestamp and modifier that belong to that specific reference.
const ARCHIVE_RE =
  /(?:https?:\/\/web\.archive\.org)?\/web\/(\d{14})([a-z]{2}_)?\/((?:https?:)?\/\/[^"'\s)>\\]+)/g;

const decodeEntities = (s) =>
  s.replace(/&amp;/g, '&').replace(/&#38;/g, '&').replace(/&quot;/g, '"');

const isTracker = (url) => TRACKERS.some((t) => url.includes(t));

const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

function extOf(url, fallback) {
  const clean = url.split('?')[0].split('#')[0];
  const m = clean.match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : fallback;
}

function localPath(originalUrl, kind) {
  const u = new URL(originalUrl);
  const host = u.hostname.replace(/^www\./, '');
  const path = decodeURIComponent(u.pathname);

  if (host === 'roblox.com') {
    if (/^\/CSS\/Base\/CSS\/AllCSS\.ashx$/i.test(path)) return 'css/allcss.css';
    if (/^\/chat\/css\//i.test(path)) return 'css/' + posix.basename(path);
    if (/^\/css\//i.test(path)) return 'css/' + posix.basename(path);
    if (/^\/js\//i.test(path)) return 'js/' + posix.basename(path);
    if (/^\/ScriptResource\.axd$/i.test(path)) {
      const d = (u.searchParams.get('d') || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
      return 'js/scriptresource-' + d + '.js';
    }
    if (/^\/Thumbs\/Asset\.asmx\/js$/i.test(path)) return 'js/asset-asmx.js';
    if (/^\/Game\/PlaceLauncher\.js$/i.test(path)) return 'js/place-launcher.js';
    if (/^\/Install\/ClientInstaller\.js$/i.test(path)) return 'js/client-installer.js';
    if (/^\/images\//i.test(path)) return 'images' + path.replace(/^\/images/i, '');
    if (/^\/favicon\.ico$/i.test(path)) return 'favicon.ico';
    if (/^\/Ads\/IFrameAdContent\.aspx$/i.test(path)) {
      const slot = u.searchParams.get('slot') || 'ad';
      return 'ads/' + slot.replace(/[^a-z0-9_-]/gi, '_') + '.html';
    }
    return 'p' + path;
  }

  const safeHost = host.replace(/[^a-z0-9.-]/gi, '_');
  let base = 'ext/' + safeHost + path;
  if (base.endsWith('/')) base += 'index';
  if (!/\.[a-z0-9]{2,5}$/i.test(base)) base += '.' + extOf(path, kind === 'image' ? 'png' : 'bin');
  return base;
}

const MOD = { image: 'im_', css: 'cs_', js: 'js_', frame: 'if_', object: 'oe_', data: 'id_' };

async function fetchArchive(originalUrl, kind, ts = TS) {
  const mod = MOD[kind] || '';
  const target = `${ORIGIN}/${ts}${mod}/${originalUrl}`;
  const res = await fetch(target, {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) mirror' },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function enqueue(originalUrl, kind, ts) {
  const local = localPath(originalUrl, kind);
  if (seen.has(local)) return '/' + enc(local);
  const entry = { url: originalUrl, kind, ts, status: 'pending' };
  seen.set(local, entry);
  manifest.set(local, entry);
  queue.push({ local, originalUrl, kind, ts });
  return '/' + enc(local);
}

// Resolve one reference (already entity-decoded) to a local URL.
function resolveRef(raw, baseUrl, defaultKind, defaultTs) {
  let r = raw.trim();
  if (!r || r.startsWith('data:') || r.startsWith('#')) return null;

  const m = r.match(/^(?:https?:\/\/web\.archive\.org)?\/web\/(\d{14})([a-z]{2}_)?\/(.+)$/);
  if (m) {
    const [, ts, mod, tailRaw] = m;
    let tail = decodeEntities(tailRaw);
    if (tail.startsWith('//')) tail = 'http:' + tail;
    if (isTracker(tail)) return null;
    return enqueue(tail, MOD_KIND[mod] || defaultKind, ts);
  }

  if (/^\/\/[^/]/.test(r)) r = 'http:' + r;
  let abs;
  try { abs = new URL(r, baseUrl).href; } catch { return null; }
  if (isTracker(abs)) return null;
  return enqueue(abs, defaultKind, defaultTs);
}

function rewriteCss(css, cssUrl) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, _q, ref) => {
    const local = resolveRef(decodeEntities(ref), cssUrl, 'image', TS);
    return local ? `url("${local}")` : full;
  });
}

function rewriteHtml(html, pageTs = TS) {
  html = html.replace(
    /<script[^>]+src="[^"]*(?:amgdgt|cpxadroit|google-analytics|urchin)[^"]*"[^>]*>\s*<\/script>/gi, '');
  html = html.replace(/<img[^>]+src="[^"]*fastclick[^"]*"[^>]*\/?>/gi, '');

  return html.replace(ARCHIVE_RE, (full, ts, mod, rawUrl) => {
    let url = decodeEntities(rawUrl);
    if (url.startsWith('//')) url = 'http:' + url;
    if (isTracker(url)) return full;
    try { return enqueue(url, MOD_KIND[mod] || 'data', ts); } catch { return full; }
  });
}

async function run() {
  await mkdir(SITE, { recursive: true });
  const html = (await fetchArchive('http://www.roblox.com/', 'frame')).toString('utf8');
  await writeFile(join(SITE, 'index.html'), rewriteHtml(html));

  let pass = 0;
  while (queue.length) {
    pass++;
    const batch = queue.splice(0, 16);
    const results = await Promise.allSettled(
      batch.map(async ({ local, originalUrl, kind, ts }) => {
        const buf = await fetchArchive(originalUrl, kind, ts);
        const dest = join(SITE, local);
        await mkdir(dirname(dest), { recursive: true });
        if (kind === 'css') await writeFile(dest, rewriteCss(buf.toString('utf8'), originalUrl));
        else if (kind === 'frame') await writeFile(dest, rewriteHtml(buf.toString('utf8'), ts));
        else await writeFile(dest, buf);
        manifest.get(local).status = 'ok';
        manifest.get(local).bytes = buf.length;
      })
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const e = manifest.get(batch[i].local);
        e.status = 'fail';
        e.error = r.reason?.message;
      }
    });
    process.stdout.write(`pass ${pass}: ${queue.length} left\n`);
  }

  const rows = [...manifest.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const ok = rows.filter(([, v]) => v.status === 'ok');
  const fail = rows.filter(([, v]) => v.status === 'fail');
  await writeFile(join(SITE, '_manifest.json'), JSON.stringify(rows, null, 2));
  console.log(`\n=== ${ok.length}/${rows.length} assets ok, ${fail.length} failed ===`);
  for (const [k, v] of fail) console.log(`FAIL ${k}  <-  ${v.url} [${v.error}]`);
}

await run();
