// Tests and captures of the HMS design preview, opened as Yanis opens it (file://, double-click).
// Run: node tests/capture.cjs <output-dir>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// SITE_FILE lets us test the copy on the Desktop exactly as Yanis opens it
const SITE = 'file://' + (process.env.SITE_FILE || path.resolve(__dirname, '..', 'index.html'));
const OUT = process.argv[2] || path.resolve(__dirname, 'captures');
fs.mkdirSync(OUT, { recursive: true });

const checks = [];
const errors = [];
function ok(cond, label) { if (!cond) { errors.push('ÉCHEC ' + label); } else { checks.push(label); } }

async function scrollToP(page, p) {
  await page.evaluate((p) => {
    const f = document.getElementById('film');
    const y = f.offsetTop + p * (f.offsetHeight - innerHeight);
    window.scrollTo(0, y);
  }, p);
  await page.waitForTimeout(450);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });

  // ---------- Desktop, JavaScript on ----------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('JS: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(SITE, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  ok(await page.evaluate(() => document.documentElement.classList.contains('film-live')), 'film en mode animé');
  const vt = await page.evaluate(() => { const v = document.querySelector('.media-video'); return v ? v.currentTime : -1; });
  ok(vt > 0, 'la vidéo d\'ouverture joue (t=' + vt.toFixed(2) + ' s)');
  const broken = await page.evaluate(() => Array.from(document.images).filter((i) => i.loading !== 'lazy' && !(i.complete && i.naturalWidth > 0)).map((i) => i.src));
  await page.waitForTimeout(2500);
  ok(await page.evaluate(() => { const i = new Image(); i.src = 'assets/seq/v2/079.webp'; return new Promise((r) => { i.onload = () => r(true); i.onerror = () => r(false); }); }), 'les images de l\'ascenseur existent');
  ok(broken.length === 0, 'images du film chargées' + (broken.length ? ' (manquent : ' + broken.join(', ') + ')' : ''));
  const P = [0, 0.12, 0.2, 0.28, 0.35, 0.42, 0.47, 0.52, 0.58, 0.62, 0.7, 0.76, 0.82, 0.91, 0.98];
  for (const p of P) {
    await scrollToP(page, p);
    await page.screenshot({ path: path.join(OUT, `desktop-film-${String(Math.round(p * 100)).padStart(3, '0')}.png`) });
  }
  const solid = await page.evaluate(() => { const f = document.getElementById('film'); scrollTo(0, f.offsetTop + f.offsetHeight + 10); return true; });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.documentElement.classList.contains('is-solid')), 'en-tête blanc après le film');
  ok(!(await page.evaluate(() => document.body.innerText.includes('4,250'))), 'les chiffres d\'illustration du logiciel ne sont pas du texte de la page');
  for (const id of ['results', 'voices', 'insights', 'contact']) {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'start' }), id);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: path.join(OUT, `desktop-${id}.png`) });
    if (id === 'results') {
      for (const k of [1, 2]) {
        await page.evaluate((k) => window.scrollBy(0, innerHeight * 0.75), k);
        await page.waitForTimeout(2600);
        await page.screenshot({ path: path.join(OUT, `desktop-results-${k}.png`) });
      }
      ok(await page.evaluate(() => { const v = document.querySelector('.card-video'); return !!(v && v.getAttribute('src')); }), 'les vidéos des résultats se chargent quand on y arrive');
      ok(await page.evaluate(() => document.querySelector('.card-figure').getAttribute('aria-label') === '+41%'), 'le chiffre qui tourne garde sa vraie valeur (+41%)');
    }
  }
  // Interactions
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
  await page.click('.lang-th');
  ok(await page.isVisible('#th-tip'), 'bouton ไทย : la bulle « version thaïe » s\'ouvre');
  await page.click('#notes-toggle');
  ok(await page.evaluate(() => document.documentElement.classList.contains('notes-off')), 'les notes de design se masquent');
  await page.click('#notes-toggle');
  ok(!(await page.evaluate(() => document.documentElement.classList.contains('notes-off'))), 'les notes de design reviennent');
  for (const w of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(150);
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'aucun débordement horizontal à ' + w + ' px');
  }

  // The film plays like a video: it enters as before, then play / pause, 5 s back or forward, a timeline to drag
  await page.setViewportSize({ width: 1440, height: 900 });
  const fp = () => page.evaluate(() => { const f = document.getElementById('film'); return (scrollY - f.offsetTop) / (f.offsetHeight - innerHeight); });
  const cueText = () => page.evaluate(() => document.querySelector('.scroll-cue').textContent);
  const st = () => page.evaluate(() => window.HMSFilm.state());
  const shown = (sel) => page.evaluate((s) => { const c = getComputedStyle(document.querySelector(s)); return c.visibility === 'visible' && c.opacity === '1'; }, sel);
  const label = () => page.evaluate(() => document.querySelector('.pl-play').getAttribute('aria-label'));
  const track = async (x) => { const bx = await page.locator('.pl-track').boundingBox(); return [bx.x + bx.width * x, bx.y + bx.height / 2]; };
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(900);
  ok((await cueText()) === 'Click or scroll to enter', 'à l\'arrivée, le bouton « Click or scroll to enter » s\'affiche');
  ok(!(await shown('.player')), 'à l\'arrivée, pas de barre de lecture : l\'entrée reste comme avant');
  await page.mouse.move(700, 450);
  for (const d of [1, 1, 2, 3, 5, 7, 9, 11]) { await page.mouse.wheel(0, d); await page.waitForTimeout(16); }   // a trackpad gesture starts small
  await page.waitForTimeout(1500);
  const p1 = await fp();
  ok(p1 > 0.02 && p1 < 0.2, 'un geste de trackpad (petits pas) lance le film (p=' + p1.toFixed(3) + ')');
  await page.waitForTimeout(500);
  ok(await shown('.player') && (await label()) === 'Pause', 'dès que le film démarre, la barre de lecture apparaît (bouton pause)');
  await page.screenshot({ path: path.join(OUT, 'desktop-lecteur-lecture.png') });
  await page.click('.pl-play');
  const sa = await st(), pa = await fp(); await page.waitForTimeout(1200); const sb = await st();
  ok(!sb.playing && Math.abs(sb.t - sa.t) < 0.01 && Math.abs((await fp()) - pa) < 0.0005, 'pause : le film s\'arrête et l\'image ne bouge plus');
  ok((await label()) === 'Play', 'en pause, le bouton devient « lecture »');
  await page.click('.pl-fwd'); await page.click('.pl-fwd');
  const sf = await st();
  ok(Math.abs(sf.t - (sb.t + 10)) < 0.05, '+5 s deux fois : le film avance de 10 s (' + sb.t.toFixed(1) + ' → ' + sf.t.toFixed(1) + ' s)');
  await page.click('.pl-back');
  const sk = await st();
  ok(Math.abs(sk.t - (sf.t - 5)) < 0.05, '-5 s : le film recule de 5 s (→ ' + sk.t.toFixed(1) + ' s)');
  let xy = await track(0.5); await page.mouse.click(xy[0], xy[1]); await page.waitForTimeout(500);
  const sm = await st();
  ok(Math.abs(sm.t - sm.total / 2) < 0.6 && !sm.playing, 'un clic au milieu de la barre amène au milieu du film, toujours en pause (' + sm.t.toFixed(1) + ' / ' + sm.total + ' s)');
  await page.screenshot({ path: path.join(OUT, 'desktop-lecteur-pause.png') });
  xy = await track(0.5); const xy2 = await track(0.25);
  await page.mouse.move(xy[0], xy[1]); await page.mouse.down(); await page.mouse.move(xy2[0], xy2[1], { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(400);
  const sd = await st();
  ok(Math.abs(sd.t - sd.total / 4) < 0.6, 'on fait glisser la barre en arrière : le film suit (' + sd.t.toFixed(1) + ' s)');
  xy = await track(17 / sm.total); await page.mouse.click(xy[0], xy[1]); await page.click('.pl-play');
  await page.waitForTimeout(4600);
  const sc = await st(), pcx = await fp();
  ok(sc.playing && sc.t > 20.5 && pcx > 0.6, 'le film enchaîne les chapitres sans s\'arrêter, comme une vidéo (' + sc.t.toFixed(1) + ' s, p=' + pcx.toFixed(3) + ')');
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press(' '); await page.waitForTimeout(300);
  const s1 = await st();
  await page.keyboard.press(' '); await page.waitForTimeout(300);
  const s2 = await st();
  ok(!s1.playing && s2.playing, 'la barre d\'espace met en pause puis relance');
  await page.keyboard.press('ArrowLeft');
  const s3 = await st();
  ok(s3.t < s2.t - 4.5, 'flèche gauche : 5 s en arrière');
  xy = await track(21.5 / sm.total); await page.mouse.click(xy[0], xy[1]); await page.waitForTimeout(200);   // into the elevator chapter, still playing
  await page.mouse.move(700, 450);
  const sw0 = await st();
  await page.mouse.wheel(0, 120); await page.waitForTimeout(16); await page.mouse.wheel(0, 120);
  await page.waitForTimeout(1000);
  const sw1 = await st();
  ok(sw1.t - sw0.t > 1.8 && sw1.playing, 'un scroll pendant la lecture accélère le chapitre sans le sauter (' + sw0.t.toFixed(1) + ' → ' + sw1.t.toFixed(1) + ' s)');
  await page.click('.pl-play'); await page.waitForTimeout(1100);   // pause, then scroll up: back to the start of the chapter
  await page.mouse.wheel(0, -120); await page.waitForTimeout(2800);
  const pu = await fp();
  ok(Math.abs(pu - 0.592) < 0.004 && !(await st()).playing, 'un scroll vers le haut ramène au début du chapitre (p=' + pu.toFixed(3) + ')');
  xy = await track((sm.total - 2) / sm.total); await page.mouse.click(xy[0], xy[1]); await page.click('.pl-play');
  await page.waitForTimeout(3200);
  const se = await st(), pe = await fp();
  ok(!se.playing && se.t === se.total && Math.abs(pe - 0.985) < 0.003 && (await label()) === 'Play again', 'fin du film : il s\'arrête sur les chiffres, bouton « revoir »');
  const y0 = await page.evaluate(() => scrollY);
  await page.mouse.move(700, 300); await page.mouse.wheel(0, 400); await page.waitForTimeout(600);
  ok((await page.evaluate(() => scrollY)) > y0 + 100, 'après la fin, la molette fait défiler le site normalement');
  await page.evaluate((y) => scrollTo(0, y), y0); await page.waitForTimeout(400);
  await page.click('.pl-play'); await page.waitForTimeout(800);
  const sr = await st();
  ok(sr.playing && sr.t < 1.5, '« revoir » relance le film depuis le début');
  await page.mouse.click(1250, 300); await page.waitForTimeout(300);
  ok(!(await st()).playing, 'un clic sur l\'image met en pause, comme une vidéo');
  // back to the opening screen by hand, then a click on the picture starts the visit
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(700);
  ok((await cueText()) === 'Click or scroll to enter' && !(await st()).entered, 'revenu tout en haut, l\'écran d\'entrée revient');
  await page.mouse.click(1250, 300);
  await page.waitForTimeout(1500);
  const pc = await fp();
  ok(pc > 0.02 && pc < 0.2, 'un clic sur l\'image d\'arrivée lance la visite (p=' + pc.toFixed(3) + ')');
  xy = await track(21 / sm.total); await page.mouse.click(xy[0], xy[1]);   // it was playing: it plays on from there
  await page.waitForTimeout(6500);
  ok(await page.evaluate(() => document.querySelector('.floor-no').textContent === '4'), 'l\'ascenseur monte seul jusqu\'à l\'étage 4');
  await page.evaluate(() => { const f = document.getElementById('film'); scrollTo(0, f.offsetTop + 0.886 * (f.offsetHeight - innerHeight)); });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => /brightness\(0\.[0-6]/.test(document.querySelector('.scene-night .scene-media').style.filter)), 'la nuit commence par un moment sombre');
  await ctx.close();

  // ---------- Phone (iPhone size), JavaScript on ----------
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await mctx.newPage();
  m.on('pageerror', (e) => errors.push('JS mobile: ' + e.message));
  await m.goto(SITE, { waitUntil: 'load' });
  await m.waitForTimeout(1500);
  for (const p of [0, 0.2, 0.36, 0.42, 0.52, 0.7, 0.82, 0.91, 0.98]) {
    await scrollToP(m, p);
    await m.screenshot({ path: path.join(OUT, `mobile-film-${String(Math.round(p * 100)).padStart(3, '0')}.png`) });
  }
  await scrollToP(m, 0);
  await m.tap('.scroll-cue'); await m.waitForTimeout(1500);
  const mb = await m.evaluate(() => { const r = document.querySelector('.player').getBoundingClientRect(), b = document.querySelector('.pl-back').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, btn: b.width, on: window.HMSFilm.state().playing }; });
  ok(mb.on && mb.l >= 0 && mb.r <= mb.w && mb.btn >= 36, 'téléphone : la barre de lecture tient dans l\'écran, boutons de ' + Math.round(mb.btn) + ' px');
  await m.screenshot({ path: path.join(OUT, 'mobile-lecteur.png') });
  await m.tap('.pl-play'); await m.waitForTimeout(300);
  ok(!(await m.evaluate(() => window.HMSFilm.state().playing)), 'téléphone : le bouton pause marche au doigt');
  await m.evaluate(() => scrollTo(0, 0)); await m.waitForTimeout(500);
  await m.click('.menu-btn');
  await m.waitForTimeout(200);
  ok(await m.isVisible('#main-nav a[href="#results"]'), 'menu téléphone : les liens s\'affichent');
  await m.screenshot({ path: path.join(OUT, 'mobile-menu.png') });
  await m.click('#main-nav a[href="#results"]');
  await m.waitForTimeout(1300);
  await m.screenshot({ path: path.join(OUT, 'mobile-results.png') });
  for (const id of ['voices', 'contact']) {
    await m.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'start' }), id);
    await m.waitForTimeout(900);
    await m.screenshot({ path: path.join(OUT, `mobile-${id}.png`) });
  }
  await mctx.close();

  // ---------- JavaScript off: what a robot that does not run scripts sees ----------
  const nctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const n = await nctx.newPage();
  await n.goto(SITE, { waitUntil: 'load' });
  await n.waitForTimeout(800);
  const txt = await n.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(OUT, 'sans-javascript.txt'), txt);
  for (const s of ['95', 'Properties managed', '2010', 'The right room, the right guest, the right', 'Hotel websites', 'Hotel software', 'Revenue management', 'Sales and marketing assessment', 'Read the competition', 'Then the rooms fill', 'What we do for your hotel.', 'Weekly reporting, property by property', '+41%', 'Six Senses Hideaway Yao Noi', '+66 (0)94 939 3554']) {
    ok(txt.includes(s), 'sans JavaScript, le texte est là : « ' + s + ' »');
  }
  await n.screenshot({ path: path.join(OUT, 'sans-javascript-page.png'), fullPage: true });
  await nctx.close();

  // ---------- Reduced motion ----------
  const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const r = await rctx.newPage();
  r.on('pageerror', (e) => errors.push('JS réduit: ' + e.message));
  await r.goto(SITE, { waitUntil: 'load' });
  await r.waitForTimeout(800);
  ok(await r.evaluate(() => !document.documentElement.classList.contains('film-live')), 'mouvement réduit : scènes empilées, sans film');
  await r.screenshot({ path: path.join(OUT, 'mouvement-reduit-page.png'), fullPage: true });
  await rctx.close();

  await browser.close();
  ok(errors.filter((e) => e.startsWith('JS') || e.startsWith('console')).length === 0, 'aucune erreur JavaScript');
  const report = { date: new Date().toISOString(), checks, errors };
  fs.writeFileSync(path.join(OUT, 'resultats.json'), JSON.stringify(report, null, 2));
  console.log(checks.map((c) => 'OK  ' + c).join('\n'));
  if (errors.length) { console.log(errors.join('\n')); process.exitCode = 1; }
})().catch((e) => { console.error(e); process.exit(1); });
