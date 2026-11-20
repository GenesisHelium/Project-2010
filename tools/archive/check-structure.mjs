// Structural sanity check for the pages the normaliser rewrote: tag balance and
// the shape of the head, so damage is caught before the crawl reports it.
//
// A naive `<script` count is wrong on pages that carry the jQuery/MicrosoftAjax
// document.write fallbacks: the string inside document.write("...") contains a
// literal `<script` that the browser never parses as an element. Occurrences
// directly preceded by a quote are skipped for that reason.
import { readFile } from 'node:fs/promises';

const PAGES = ['p/building-games', 'p/comedy-games', 'p/military-games', 'p/naval-games',
  'p/Parents/BuildersClub.aspx', 'p/Parents/KeepingKidsSafe.aspx', 'p/My/Home.aspx'];

function countOpens(body, name) {
  const re = new RegExp(`<${name}\\b`, 'gi');
  let n = 0;
  let m;
  while ((m = re.exec(body))) {
    const before = body[m.index - 1];
    if (before === '"' || before === "'") continue;
    n++;
  }
  return n;
}

for (const page of PAGES) {
  const body = await readFile(`site/${page}`, 'utf8');
  const count = (re) => (body.match(re) || []).length;
  const tags = ['html', 'head', 'body', 'form', 'div'];
  const balance = tags.map((t) => `${t}:${countOpens(body, t)}/${count(new RegExp(`</${t}>`, 'gi'))}`);
  const scripts = `${countOpens(body, 'script')}/${count(/<\/script>/gi)}`;
  console.log(`${page.padEnd(34)} ${body.split('\n').length} lines  script:${scripts}  ${balance.join(' ')}`);
}

const first = await readFile('site/p/building-games', 'utf8');
console.log('\n--- head ---');
console.log(first.split('\n').slice(0, 14).join('\n').slice(0, 1200));
