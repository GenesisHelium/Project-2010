// Empties the seeded content on the catalog, contest, forum and games pages,
// removes the unservable ad slots and the stale site announcement, and clears
// the tracker debris left behind by the capture.
//
// Every removal is marker-driven and bounded: nothing here scans a whole file
// with a lazy regex. Run with --dry to report without writing.
import { readFile, writeFile, mkdir, readdir, copyFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const DRY = process.argv.includes('--dry');
const BACKUP = 'tools/pre-reset';

const stats = { changed: 0, unchanged: 0, removed: {} };

async function* walkHtml(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkHtml(full);
    else if (/\.(html|aspx)$/i.test(entry.name) || !/\.[a-z0-9]{1,5}$/i.test(entry.name)) yield full;
  }
}

// Removes one balanced <div> element starting at `start`.
function removeDivAt(html, start, cap = 60000) {
  const limit = Math.min(html.length, start + cap);
  let i = start;
  let depth = 0;
  while (i < limit) {
    const open = html.indexOf('<div', i);
    const close = html.indexOf('</div>', i);
    if (close < 0) return null;
    if (open >= 0 && open < close) {
      depth++;
      i = open + 4;
      continue;
    }
    depth--;
    i = close + 6;
    if (depth === 0) return { start, end: i };
  }
  return null;
}

function removeAllDivs(html, marker) {
  let removed = 0;
  for (;;) {
    const at = html.indexOf(marker);
    if (at < 0) break;
    const span = removeDivAt(html, at);
    if (!span) break;
    html = html.slice(0, span.start) + html.slice(span.end);
    removed++;
    if (removed > 500) break;
  }
  return { html, removed };
}

// Empties a <table> identified by an opening-tag marker, keeping the tag pair.
function emptyTable(html, marker, keepFirstRow = false) {
  const at = html.indexOf(marker);
  if (at < 0) return { html, removed: 0 };
  const gt = html.indexOf('>', at);
  const close = html.indexOf('</table>', gt);
  if (gt < 0 || close < 0) return { html, removed: 0 };
  let bodyStart = gt + 1;
  if (keepFirstRow) {
    const firstRowEnd = html.indexOf('</tr>', bodyStart);
    if (firstRowEnd < 0 || firstRowEnd > close) return { html, removed: 0 };
    bodyStart = firstRowEnd + 5;
  }
  const inner = html.slice(bodyStart, close);
  if (!inner.trim()) return { html, removed: 0 };
  return { html: html.slice(0, bodyStart) + '\n\t' + html.slice(close), removed: 1 };
}

// Drops the Kontagent block: assignments plus the try/catch that follows them.
function stripKontagent(html) {
  let count = 0;
  for (;;) {
    const at = html.indexOf('KontagentListener.restUrl');
    if (at < 0) break;
    const lineStart = html.lastIndexOf('\n', at) + 1;
    const catchAt = html.indexOf('catch(ex)', at);
    if (catchAt < 0) break;
    const brace = html.indexOf('}', catchAt);
    if (brace < 0) break;
    html = html.slice(0, lineStart) + html.slice(brace + 1);
    count++;
  }
  return { html, count };
}

function stripScriptTags(html, needles) {
  let count = 0;
  for (const needle of needles) {
    for (;;) {
      const at = html.indexOf(needle);
      if (at < 0) break;
      const start = html.lastIndexOf('<script', at);
      const end = html.indexOf('</script>', at);
      if (start < 0 || end < 0) break;
      html = html.slice(0, start) + html.slice(end + 9);
      count++;
    }
  }
  return { html, count };
}

