// The 2010 site loaded a second stylesheet at /chat/chat.css alongside AllCSS.
// It was never captured: every Wayback timestamp for both /chat/chat.css and
// /chat/css/chat.css answers 404, and the crawl manifest has no entry for either.
// AllCSS itself carries the chat bar and status bar rules, so nothing renders
// differently without it. An empty sheet keeps the request from logging a 404
// on the one page that links it.
import { writeFile } from 'node:fs/promises';

const body = `/* /chat/chat.css was not part of the 2010 capture.
   The chat bar and status bar rules live in /css/allcss.css. */
`;

await writeFile('site/css/chat.css', body);
console.log(`wrote site/css/chat.css (${body.length} bytes)`);
