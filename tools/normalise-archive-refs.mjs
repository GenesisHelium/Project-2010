// Removes the last of the Wayback residue from the served tree.
//
// The four 2012-era genre pages were pulled from a later capture, so they still
// carry the archive's playback runtime, its analytics and ad blocks, and a
// `/web/<timestamp><modifier>/http://host/...` wrapper on every reference. This
// tool removes the runtime, drops the trackers, and unwraps each reference back
// to the URL it names, localising the ones the mirror serves.
//
// Every removal is block-scoped: a `<script>` is only deleted together with its
// matching `</script>`, so the tag balance of the document is unchanged. Each
// page is checked against its pre-edit counts and left untouched if the balance
// moved.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PAGES = [
  'p/building-games',
  'p/comedy-games',
  'p/military-games',
  'p/naval-games',
  'p/Parents/BuildersClub.aspx',
  'p/Parents/KeepingKidsSafe.aspx',
  'p/My/Home.aspx',
];

// Hosts the mirror deliberately does not carry. Their tags are removed rather
// than pointed at the live service.
const DROP_HOSTS = [
  'google-analytics.com',
  'googleadservices.com',
  'redir.adap.tv',
  'web-static.archive.org',
];

// Links that only make sense as a live site.
const KEEP_ABSOLUTE = new Set(['blog.roblox.com', 'corp.roblox.com', 'truste.org', 'www.truste.org',
  'bbb.org', 'www.bbb.org']);

const WRAPPER = /^(?:(?:https?:)?\/\/web\.archive\.org)?\/web\/\d{14}[a-z]{0,3}_?\//;

// Walks the document and yields every <script>...</script> range, bounded so a
// malformed file cannot run away.
function scriptBlocks(body) {
  const blocks = [];
  const open = /<script\b/gi;
  let match;
  while ((match = open.exec(body))) {
    const start = match.index;
    const close = body.toLowerCase().indexOf('</script>', start);
    if (close === -1 || close - start > 60000) continue;
    blocks.push({ start, end: close + '</script>'.length, text: body.slice(start, close + 9) });
    open.lastIndex = close + 9;
  }
  return blocks;
}

// Removes the first script block whose text satisfies the predicate.
function dropScript(body, predicate) {
  const blocks = scriptBlocks(body);
  const hit = blocks.find((b) => predicate(b.text));
  if (!hit) return body;
  return body.slice(0, hit.start) + body.slice(hit.end);
}

function dropArchiveRuntime(body) {
  // Single-line tags served from the archive's own static host.
  body = body.replace(/<script\b[^>]*web-static\.archive\.org[^>]*>\s*<\/script>/gi, '');
  body = body.replace(/<link\b[^>]*web-static\.archive\.org[^>]*\/?>/gi, '');
  body = body.replace(/<script\b[^>]*>\s*window\.RufflePlayer[\s\S]{0,400}?<\/script>/gi, '');
  // The __wm bootstrap.
  body = dropScript(body, (text) => text.includes('__wm.init') || text.includes('__wm.wombat'));
  // The archive's footer commentary.
  const close = body.lastIndexOf('</html>');
  if (close !== -1) body = body.slice(0, close + '</html>'.length);
  return body;
}

function dropTrackers(body) {
  body = dropScript(body, (text) => /urchin\.js|_uacct|urchinTracker/.test(text));
  body = dropScript(body, (text) => /var _gaq = _gaq \|\| \[\];/.test(text));
  body = dropScript(body, (text) => /rbxAdwordsTracker_AdWordConversionTracker|google_conversion_id/.test(text));
  body = dropScript(body, (text) => /googleadservices\.com\/pagead\/conversion/.test(text));
  // The remarketing pixel that sat in the same div.
  body = body.replace(/<img\b[^>]*googleadservices\.com[^>]*>/gi, '');
  return body;
}

const hostOf = (raw) => {
  try { return new URL(raw).hostname.toLowerCase(); } catch { return ''; }
};

