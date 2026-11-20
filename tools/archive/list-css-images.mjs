// Finds every background image the stylesheet points at, so the missing
// small-header logo can be identified rather than invented.
import { readFile } from 'node:fs/promises';

const css = await readFile('site/css/allcss.css', 'utf8');
const urls = new Set();
for (const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.add(m[1]);
console.log([...urls].sort().join('\n'));
