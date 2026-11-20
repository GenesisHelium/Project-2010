// Full depth walk for <script> tags: prints every line where the running depth
// changes, and the final depth, so an unclosed tag shows itself.
import { readFile } from 'node:fs/promises';

const page = process.argv[2] || 'building-games';
const body = await readFile(`site/p/${page}`, 'utf8');
const lines = body.split('\n');

let depth = 0;
const trace = [];
lines.forEach((line, i) => {
  const opens = (line.match(/<script\b/gi) || []).length;
  const closes = (line.match(/<\/script>/gi) || []).length;
  if (!opens && !closes) return;
  const before = depth;
  depth += opens - closes;
  trace.push(`${String(i + 1).padStart(4)} ${String(before).padStart(2)}->${String(depth).padStart(2)} o${opens} c${closes}  ${line.trim().slice(0, 150)}`);
});

console.log(trace.join('\n'));
console.log(`\nfinal depth ${depth}`);
