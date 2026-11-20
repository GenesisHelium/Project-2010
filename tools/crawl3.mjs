// Crawls a named list of internal pages that the navigation links to.
//
// The check rejects the archive's own interstitial: a saved page must contain the
// site's markup (ctl00_ control ids) and must not carry the Wayback title. Length
// alone was enough to save 123 archive pages as if they were ROBLOX.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';
const TS = '20101210093455';

const TARGETS = [
  '/Default.aspx',
  '/Games.aspx',
  '/Catalog.aspx',
  '/Browse.aspx',
  '/Badges.aspx',
  '/Friends.aspx',
  '/User.aspx',
  '/My/Home.aspx',
  '/Login/Default.aspx',
  '/Login/NewAge.aspx',
  '/Login/ResetPasswordRequest.aspx',
  '/Parents.aspx',
  '/Parents/Login.aspx',
  '/Parents/FAQs.aspx',
  '/Parents/BuildersClub.aspx',
  '/Parents/KeepingKidsSafe.aspx',
  '/Parents/RobloxAndLearning.aspx',
  '/Parents/WhatParentsAreSaying.aspx',
  '/Upgrades/BuildersClub.aspx',
  '/Upgrades/Robux.aspx',
  '/Marketplace/TradeCurrency.aspx',
  '/Groups/group.aspx',
  '/AbuseReport/Asset.aspx',
  '/Help/Builderman.aspx',
  '/info/About.aspx',
  '/info/Privacy.aspx',
  '/info/TermsOfService.aspx',
  '/info/ContactUs.aspx',
  '/Contests/',
  '/Forum/Default.aspx',
];

function localFor(pathname) {
  let local = 'p' + pathname;
  if (local.endsWith('/')) local += 'index';
  if (!/\.(aspx|html?)$/i.test(local)) local += '.aspx';
  return local.replace(/[^A-Za-z0-9._/-]/g, '_') + '.html';
}

function isRealPage(text) {
  if (text.length < 2000) return false;
  if (/<title>\s*Wayback Machine\s*<\/title>/i.test(text.slice(0, 3000))) return false;
  return /ctl00_/.test(text);
}

function stripWayback(html) {
  let out = html;
  const b = out.indexOf('<!-- BEGIN WAYBACK TOOLBAR INSERT -->');
  const e = out.indexOf('<!-- END WAYBACK TOOLBAR INSERT -->');
  if (b !== -1 && e !== -1) out = out.slice(0, b) + out.slice(e + '<!-- END WAYBACK TOOLBAR INSERT -->'.length);

  // The bootstrap script and any leftover archive asset tags.
  for (let i = 0; i < 20; i++) {
    const at = out.indexOf('__wm.init(');
    if (at === -1) break;
    const open = out.lastIndexOf('<script', at);
    const close = out.indexOf('</script>', at);
    if (open === -1 || close === -1) break;
    out = out.slice(0, open) + out.slice(close + 9);
  }
  out = out.replace(/__wm\.rw\([01]\);/g, '');
  out = out.replace(/<script[^>]+web-static\.archive\.org[^>]*><\/script>/g, '');
  out = out.replace(/<link[^>]+web-static\.archive\.org[^>]*>/g, '');
  return out;
}

const pages = JSON.parse(await readFile(join(SITE, '_pages.json'), 'utf8'));
const known = new Map(pages.map(([url, local]) => [url, local]));

let added = 0;
const missed = [];

for (const pathname of TARGETS) {
  const url = 'http://www.roblox.com' + pathname;
  const local = localFor(pathname);
  if (known.has(url) || known.has(url + '/')) continue;

  let saved = false;
  for (const stamp of [TS, '20101201', '20101215', '20110101', '20110601', '2011', '']) {
    if (saved) break;
    try {
      const r = await fetch(`${WB}/${stamp}if_/${url}`, {
        headers: { 'user-agent': 'mirror' }, redirect: 'follow',
      });
      if (!r.ok) continue;
      const text = await r.text();
      if (!isRealPage(text)) continue;
      const dest = join(SITE, local);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, stripWayback(text));
      known.set(url, '/' + local);
      added++;
      saved = true;
      console.log(`page  ${pathname}  ->  ${local}  (${text.length}b @${stamp || 'latest'})`);
    } catch { /* next stamp */ }
  }
  if (!saved) { missed.push(pathname); console.log(`miss  ${pathname}`); }
}

await writeFile(join(SITE, '_pages.json'), JSON.stringify([...known], null, 2));
console.log(`\nadded ${added}, missed ${missed.length}`);
if (missed.length) console.log(missed.join('\n'));
