// Reports the exact line numbers of every structural marker the reset pass needs,
// so each removal can be written against real offsets instead of guesses.
import { readFile } from 'node:fs/promises';

const files = [
  'site/p/Catalog.aspx',
  'site/p/Contests/index.aspx',
  'site/p/Forum/Default.aspx',
  'site/p/Games.aspx',
];

const markers = [
  /AssetsDataList"/,
  /AssetsDataList_ctl00_/,
  /FooterPagerPanel/,
  /Contest History/,
  /ForumGroupRepeater1_ctl01_ForumGroup/,
  /<\/table>\s*$/,
  /GamesRepeater_ctl01_/,
  /GamePageAdDiv/,
  /AdvertisingLeaderboard/,
  /ctl00_Announcement/,
];

for (const file of files) {
  const body = await readFile(file, 'utf8');
  const lines = body.split('\n');
  console.log(`\n=== ${file} (${body.length} bytes, ${lines.length} lines)`);
  lines.forEach((line, i) => {
    for (const m of markers) {
      if (m.test(line)) {
        console.log(`${String(i + 1).padStart(5)}  ${line.trim().slice(0, 120)}`);
        break;
      }
    }
  });
}
