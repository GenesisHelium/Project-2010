// Prints the script tags in one 2012-era genre page, plus any inline call that
// refers to the tracker globals, so the rewrite can decide what to drop.
import { readFile } from 'node:fs/promises';

const body = await readFile('site/p/building-games', 'utf8');
const lines = body.split('\n');

lines.forEach((line, i) => {
  if (/<script/i.test(line) || /pageTracker|urchin|_gat|adap|Adaptv|vpaid/i.test(line)) {
    console.log(String(i + 1).padStart(4), line.trim().slice(0, 190));
  }
});
