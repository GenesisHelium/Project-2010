// Captures the games genre listings at the same size as the main games page.
import { spawn } from 'node:child_process';
import { mkdir, stat, rm, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const firefox = 'C:/Program Files/Mozilla Firefox/firefox.exe';
const wait = ms => new Promise(r => setTimeout(r, ms));

const pages = [
  ['all-games', '/all-games'],
  ['town-and-city-games', '/town-and-city-games'],
  ['medieval-games', '/p/medieval-games'],
  ['scary-games', '/scary-games'],
];

async function capture(path, out) {
  await rm(out, { force: true });
  const profile = await mkdtemp(join(tmpdir(), 'ff-qa-'));
  const child = spawn(firefox, ['-headless', '-profile', profile, '-screenshot', out, '-window-size', '959,821', `http://localhost:2010${path}`], { stdio: 'ignore' });
  await new Promise(r => { const t = setTimeout(r, 90000); child.on('exit', () => { clearTimeout(t); r(); }); });
  for (let i = 0; i < 40; i++) {
    try {
      const s = await stat(out);
      if (s.size > 0) return s.size;
    } catch {}
    await wait(250);
  }
  throw new Error(`no screenshot for ${path}`);
}

await mkdir('qa', { recursive: true });
for (const [name, path] of pages) {
  console.log(`${name}.png  ${await capture(path, resolve(`qa/${name}.png`))} bytes`);
}
