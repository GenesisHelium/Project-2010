// Pulls the BBB seal images the mirrored stylesheets and modal page ask for.
// They are third-party assets the original crawl never followed; the archive
// still has most of them.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const files = [
  ['online/brand/css/popup.css', '../images/BBB_bluebutton_bg.jpg'],
  ['online/brand/css/popup.css', '../images/BBB_orangebutton_bg.jpg'],
  ['online/brand/css/popup.css', '../images/bl-find-out.gif'],
  ['online/brand/css/popup.css', '../images/bl-out.gif'],
  ['online/brand/css/popup.css', '../images/br-find-out.gif'],
  ['online/brand/css/popup.css', '../images/br-out.gif'],
  ['online/brand/css/popup.css', '../images/dotline-yell.gif'],
  ['online/brand/css/popup.css', '../images/err-red.gif'],
  ['online/brand/css/popup.css', '../images/logo.gif'],
  ['online/brand/css/popup.css', '../images/ml-find-out.gif'],
  ['online/brand/css/popup.css', '../images/ml-out.gif'],
  ['online/brand/css/popup.css', '../images/mr-find-out.gif'],
  ['online/brand/css/popup.css', '../images/mr-out.gif'],
  ['online/brand/css/popup.css', '../images/popup_yellow_bot.gif'],
  ['online/brand/css/popup.css', '../images/roundbox-outBot.png'],
  ['online/brand/css/popup.css', '../images/roundbox-outTop.png'],
  ['online/brand/css/popup.css', '../images/tl-find-out.gif'],
  ['online/brand/css/popup.css', '../images/tl-out.gif'],
  ['online/brand/css/popup.css', '../images/tr-find-out.gif'],
  ['online/brand/css/popup.css', '../images/tr-out.gif'],
  ['online/consumer/cks.aspx', '../brand/images/resizeable_form_table/popup-top-left.gif'],
  ['online/consumer/cks.aspx', '../brand/images/resizeable_form_table/popup-top-right.gif'],
  ['online/consumer/cks.aspx', '../brand/images/resizeable_form_table/popup-bottom-left.gif'],
  ['online/consumer/cks.aspx', '../brand/images/resizeable_form_table/popup-bottom-right.gif'],
  ['online/consumer/cks.aspx', '../Cimages/alert.gif'],
  ['online/consumer/cks.aspx', '../Cimages/start-with-trust_7469.jpg'],
];

const seen = new Set();
for (const [page, ref] of files) {
  const resolved = new URL(ref, `http://www.bbb.org/${page}`).pathname;
  if (seen.has(resolved)) continue;
  seen.add(resolved);

  const out = join('site', 'ext', 'bbb.org', resolved.replace(/^\//, ''));
  await mkdir(dirname(out), { recursive: true });

  const url = `https://web.archive.org/web/2010id_/http://www.bbb.org${resolved}`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.log(`error ${resolved}: ${err.message}`);
    continue;
  }
  if (!res.ok) {
    console.log(`miss  ${resolved}: ${res.status}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(out, buf);
  console.log(`wrote ${resolved} (${buf.length} bytes)`);
}
