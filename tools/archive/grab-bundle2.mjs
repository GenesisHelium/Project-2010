// Fetches the nearest archived Roblox script bundle, reports what versions it
// carries, and stores a wombat-free copy. The December 2010 descriptor was never
// captured, so the closest surviving snapshot is the documented fallback.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');
const WB = 'https://web.archive.org/web';

const CANDIDATES = [
  { ts: '20111018052548', desc: '-2beTD1QX0pVVYI2H5_Z9TceRLv3XXOVuYieQA4sC2MP6aho40MDJBqyORqfwLFszf62EB5rfotYpVhGyPwgeuNDf_gdB5y-wgV_5afpFn6-9d4_S-bNZRqa9c2Hl-n_xebrPrP2jNBI77sW1qSFqNCWUwuY76W6m5dGkVKCyLtklEVP1dxvaEyj5JkGv7N1hEmtNNrYykHn4SlGjkoIjlrXLpG-a114D_1Bn4Y04MGyDrvCdnLujdkMPaUoaCLH1AXGA5hw0X1AvG82COfTnU8-PO7bP3UaJAfTw7lbyw8dQyyBc2oBO5OzHcF26PaIHWVF2k6micx9WVO6oC57qRk6gCDPivomeApnqqj6nqF2XR1IkNbz7Kstpv9EmpTei4C13IXbW92hmJnQifOw4KDPW0gYfLIKfskotRr--I2WMccqGVkqOcKXUmFgm6ugQXwdPCNSVoCmFFIc9G-In-21JeUEHfiKzX_zRQqCmuodJZj5lha_uZZroH9tm33aMcFtpxy3Oewk-5MyP1iipwtf2_dBy1qoYPsCaxEMjG3DNyaZN8BB6m9qoEH1FK5v4QaD6ezxuSKj5u5pKyI61nVk-HZZU4js5P8TbtReG2HpRxhk0' },
];

function stripWombat(src) {
  const start = src.indexOf('var _____WB$wombat$assign$function_____');
  if (start === -1) return src;
  const open = src.indexOf('{', src.indexOf('__WB_pmw'));
  if (open === -1) return src;
  let depth = 0, i = open;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(0, start) + src.slice(i + 1);
}

for (const { ts, desc } of CANDIDATES) {
  const url = `${WB}/${ts}js_/http://www.roblox.com/ScriptResource.axd?d=${desc}`;
  const r = await fetch(url, { headers: { 'user-agent': 'mirror' }, redirect: 'follow' });
  if (!r.ok) { console.log(`miss ${ts} ${r.status}`); continue; }
  const raw = await r.text();
  const clean = stripWombat(raw);
  console.log(`fetched ${clean.length} bytes (raw ${raw.length})`);

  const jq = clean.match(/jQuery JavaScript Library v?([\d.]+)/i) || clean.match(/jquery[:\s]*v?([12]\.\d+\.\d+)/i);
  const msa = clean.match(/MicrosoftAjax.*?(\d+\.\d+\.\d+)/i);
  console.log('jQuery version:', jq?.[1] ?? 'not detected');
  console.log('MSAjax:', msa?.[1] ?? 'not detected');
  console.log('has Type.registerNamespace:', clean.includes('Type.registerNamespace'));
  console.log('has Sys.Application:', clean.includes('Sys.Application'));
  console.log('has Roblox.Controls.Image:', clean.includes('Roblox.Controls'));

  const dest = join(SITE, 'js/scriptresource-cmaa.js');
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, clean);
  console.log('wrote', dest);
  break;
}
