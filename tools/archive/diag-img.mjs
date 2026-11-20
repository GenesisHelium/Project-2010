// Reports img tags in one or more files whose src is empty or `undefined`,
// accepting both quote styles.
import { readFile } from 'node:fs/promises';

for (const file of process.argv.slice(2)) {
  const text = await readFile(file, 'utf8');
  let n = 0;
  for (const m of text.matchAll(/<img\b[^>]*>/gi)) {
    const src = m[0].match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
    const value = src ? src[2] : null;
    if (value === null || value.trim() === '' || value.trim() === 'undefined') {
      console.log(`${file}: ${m[0].slice(0, 300).replace(/\s+/g, ' ')}`);
      n++;
    }
  }
  console.log(`${file}: ${n} suspicious`);
}
