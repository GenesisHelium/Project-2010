// Re-fetches the recovered script bundle into site/js/scriptresource-cmaa.js.
// Run before clean.mjs when the bundle needs rebuilding from source bytes.
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE = join(ROOT, '..', 'site');

const TS = '20111018052548';
const DESC = '-2beTD1QX0pVVYI2H5_Z9TceRLv3XXOVuYieQA4sC2MP6aho40MDJBqyORqfwLFszf62EB5rfotYpVhGyPwgeuNDf_gdB5y-wgV_5afpFn6-9d4_S-bNZRqa9c2Hl-n_xebrPrP2jNBI77sW1qSFqNCWUwuY76W6m5dGkVKCyLtklEVP1dxvaEyj5JkGv7N1hEmtNNrYykHn4SlGjkoIjlrXLpG-a114D_1Bn4Y04MGyDrvCdnLujdkMPaUoaCLH1AXGA5hw0X1AvG82COfTnU8-PO7bP3UaJAfTw7lbyw8dQyyBc2oBO5OzHcF26PaIHWVF2k6micx9WVO6oC57qRk6gCDPivomeApnqqj6nqF2XR1IkNbz7Kstpv9EmpTei4C13IXbW92hmJnQifOw4KDPW0gYfLIKfskotRr--I2WMccqGVkqOcKXUmFgm6ugQXwdPCNSVoCmFFIc9G-In-21JeUEHfiKzX_zRQqCmuodJZj5lha_uZZroH9tm33aMcFtpxy3Oewk-5MyP1iipwtf2_dBy1qoYPsCaxEMjG3DNyaZN8BB6m9qoEH1FK5v4QaD6ezxuSKj5u5pKyI61nVk-HZZU4js5P8TbtReG2HpRxhk0';

const url = `https://web.archive.org/web/${TS}js_/http://www.roblox.com/ScriptResource.axd?d=${DESC}`;
const res = await fetch(url, { headers: { 'user-agent': 'mirror' }, redirect: 'follow' });
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
const raw = await res.text();

const dest = join(SITE, 'js/scriptresource-cmaa.js');
await mkdir(dirname(dest), { recursive: true });
await writeFile(dest, raw);

console.log(`fetched ${raw.length} bytes`);
console.log('carries jQuery 1.4.4:', raw.includes('jQuery JavaScript Library v1.4.4'));
console.log('carries MicrosoftAjax:', raw.includes('Type.registerNamespace'));
console.log('wrote', dest);
