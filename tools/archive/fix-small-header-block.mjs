// Replaces the earlier small-header patch with the full layout block.
//
// The archived sheet carries a second, later #Banner rule that removes the
// captured wood banner, plus a #Header rule that pins the header to the page
// bottom. Both belong to a header variant whose container rule was never
// captured, so the container gets its positioning context back here.
import { readFile, writeFile } from 'node:fs/promises';

const file = 'site/css/allcss.css';
const anchor = '/* reconstructed: small header positioning context */';

const css = await readFile(file, 'utf8');
const at = css.indexOf(anchor);
if (at < 0) {
  console.error('anchor missing — nothing to replace');
  process.exit(1);
}

const block = `/* reconstructed: small header layout
   The archived sheet keeps a second, later #Banner rule that removes the
   captured wood banner and a #Header rule that pins the header to the page
   bottom. Both belong to a header variant whose container rule was never
   captured. Restoring the container, the banner art and the button placement
   keeps these pages on the same header/footer model as the rest of the site. */
#SmallHeaderContainer{position:relative;width:900px;}
#SmallHeaderContainer #Header{position:static;}
#SmallHeaderContainer #Banner{height:72px;background-image:url("/images/WoodBanner.png");background-repeat:no-repeat;background-position:0 0;}
#SmallHeaderContainer #AuthenticationButton{position:absolute;top:6px;left:8px;}
#SmallHeaderContainer #PlayNowButton{position:absolute;top:16px;right:10px;}
`;

await writeFile(file, css.slice(0, at) + block);
console.log(`replaced block at ${at}; sheet is now ${block.length + at} bytes`);
