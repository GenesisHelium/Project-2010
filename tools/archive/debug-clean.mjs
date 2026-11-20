const WB = 'https://web.archive.org/web', TS = '20101210093455';
const html = await (await fetch(`${WB}/${TS}if_/http://www.roblox.com/`, { headers: { 'user-agent': 'mirror' } })).text();

const steps = [
  ['toolbar-div', /<div id="wm-ipp-base"[\s\S]*?<div id="wm-ipp-print">[^<]*<\/div>\s*<\/div>/g],
  ['rw0', /<script>\s*__wm\.rw\(0\);<\/script>/g],
  ['bt', /<script>\s*__wm\.bt\([\s\S]*?\);\s*__wm\.rw\(1\);\s*<\/script>/g],
  ['static-script', /<script[^>]+web-static\.archive\.org[^>]*><\/script>/g],
  ['static-link', /<link[^>]+web-static\.archive\.org[^>]*>/g],
  ['begin-end', /<!--\s*BEGIN WAYBACK TOOLBAR INSERT\s*-->[\s\S]*?<!--\s*END WAYBACK TOOLBAR INSERT\s*-->/g],
  ['ipp-print', /<div id="wm-ipp-print">[^<]*<\/div>/g],
  ['footer', /<!--\s*[\s\S]*?playback timings[\s\S]*?-->\s*$/g],
];

let cur = html;
console.log('start'.padEnd(14), cur.length);
for (const [name, re] of steps) {
  const before = cur.length;
  cur = cur.replace(re, '');
  console.log(name.padEnd(14), before, '->', cur.length);
}
