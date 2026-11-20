// Verifies the third-party seal assets that were just pulled: the stylesheets
// and every image they reference, exactly as the browser requests them.
const BASE = process.env.BASE || 'http://localhost:2010';

const PATHS = [
  '/ext/bbb.org/online/brand/css/popup.css',
  '/ext/bbb.org/online/brand/css/resizeable_form_table.css',
  '/ext/bbb.org/online/brand/images/logo.gif',
  '/ext/bbb.org/online/brand/images/roundbox-outTop.png',
  '/ext/bbb.org/online/brand/images/resizeable_form_table/popup-top-left.gif',
  '/ext/bbb.org/online/Cimages/alert.gif',
  '/ext/bbb.org/online/Cimages/start-with-trust_7469.jpg',
  '/ext/bbb.org/online/consumer/cks.aspx',
  '/Forum/skins/default/style/default.css',
];

for (const path of PATHS) {
  try {
    const res = await fetch(BASE + path);
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') || '';
    console.log(`${String(res.status).padEnd(4)} ${String(buf.length).padStart(7)}b  ${type.padEnd(28)} ${path}`);
  } catch (err) {
    console.log(`ERR  ${path}  ${err.message}`);
  }
}