function stripPageSpecific(html, file) {
  const notes = {};
  // walkHtml yields Windows separators; match against a normalised path.
  const at = file.replace(/\\/g, '/');

  // Catalogue: leave the grid table in place with no rows.
  if (/\/Catalog\.aspx$/.test(at)) {
    const t = emptyTable(html, '<table id="ctl00_cphRoblox_rbxCatalog_AssetsDataList"');
    html = t.html;
    if (t.removed) notes.catalogue = 'item grid emptied';
    const pager = html.indexOf('<div id="ctl00_cphRoblox_rbxCatalog_FooterPagerPanel"');
    if (pager >= 0) {
      const span = removeDivAt(html, pager);
      if (span) { html = html.slice(0, span.start) + html.slice(span.end); notes.cataloguePager = 'pager removed'; }
    }
  }

  // Contests: every entry is the same inline-styled div.
  if (/\/Contests\/index\.aspx$/.test(at)) {
    const r = removeAllDivs(html, '<div style="width: 856px; font-size: 16px;');
    html = r.html;
    if (r.removed) notes.contests = `${r.removed} entries removed`;
  }

  // Home page: the featured free game panel, the random-facts panel and the
  // news feed are all seeded content from the capture. The root capture is a
  // second copy of the same page.
  if (/\/p\/Default\.aspx$/.test(at) || /^site\/index\.html$/.test(at)) {
    const featured = html.indexOf('<div class="OutlineBox" style="height: 250px;">');
    if (featured >= 0) {
      const span = removeDivAt(html, featured);
      if (span) { html = html.slice(0, span.start) + html.slice(span.end); notes.featuredGame = 'panel removed'; }
    }
    for (const [label, key] of [['Roblox Stats', 'statsPanel'], ['Roblox News', 'newsPanel']]) {
      const text = html.indexOf(`>${label}<`);
      if (text < 0) continue;
      const box = html.lastIndexOf('<div class="ShadowedStandardBox">', text);
      if (box < 0) continue;
      const span = removeDivAt(html, box);
      if (span) { html = html.slice(0, span.start) + html.slice(span.end); notes[key] = 'panel removed'; }
    }
    // The promo video and the large rectangle ad are Flash/iframe slots with no
    // archived creative; both render as black boxes with a stray [ report ].
    const video = html.indexOf('<object style="width: 380px; height: 250px;">');
    if (video >= 0) {
      const wrap = html.lastIndexOf('<div style="float: right;">', video);
      if (wrap >= 0) {
        const span = removeDivAt(html, wrap);
        if (span) { html = html.slice(0, span.start) + html.slice(span.end); notes.promoVideo = 'removed'; }
      }
    }
    const boxAd = html.indexOf('<div id="ctl00_cphRoblox_boxAdPanel">');
    if (boxAd >= 0) {
      const span = removeDivAt(html, boxAd);
      if (span) { html = html.slice(0, span.start) + html.slice(span.end); notes.boxAd = 'removed'; }
    }
    // The capture's home login box was restyled from a dark gradient to white,
    // but the two secondary links kept their white inline colour and vanished.
    html = html.replaceAll(' style="color: #FFFFFF; font-weight: bold; font-size: 10px;"', ' style="font-weight: bold; font-size: 10px;"');
    // The promo panel kept a fixed height sized for the featured game that was
    // removed; drop the height and the empty wrapper that held the stats block.
    html = html.replace('<div class="Content" style="height: 459px; padding: 0px 0px 0px 0px;">', '<div class="Content" style="padding: 0px;">');
    const deadStats = html.indexOf('<div style="margin-left: 7px; margin-top: 20px; width: 541px;">');
    if (deadStats >= 0) {
      const span = removeDivAt(html, deadStats);
      if (span) { html = html.slice(0, span.start) + html.slice(span.end); notes.emptyPromoSlot = 'removed'; }
    }
  }

  // Forum: keep the column header row, drop every group and forum row.
  if (/\/Forum\/Default\.aspx$/.test(at)) {
    const marker = '<table cellpadding="2" cellspacing="1" border="0" width="100%" class="tableBorder">';
    const t = emptyTable(html, marker, true);
    html = t.html;
    if (t.removed) notes.forum = 'group and forum rows removed';
  }

  // Thread listings inside a forum keep their header row and lose every thread.
  if (/\/Forum\/ShowForum\.aspx$/i.test(at) || /\/Forum\/ShowForum$/i.test(at)) {
    const t = emptyTable(html, '<table id="ctl00_cphRoblox_ThreadView1_ctl00_ThreadList"', true);
    html = t.html;
    if (t.removed) notes.threads = 'thread rows removed';
    // The "new thread" control points at AddPost.aspx and newtopic.gif; neither
    // was captured, so the button renders as a 404 image.
    const link = html.indexOf('ctl00_cphRoblox_ThreadView1_ctl00_NewThreadLinkTop');
    if (link >= 0) {
      const start = html.lastIndexOf('<a', link);
      const end = html.indexOf('</a>', link);
      if (start >= 0 && end > start) {
        html = html.slice(0, start) + html.slice(end + 4);
        notes.newThreadButton = 'dead control removed';
      }
    }
    // With no threads there is nothing to page through or mark as read.
    const pager = html.indexOf('<span id="ctl00_cphRoblox_ThreadView1_ctl00_Pager">');
    if (pager >= 0) {
      const close = html.indexOf('</table></span>', pager);
      if (close > pager) {
        html = html.slice(0, pager) + html.slice(close + '</table></span>'.length);
        notes.pager = 'thread pager removed';
      }
    }
    const markRead = html.indexOf('ctl00_cphRoblox_ThreadView1_ctl00_MarkAllRead');
    if (markRead >= 0) {
      const start = html.lastIndexOf('<a', markRead);
      const end = html.indexOf('</a>', markRead);
      if (start >= 0 && end > start) {
        html = html.slice(0, start) + html.slice(end + 4);
        notes.markRead = 'link removed';
      }
    }
  }

  return finaliseGames(html, notes);
}

