// Dumps the DarkGradientBox rules and the captures' own gradient assets.
import { readFile, readdir } from 'node:fs/promises';

const css = await readFile('site/css/allcss.css', 'utf8');
for (const selector of ['.DarkGradientBox', '.DGB_Header', '.DGB_Content', '.DGB_Label', '.DGB_Button', '.DGB_TextBox']) {
  let at = -1;
  let count = 0;
  while ((at = css.indexOf(selector, at + 1)) >= 0 && count < 3) {
    const start = css.lastIndexOf('}', at) + 1;
    const end = css.indexOf('}', at) + 1;
    console.log(`\n[${selector}] @${at}`);
    console.log(css.slice(start, end).slice(0, 320));
    count += 1;
  }
}

const images = await readdir('site/images');
console.log('\nimages matching dgb/dark/gradient:', images.filter((n) => /dgb|dark|gradient/i.test(n)).join(', ') || '(none)');
