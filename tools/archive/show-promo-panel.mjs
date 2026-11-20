// Prints the whole promo panel under the login box.
import { readFile } from 'node:fs/promises';

const html = await readFile('site/p/Default.aspx', 'utf8');
const start = html.indexOf('<!-- left column -->');
const second = html.indexOf('<div class="ShadowedStandardBox">', html.indexOf('<div class="ShadowedStandardBox">', start) + 1);
const end = html.indexOf('<!-- right column -->');
console.log(html.slice(second, end));
