// Shows the archive-wrapped URLs left inside the forum skin stylesheet, with
// line numbers, so the fix can target the real declarations.
import { readFile } from 'node:fs/promises';

const file = 'site/p/Forum/skins/default/style/default.css';
const body = await readFile(file, 'utf8');
const lines = body.split('\n');

lines.forEach((line, i) => {
  if (line.includes('/web/2011') || line.includes('web/2011')) {
    console.log(String(i + 1).padStart(4), line.trim().slice(0, 240));
  }
});
