// Lists script tags that do not pair up, with line numbers, so a bad cut shows
// itself instead of being guessed at.
import { readFile } from 'node:fs/promises';

const page = process.argv[2] || 'building-games';
const body = await readFile(`site/p/${page}`, 'utf8');
const lines = body.split('\n');

let depth = 0;
lines.forEach((line, i) => {
  const opens = (line.match(/<script\b/gi) || []).length;
  const closes = (line.match(/<\/script>/gi) || []).length;
  if (!opens && !closes) return;
  const before = depth;
  depth += opens - closes;
  if (depth < 0 || (opens && before === 0 && closes === 0)) {
    console.log(String(i + 1).padStart(4), `depth ${before}->${depth}`, line.trim().slice(0, 120));
  }
});
console.log(`final depth ${depth}`);
