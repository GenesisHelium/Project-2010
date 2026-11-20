// Prints the pager block boundaries so the reset can cut it by marker instead
// of guessing a span depth.
import { readFile } from 'node:fs/promises';

const html = await readFile('site/p/Forum/ShowForum.aspx', 'utf8');
const start = html.indexOf('ctl00_cphRoblox_ThreadView1_ctl00_Pager');
console.log('start', start);
console.log(html.slice(start - 40, start + 2400));
const tail = html.indexOf('ShowForum.aspx', start);
console.log('\n--- next page marker', tail);