// Every games listing — /p/Games.aspx and the genre pages — renders its entries
// as floated 180px cards inside a fixed-height wrapper. The cards go, the empty
// wrapper goes, and the two pager strips follow them.
function finaliseGames(html, notes) {
  const cards = removeAllDivs(html, '<div style="height: 175px; width: 180px; float: left;">');
  html = cards.html;
  if (cards.removed) notes.games = `${cards.removed} entries removed`;

  for (;;) {
    const at = html.indexOf('<div style="height: 70px;">');
    if (at < 0) break;
    const span = removeDivAt(html, at);
    if (!span) break;
    const inner = html.slice(span.start, span.end);
    if (inner.replace(/<[^>]*>/g, '').trim()) break;
    html = html.slice(0, span.start) + html.slice(span.end);
    notes.gamesSpacer = 'empty wrapper removed';
  }

  for (const id of ['ctl00_cphRoblox_rbxGames_HeaderPagerPanel', 'ctl00_cphRoblox_rbxGames_FooterPagerPanel']) {
    const pagerAt = html.indexOf(`<div id="${id}"`);
    if (pagerAt < 0) continue;
    const span = removeDivAt(html, pagerAt);
    if (span) { html = html.slice(0, span.start) + html.slice(span.end); notes.gamesPager = 'pager removed'; }
  }

  return { html, notes };
}

const files = [];
for await (const f of walkHtml('site')) files.push(f);

for (const file of files) {
  const before = await readFile(file, 'utf8');
  let html = before;
  const notes = {};

  // The leaderboard ad slot has no archived creative; its iframe renders blank.
  {
    const at = html.indexOf('<div id="AdvertisingLeaderboard"');
    if (at >= 0) {
      const span = removeDivAt(html, at);
      if (span) { html = html.slice(0, span.start) + html.slice(span.end); notes.leaderboard = 'removed'; }
    }
  }

  // In-page ads (games sidebar) are the same empty iframe.
  {
    const at = html.indexOf('<div id="GamePageAdDiv"');
    if (at >= 0) {
      const span = removeDivAt(html, at);
      if (span) { html = html.slice(0, span.start) + html.slice(span.end); notes.sideAd = 'removed'; }
    }
  }

  // The 2010 admin announcement ("Cool people needed at gametest.roblox.com").
  {
    const at = html.indexOf('<div id="ctl00_Announcement"');
    if (at >= 0) {
      const span = removeDivAt(html, at);
      if (span) { html = html.slice(0, span.start) + html.slice(span.end); notes.announcement = 'removed'; }
    }
  }

  // Tracker scripts that no longer resolve.
  {
    const r = stripScriptTags(html, ['/ext/rt.liftdna.com/', 'esearchvision.com/esi/', 'connect.facebook.net/en_US/all.js']);
    html = r.html;
    if (r.count) notes.trackers = `${r.count} script tags removed`;
  }

  {
    const r = stripKontagent(html);
    html = r.html;
    if (r.count) notes.kontagent = 'block removed';
  }

  // Analytics init for services that are not present in the mirror: the
  // RobloxListener/GoogleListener globals were served by a script the capture
  // never included, so the ready handler throws on every load.
  {
    const at = html.indexOf('RobloxListener.restUrl');
    if (at >= 0) {
      const start = html.lastIndexOf('<script', at);
      const end = html.indexOf('</script>', at);
      if (start >= 0 && end > start) {
        html = html.slice(0, start) + html.slice(end + 9);
        notes.analyticsListener = 'dead init removed';
      }
    }
  }

  // LiveRail ad loader: the vendor script was not captured, so LD_GetData is
  // undefined and the page throws before it renders.
  {
    const at = html.indexOf('LD_GetData();');
    if (at >= 0) {
      const start = html.lastIndexOf('<script', at);
      const end = html.indexOf('</script>', at);
      if (start >= 0 && end > start) {
        html = html.slice(0, start) + html.slice(end + 9);
        notes.liverail = 'dead loader removed';
      }
    }
  }

  {
    const r = stripPageSpecific(html, file);
    html = r.html;
    Object.assign(notes, r.notes);
  }

  if (html === before) { stats.unchanged++; continue; }

  stats.changed++;
  for (const [k, v] of Object.entries(notes)) stats.removed[k] = (stats.removed[k] || 0) + 1;
  console.log(`${file}  ${Object.entries(notes).map(([k, v]) => `${k}: ${v}`).join(', ')}`);

  if (DRY) continue;
  const backup = join(BACKUP, file.replace(/^site[\\/]/, ''));
  await mkdir(dirname(backup), { recursive: true });
  // Keep the first backup: a re-run must not clobber the pristine capture.
  try { await access(backup); } catch { await copyFile(file, backup); }
  await writeFile(file, html);
}

console.log(`\nchanged ${stats.changed}, unchanged ${stats.unchanged}${DRY ? ' (dry run)' : ''}`);
console.log(stats.removed);
