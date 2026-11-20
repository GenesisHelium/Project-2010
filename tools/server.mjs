// Serves the mirrored 2010 ROBLOX site and stands in for the ASP.NET endpoints
// the captured markup still calls. No framework, no dependencies.
//
// Two things about this tree shape the resolution below:
//
//   * The mirror keeps pages under their original path with no extension
//     (`/p/Games.aspx`, `/p/adventure-games`), so a request can point at a file
//     whose name differs only by `.html`, or at a path segment that is really a
//     directory holding `index.html`.
//   * This directory is case-sensitive, while the original site was not. Every
//     request is resolved through a lowercase index built at boot.
import { createServer } from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const PORT = Number(process.env.PORT || 2010);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.swf': 'application/x-shockwave-flash',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.bin': 'application/octet-stream',
};

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// A 4x4 wash in the site's own panel colour. Stands in for thumbnail requests
// against the t0bg-t7bg hosts, which were never crawled at any timestamp.
const BLANK_THUMB = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFUlEQVR4nGP8z8Dwn4GBgYGJAQ0AACQlAQH9Yx2QAAAAAElFTkSuQmCC',
  'base64'
);

const send = (res, code, body, headers = {}) => {
  res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
};

const sendHtml = (res, code, body) =>
  send(res, code, body, { 'content-type': 'text/html; charset=utf-8' });

// ---------------------------------------------------------------------------
// Lowercase file index. The original site was served from a case-insensitive
// filesystem; this one is not, so paths are matched through this map.
// ---------------------------------------------------------------------------
const actual = new Map();     // "css/allcss.css" -> "css/allcss.css" (real name)
const directories = new Set(); // "p/my" -> serves p/my/index.html

async function index(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const key = rel.toLowerCase();
    if (entry.isDirectory()) {
      directories.add(key);
      await index(join(dir, entry.name), rel);
    } else {
      actual.set(key, rel);
    }
  }
}
await index(SITE);

function findFile(pathname) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '').replace(/\\/g, '/');
  if (!rel) return null;
  const key = rel.toLowerCase();

  if (actual.has(key)) return actual.get(key);
  if (actual.has(key + '.html')) return actual.get(key + '.html');
  if (actual.has(key + '.htm')) return actual.get(key + '.htm');
  // The 2010 nav links to page-shaped root URLs (/games, /Catalog, /horror-games)
  // while every page body lives under p/. Try the page namespace before giving up.
  if (actual.has('p/' + key)) return actual.get('p/' + key);
  if (actual.has('p/' + key + '.aspx')) return actual.get('p/' + key + '.aspx');
  if (actual.has('p/' + key + '.html')) return actual.get('p/' + key + '.html');
  if (directories.has(key)) {
    const idx = key.replace(/\/$/, '') + '/index.html';
    if (actual.has(idx)) return actual.get(idx);
  }
  return null;
}

// Legacy URL shapes the captured markup still contains. Each one addresses a
// file that exists under a different name in the mirror.
function aliasFor(pathname) {
  const p = pathname.toLowerCase();
  if (p === '/css/base/css/allcss.ashx') return 'css/allcss.css';
  if (p === '/css/base/css/party.css') return 'css/party.css';
  // The 2010 nav links to /home, /games and /Catalog without a file extension;
  // the mirror stores them under the p/ page namespace.
  if (p === '/home' || p === '/home/') return 'index.html';
  if (p === '/games' || p === '/games/') return 'p/games.aspx';
  if (p === '/catalog' || p === '/catalog/') return 'p/Catalog.aspx';
  if (p === '/info/terms-of-service') return 'p/info/TermsOfService.aspx';
  let m = p.match(/^\/chat\/css\/([^/]+)$/);
  if (m) return 'css/' + m[1];
  // Parents/Register.aspx links the chat stylesheet from /chat/, not /chat/css/.
  if (p === '/chat/chat.css') return 'css/chat.css';
  if (p === '/webresource.axd') return 'js/scriptresource-CmAa0JUATF31D9rY.js';
  if (p === '/scriptresource.axd') return 'js/scriptresource-CmAa0JUATF31D9rY.js';
  if (p === '/thumbs/asset.asmx/js' || p === '/p/thumbs/asset.asmx/js') return 'js/asset-asmx.js';
  m = p.match(/^\/thumbs\/asset\.asmx\/jsdebug$/);
  if (m) return 'js/asset-asmx.js';
  m = p.match(/^\/p\/thumbs\/asset\.asmx\/jsdebug$/);
  if (m) return 'js/asset-asmx.js';
  return null;
}

async function serveFile(pathname, res) {
  let rel = aliasFor(pathname);
  if (!rel) rel = findFile(pathname);
  if (!rel) return false;

  const full = join(SITE, rel);
  if (!full.startsWith(SITE)) return false;

  try {
    const buf = await readFile(full);
    // Pages in the mirror carry no extension, so the type comes from the bytes.
    let type = MIME[extname(rel).toLowerCase()];
    if (!type) {
      const head = buf.subarray(0, 64).toString('utf8').trimStart().toLowerCase();
      type = head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<?xml')
        ? 'text/html; charset=utf-8'
        : 'application/octet-stream';
    }
    res.writeHead(200, {
      'content-type': type,
      'content-length': buf.length,
      'cache-control': 'no-cache',
    });
    res.end(buf);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Endpoint emulation.
// ---------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

// The captured pages are full of ASP.NET postback links. The real backend is
// gone, so a postback acknowledges and returns the page the browser was on.
function postbackStub(pathname) {
  const target = findFile(pathname) || findFile(pathname.replace(/\/$/, '') + '/index.html');
  return target;
}

async function servePostback(req, res, pathname) {
  await readBody(req);
  const page = postbackStub(pathname);
  if (page) {
    const buf = await readFile(join(SITE, page));
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
    });
    return res.end(buf);
  }
  const back = req.headers.referer;
  if (back) {
    res.writeHead(303, { location: new URL(back).pathname });
    return res.end();
  }
  res.writeHead(303, { location: '/' });
  res.end();
}

