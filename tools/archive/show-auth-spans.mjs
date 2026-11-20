// Shows every rule that names the banner-authentication spans, so the small
// header can reuse the same art and sizing as the catalog header.
import { readFile } from 'node:fs/promises';

const css = await readFile('site/css/allcss.css', 'utf8');
for (const selector of ['AuthenticationBannerSpan', 'AuthenticationBannerSpanLeft', 'head_bkg_t1', 'head_bkg_t2', 'AuthenticationButton a']) {
  let at = -1;
  let count = 0;
  while ((at = css.indexOf(selector, at + 1)) >= 0 && count < 6) {
    const start = css.lastIndexOf('}', at) + 1;
    const end = css.indexOf('}', at) + 1;
    console.log(`\n[${selector}] @${at}`);
    console.log(css.slice(start, end).slice(0, 400));
    count += 1;
  }
}
