// Locates assets the initial capture lacked by probing the Wayback resolver across
// a spread of timestamps and known historical path variants.
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';

const TIMES = ['20101210093455', '20101201', '20110101', '20110301', '20110601', '20110901', '20120101', '20090601'];

const targets = [
  { local: 'css/available.png', urls: [
    'http://www.roblox.com/css/available.png',
    'http://www.roblox.com/CSS/Base/CSS/available.png',
    'http://www.roblox.com/images/available.png'] },
  { local: 'css/unavailable.png', urls: [
    'http://www.roblox.com/css/unavailable.png',
    'http://www.roblox.com/CSS/Base/CSS/unavailable.png',
    'http://www.roblox.com/images/unavailable.png'] },
  { local: 'css/close.png', urls: [
    'http://www.roblox.com/css/close.png',
    'http://www.roblox.com/CSS/Base/CSS/close.png'] },
  { local: 'css/mini.png', urls: [
    'http://www.roblox.com/css/mini.png',
    'http://www.roblox.com/CSS/Base/CSS/mini.png'] },
  { local: 'css/chatbarback.jpg', urls: [
    'http://www.roblox.com/css/chatbarback.jpg',
    'http://www.roblox.com/CSS/Base/CSS/chatbarback.jpg',
    'http://www.roblox.com/images/chatbarback.jpg'] },
  { local: 'ext/t0bg.roblox.com/1aa7b0b2fb6ddac704ae6f8482884b1e.png', urls: [
    'http://t0bg.roblox.com/1aa7b0b2fb6ddac704ae6f8482884b1e',
    'http://t1bg.roblox.com/1aa7b0b2fb6ddac704ae6f8482884b1e',
    'http://t2bg.roblox.com/1aa7b0b2fb6ddac704ae6f8482884b1e',
    'http://t3bg.roblox.com/1aa7b0b2fb6ddac704ae6f8482884b1e',
    'http://t4bg.roblox.com/1aa7b0b2fb6ddac704ae6f8482884b1e',
    'http://t5bg.roblox.com/1aa7b0b2fb6ddac704ae6f8482884b1e',
    'http://t6bg.roblox.com/1aa7b0b2fb6ddac704ae6f8482884b1e',
    'http://t7bg.roblox.com/1aa7b0b2fb6ddac704ae6f8482884b1e'] },
];

const isImage = (buf) => buf.length > 60 && (
  (buf[0] === 0x89 && buf[1] === 0x50) ||
  (buf[0] === 0xff && buf[1] === 0xd8) ||
  (buf[0] === 0x47 && buf[1] === 0x49)
);

let recovered = 0;

for (const { local, urls } of targets) {
  let done = false;
  for (const url of urls) {
    if (done) break;
    for (const ts of TIMES) {
      if (done) break;
      try {
        const r = await fetch(`${WB}/${ts}im_/${url}`, {
          headers: { 'user-agent': 'mirror' }, redirect: 'follow',
        });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        if (!isImage(buf)) continue;
        const dest = join(SITE, local);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, buf);
        console.log(`OK   ${local}  ${buf.length}b  <- ${url} @${ts}`);
        recovered++; done = true;
      } catch { /* next */ }
    }
  }
  if (!done) console.log(`MISS ${local}`);
}

console.log(`recovered ${recovered}/${targets.length}`);
