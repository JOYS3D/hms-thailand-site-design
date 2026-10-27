// The film on a slow connection, served over http like GitHub Pages: after "enter", the screen must never go
// empty while a shot is on (the lobby walk to the reception included). Usage: node tests/lent.cjs [out] [Mbps]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..'), OUT = process.argv[2] || path.join(__dirname, 'captures-lent'), MBPS = +(process.argv[3] || 8);
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise(ok => server.listen(0, ok));
  const url = 'http://localhost:' + server.address().port + '/';
  const b = await chromium.launch({ channel: 'chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 860 } });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: MBPS * 125000, uploadThroughput: 250000 });
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.click('.scroll-cue');
  const fails = [], cues = new Set(); let lobby = 0, shot = 0;
  for (let i = 0; i < 400; i++) {
    await p.waitForTimeout(250);
    const s = await p.evaluate(() => {
      const film = document.querySelector('.film'), fc = document.querySelector('.film-canvas');
      const pos = Math.max(0, Math.min(1, (scrollY - film.offsetTop) / (film.offsetHeight - innerHeight)));
      const c = fc.getContext('2d'), w = fc.width, h = fc.height;
      const px = [[0.5, 0.5], [0.25, 0.3], [0.75, 0.7]].map(([x, y]) => c.getImageData(Math.floor(w * x), Math.floor(h * y), 1, 1).data[3]);
      return { pos, drawn: px.some(a => a > 0), cue: document.querySelector('.scroll-cue').textContent };
    });
    cues.add(s.cue.replace(/\d+%/, 'N%'));
    if (s.pos > 0.07 && s.pos < 0.44) { shot++; if (!s.drawn) fails.push(s.pos.toFixed(3)); }
    if (s.pos > 0.3 && s.pos < 0.39) { lobby++; if (lobby === 1) await p.screenshot({ path: path.join(OUT, 'hall.png') }); }
    if (s.pos > 0.58) break;
  }
  await p.screenshot({ path: path.join(OUT, 'tablette.png') });
  const ok = !fails.length && lobby >= 4 && !errs.length;
  console.log((ok ? 'OK ' : 'ÉCHEC ') + MBPS + ' Mbit/s : ' + shot + ' relevés pendant les plans, ' + fails.length + ' écran vide' + (fails.length ? ' (p ' + fails.slice(0, 5).join(', ') + ')' : '') + ', ' + lobby + ' dans le hall ; boutons vus : ' + [...cues].join(' / ') + (errs.length ? ' ; erreurs : ' + errs.join(' ; ') : ''));
  await b.close(); server.close();
  process.exit(ok ? 0 : 1);
})();
