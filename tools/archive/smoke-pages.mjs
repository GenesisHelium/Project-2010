// Smoke test for the freshly restarted server: the pages the last pipeline pass
// touched, plus the aliases whose code changed.
const BASE = process.env.BASE || 'http://localhost:2010';

const PATHS = [
  '/',
  '/chat/chat.css',
  '/building-games',
  '/comedy-games',
  '/military-games',
  '/naval-games',
  '/horror-games',
  '/western-games',
  '/My/Home.aspx',
  '/Parents/BuildersClub.aspx',
  '/Parents/KeepingKidsSafe.aspx',
  '/ScriptResource.axd',
  '/WebResource.axd',
  '/CSS/Base/CSS/AllCSS.ashx',
];

for (const path of PATHS) {
  try {
    const res = await fetch(BASE + path, { redirect: 'manual' });
    const body = await res.text();
    const scripts = (body.match(/<script\b/gi) || []).length;
    console.log(`${String(res.status).padEnd(4)} ${String(body.length).padStart(7)}b  ${path}  ${scripts ? scripts + ' script tags' : ''}`);
  } catch (err) {
    console.log(`ERR  ${path}  ${err.message}`);
  }
}
