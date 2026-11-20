// Single headless capture, with the child's output visible, to see why the
// batch run produced nothing.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const out = resolve('qa/newage.png');
const child = spawn(
  'C:/Program Files/Mozilla Firefox/firefox.exe',
  ['-headless', '-screenshot', out, '-window-size', '787,822', 'http://localhost:2010/p/Login/NewAge.aspx'],
  { stdio: 'inherit' }
);
child.on('exit', code => console.log('exit', code));
child.on('error', e => console.log('error', e.message));
setTimeout(() => { child.kill(); console.log('timed out'); }, 60000);
