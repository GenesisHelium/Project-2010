// Compares the root capture with the /p/Default.aspx twin so the same reset can
// be applied to both. Prints markers and the login span markup.
import { readFile } from 'node:fs/promises';

const files = ['site/index.html', 'site/p/Default.aspx'];
for (const file of files) {
  const html = await readFile(file, 'utf8');
  console.log(`\n=== ${file} (${html.length} bytes)`);
  for (const marker of ['Featured Free Game', 'Roblox Stats', 'Roblox News', 'Updated:', 'Favorited:', 'Visited:', 'Parent Login', 'Forgot your password', 'AuthenticationBannerSpan', 'boxAdPanel', 'youtube.com/v/']) {
    console.log(`${marker}: ${html.includes(marker)}`);
  }
  const at = html.indexOf('AuthenticationBannerSpan');
  console.log('login markup:', at >= 0 ? html.slice(Math.max(0, at - 120), at + 180).replace(/\s+/g, ' ') : '(none)');
  const css = html.match(/href="([^"]*allcss[^"]*)"/i);
  console.log('css:', css ? css[1] : '(none)');
}
