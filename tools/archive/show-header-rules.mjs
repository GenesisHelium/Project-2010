// Prints the rules that place the header buttons, so the small-header layout
// can be reasoned about from the stylesheet instead of the rendered guess.
import { readFile } from 'node:fs/promises';

const css = await readFile('site/css/allcss.css', 'utf8');
const selectors = ['#AuthenticationButton', '#PlayNowButton', '#AuthenticationBannerSpan', '.SignUpAndPlay', '#Banner #Options'];

for (const sel of selectors) {
  let at = -1;
  let shown = 0;
  while ((at = css.indexOf(sel, at + 1)) >= 0 && shown < 4) {
    const start = css.lastIndexOf('}', at) + 1;
    const end = css.indexOf('}', at) + 1;
    console.log(`\n${sel} @${at}`);
    console.log(css.slice(start, end).slice(0, 360));
    shown++;
  }
  if (!shown) console.log(`\n${sel} — no rule`);
}