function localise(raw) {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  const query = url.search;

  if (DROP_HOSTS.some((h) => host === h || host.endsWith('.' + h))) return null;
  if (KEEP_ABSOLUTE.has(host)) return raw;

  if (host === 'www.roblox.com' || host === 'roblox.com') {
    // 2012 vanity item URLs; 2010 served items from Item.aspx with the ID.
    const item = path.match(/^\/([^/]+)-item$/i);
    if (item && query) {
      const params = new URLSearchParams(query.slice(1));
      const id = params.get('ID') || params.get('id');
      if (id) return `/Item.aspx?id=${id}`;
    }
    // 2012 kept the compiled master bundles under /js/m/.
    const master = path.match(/^\/js\/m\/(.+)$/i);
    if (master) return `/js/${master[1]}`;
    // The 2010 sheet is what the mirror serves.
    if (/^\/css\/base\/css\/allcss\.ashx$/i.test(path)) return '/CSS/Base/CSS/AllCSS.ashx';
    if (/^\/scriptresource\.axd$/i.test(path)) return '/ScriptResource.axd';
    if (/^\/webresource\.axd$/i.test(path)) return '/WebResource.axd';
    if (/^\/ads\/iframeuseradcontent\.aspx$/i.test(path)) return '/Ads/IFrameAdContent.aspx';
    return path + query;
  }

  if (host === 'ajax.aspnetcdn.com' || host === 'imagesak.roblox.com') {
    return `/ext/${host}${path}`;
  }

  return raw;
}

function unwrapValue(value) {
  const match = value.match(WRAPPER);
  if (!match) return value;
  const inner = value.slice(match[0].length);
  let resolved;
  try { resolved = localise(inner); } catch { return value; }
  return resolved === null ? '' : resolved;
}

function unwrapDocument(body) {
  // Attributes.
  body = body.replace(/\b(href|src|action)="([^"]*\/web\/\d{14}[^"]*)"/gi, (whole, attr, value) =>
    `${attr}="${unwrapValue(value)}"`);

  // Inline style backgrounds.
  body = body.replace(/url\('([^']*\/web\/\d{14}[^']*)'\)/gi, (whole, value) => {
    const resolved = unwrapValue(value);
    return resolved ? `url('${resolved}')` : 'none';
  });

  // Absolute archive URLs written into script strings.
  body = body.replace(/"(https?:\/\/web\.archive\.org\/web\/\d{14}[a-z]{0,3}_?\/[^"]+)"/gi, (whole, value) => {
    const resolved = unwrapValue(value);
    return `"${resolved}"`;
  });

  return body;
}

const balance = (body) => {
  const count = (re) => (body.match(re) || []).length;
  return {
    script: count(/<script\b/gi) - count(/<\/script>/gi),
    div: count(/<div\b/gi) - count(/<\/div>/gi),
    form: count(/<form\b/gi) - count(/<\/form>/gi),
  };
};

let touched = 0;
for (const page of PAGES) {
  const file = join('site', page);
  const before = await readFile(file, 'utf8');
  const beforeBalance = balance(before);

  let body = dropArchiveRuntime(before);
  body = dropTrackers(body);
  body = unwrapDocument(body);
  body = body.replace(/\n{3,}/g, '\n\n');

  const afterBalance = balance(body);
  if (JSON.stringify(beforeBalance) !== JSON.stringify(afterBalance)) {
    console.log(`${page}: SKIPPED, tag balance moved ${JSON.stringify(beforeBalance)} -> ${JSON.stringify(afterBalance)}`);
    continue;
  }

  if (body === before) {
    console.log(`${page}: unchanged`);
    continue;
  }

  await writeFile(file, body);
  const left = (body.match(/\/web\/\d{14}/g) || []).length;
  console.log(`${page}: ${before.length} -> ${body.length} bytes, ${left} archive refs left`);
  touched++;
}

console.log(`${touched} page(s) rewritten`);
