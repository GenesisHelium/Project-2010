// Prints what the pages that touch RobloxLaunch without a defining script do with
// it, plus their script list, so the right fix is a script tag rather than a shim.
import { readFile } from 'node:fs/promises';

for (const rel of process.argv.slice(2)) {
  const text = await readFile(rel, 'utf8');
  console.log(`=== ${rel}`);
  for (const m of text.matchAll(/<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    console.log(`  script ${m[1].split('?')[0]}`);
  }
  let i = -1;
  while ((i = text.indexOf('RobloxLaunch', i + 1)) !== -1) {
    const around = text.slice(Math.max(0, i - 120), i + 160).replace(/\s+/g, ' ');
    console.log(`  @${i}  ${around}`);
  }
  console.log();
}
