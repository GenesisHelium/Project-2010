// Shows the two ad/video blocks left on the home page after the featured-game
// panel came out, so both can be removed at their container.
import { readFile } from 'node:fs/promises';

const html = await readFile('site/p/Default.aspx', 'utf8');

for (const marker of ['FrontPageRectangleAd', 'youtube.com/v/', 'VideoPreRoll']) {
  const at = html.indexOf(marker);
  console.log(`\n=== ${marker} @${at}`);
  if (at >= 0) console.log(html.slice(Math.max(0, at - 500), at + 700));
}
