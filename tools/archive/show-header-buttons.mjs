// Dumps every header-button rule and the login markup on a few pages so the
// differing container ids can be reconciled in one shared rule.
import { readFile } from 'node:fs/promises';

const css = await readFile('site/css/allcss.css', 'utf8');
for (const selector of ['#AuthenticationButton', '#Authentication ', '#PlayNowButton', '#Banner #Authentication', '#Banner{', '#Header{', '#SmallHeaderContainer']) {
  let at = -1;
  let count = 0;
  while ((at = css.indexOf(selector, at + 1)) >= 0 && count < 4) {
    const start = css.lastIndexOf('}', at) + 1;
    const end = css.indexOf('}', at) + 1;
    console.log(`\n[${selector}] @${at}`);
    console.log(css.slice(start, end).slice(0, 500));
    count += 1;
  }
}

for (const page of ['site/p/Catalog.aspx', 'site/p/Login/NewAge.aspx', 'site/p/My/Home.aspx']) {
  const html = await readFile(page, 'utf8');
  const at = html.indexOf('LoginHyperLink');
  console.log(`\n=== ${page} @${at}`);
  console.log(html.slice(Math.max(0, at - 700), at + 120));
}
