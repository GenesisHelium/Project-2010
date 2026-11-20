const WRAPPED = /^(?:(?:https?:)?\/\/web\.archive\.org)?\/web\/\d{14}(?:[a-z]{2}_)?\/(.+)$/;

const samples = [
  '/web/20120609010843cs_/http://www.roblox.com/CSS/Base/CSS/AllCSS.ashx?v=20120607bqrwefu&amp;t=RBX2',
  '/web/20120609010843/http://www.roblox.com/all-games',
  'https://web.archive.org/web/20120609010843/http://www.roblox.com/games.aspx?g=building&amp;feed=rss',
  '//web.archive.org/web/20120609010843js_/http://ajax.aspnetcdn.com/ajax/jQuery/jquery-1.7.2.min.js',
];

for (const s of samples) {
  const m = s.match(WRAPPED);
  console.log(m ? `OK  -> ${m[1]}` : `NO  -> ${s}`);
}