// A page the 2010 site linked to but the archive never captured. Styled like the
// era so the click reads as part of the site rather than as a dead end.
function notCaptured(pathname) {
  const label = pathname.replace(/^\//, '').replace(/\.aspx$/i, '').replace(/[/_]/g, ' ');
  return `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>ROBLOX - ${label}</title>
<style>
  html, body { margin: 0; padding: 0; background: #e4e9ee; }
  body { font: 12px/1.5 Verdana, Arial, Helvetica, sans-serif; color: #333; }
  #header { background: #0f4c81; border-bottom: 2px solid #08304f; padding: 10px 18px; }
  #header a { color: #fff; font: bold 20px "Trebuchet MS", Arial, sans-serif; text-decoration: none; }
  #panel { width: 640px; margin: 60px auto; background: #fff; border: 1px solid #b7c2cc; }
  #panel h1 { margin: 0; padding: 10px 14px; background: #6e99c9; color: #fff; font: bold 14px Verdana, sans-serif; }
  #panel .body { padding: 18px 22px 26px; }
  #panel p { margin: 0 0 12px; }
  #panel code { background: #f2f5f8; border: 1px solid #d6dee6; padding: 1px 4px; font: 11px Consolas, monospace; }
  #panel a.button { display: inline-block; margin-top: 6px; padding: 5px 14px; background: #2e8b2e; color: #fff; text-decoration: none; font-weight: bold; border: 1px solid #226b22; }
</style>
</head>
<body>
<div id="header"><a href="/">ROBLOX</a></div>
<div id="panel">
  <h1>Not in this capture</h1>
  <div class="body">
    <p>This page existed on roblox.com in December 2010, but the Wayback Machine
       never saved a copy of it. There is nothing to reconstruct from.</p>
    <p>Requested: <code>${pathname.replace(/</g, '&lt;')}</code></p>
    <p><a class="button" href="/">Back to the home page</a></p>
  </div>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Request handling.
// ---------------------------------------------------------------------------

const server = createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host}`);
  } catch {
    return send(res, 400, 'bad request');
  }
  const path = decodeURIComponent(url.pathname);

  // Ad iframes.
  if (path.toLowerCase() === '/ads/iframeadcontent.aspx') {
    return sendHtml(res, 200, '<!doctype html><html><body style="margin:0;background:#f5f5f5"></body></html>');
  }

  // Analytics pixel.
  if (path.toLowerCase() === '/analytics/badhtmlimage.ashx') {
    res.writeHead(200, { 'content-type': 'image/gif', 'cache-control': 'no-cache' });
    return res.end(TRANSPARENT_GIF);
  }

  // Avatar and asset thumbnails. The t0bg-t7bg hosts were never crawled, so every
  // request for one lands here; a flat wash keeps the grid intact. The `undefined`
  // entry is this build's own dead end: when an image errors and its blankurl is
  // missing, the 2010 control sets src to undefined, which a page under /p/
  // resolves to /p/undefined.
  if (path === '/undefined' || path.endsWith('/undefined') || /^\/ext\/t\d?bg\.roblox\.com\//i.test(path)) {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-cache' });
    return res.end(BLANK_THUMB);
  }

  if (/^\/(thumbs|asset|avatar)\//i.test(path) && /\.(png|jpg|gif)$/i.test(path)) {
    if (await serveFile(path, res)) return;
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-cache' });
    return res.end(BLANK_THUMB);
  }

  if (path.toLowerCase() === '/login/dologin.aspx') {
    const body = await readBody(req);
    const params = new URLSearchParams(body);
    const user = params.get('username') || 'Guest';
    res.writeHead(302, {
      'set-cookie': `rbx2010.user=${encodeURIComponent(user)}; Path=/; HttpOnly`,
      location: '/',
    });
    return res.end();
  }

  if (path.toLowerCase() === '/logout') {
    res.writeHead(302, { 'set-cookie': 'rbx2010.user=; Path=/; Max-Age=0', location: '/' });
    return res.end();
  }

  if (req.method === 'POST') return servePostback(req, res, path);

  // Dynamic routes whose per-object pages were captured under a flat name.
  // `/User.aspx?ID=22537` becomes `/p/User-ID22537.aspx`, and `?id=` works too.
  if (/^\/(user|item)\.aspx$/i.test(path)) {
    const id = url.searchParams.get('ID') || url.searchParams.get('id');
    if (id && /^\d+$/.test(id)) {
      const stem = path.toLowerCase().startsWith('/user') ? 'user-id' : 'item-id';
      const hit = findFile(`/p/${stem}${id}.aspx`);
      if (hit) {
        res.writeHead(301, { location: '/' + hit });
        return res.end();
      }
    }
  }

  if (await serveFile(path, res)) return;

  // A page document stored without its original extension.
  for (const candidate of [`${path}.aspx`, `${path}.html`, `${path.replace(/\/$/, '')}/index.html`]) {
    if (await serveFile(candidate, res)) return;
  }

  if (path === '/' || path === '') return sendHtml(res, 200, notCaptured('/'));
  sendHtml(res, 404, notCaptured(path));
});

server.listen(PORT, () => {
  console.log(`2010 ROBLOX serving at http://localhost:${PORT}/`);
  console.log(`  ${actual.size} files indexed, ${directories.size} directories`);
});
