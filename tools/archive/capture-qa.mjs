// Captures every affected page at its reference size and at 1280x800 with the
// installed Firefox in headless screenshot mode. Each capture gets its own
// profile: reusing the default profile makes headless Firefox attach to a stale
// instance and exit without writing.
import { spawn } from 'node:child_process';
import { mkdir, stat, rm, mkdtemp } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const firefox = 'C:/Program Files/Mozilla Firefox/firefox.exe';

const pages = [
  ['newage', '/p/Login/NewAge.aspx', '787,822'],
  ['myhome', '/p/My/Home.aspx', '784,822'],
  ['catalog', '/p/Catalog.aspx', '959,821'],
  ['contests', '/p/Contests/index.aspx', '1060,803'],
  ['forum', '/p/Forum/Default.aspx', '965,822'],
  ['games', '/p/Games.aspx', '961,822'],
];

const wait = ms => new Promise(r => setTimeout(r, ms));

function exitOf(child, ms) {
  return new Promise(resolveExit => {
    const timer = setTimeout(() => resolveExit(null), ms);
    child.on('exit', code => { clearTimeout(timer); resolveExit(code); });
  });
}

async function capture(path, dims, out) {
  await rm(out, { force: true });
  const profile = await mkdtemp(join(tmpdir(), 'ff-qa-'));
  const child = spawn(
    firefox,
    ['-headless', '-profile', profile, '-screenshot', out, '-window-size', dims, `http://localhost:2010${path}`],
    { stdio: 'ignore' }
  );

  await exitOf(child, 90000);
  if (!child.killed) child.kill();

  // Firefox can exit a beat before the file is flushed.
  for (let i = 0; i < 40; i++) {
    try {
      const s = await stat(out);
      if (s.size > 0) return s.size;
    } catch {
      // not yet
    }
    await wait(250);
  }
  throw new Error(`no screenshot for ${path}`);
}

await mkdir('qa', { recursive: true });

for (const [name, path, size] of pages) {
  for (const [suffix, dims] of [['', size], ['-1280', '1280,800']]) {
    const out = resolve(`qa/${name}${suffix}.png`);
    const bytes = await capture(path, dims, out);
    console.log(`${name}${suffix}.png  ${bytes} bytes`);
  }
}
