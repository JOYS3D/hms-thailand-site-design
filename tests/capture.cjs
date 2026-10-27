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

  // The film plays itself: one gesture per chapter (wheel events, as a mouse or a trackpad sends them)
  await page.setViewportSize({ width: 1440, height: 900 });
  const fp = () => page.evaluate(() => { const f = document.getElementById('film'); return (scrollY - f.offsetTop) / (f.offsetHeight - innerHeight); });
  const cueText = () => page.evaluate(() => document.querySelector('.scroll-cue').textContent);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(900);
  ok((await cueText()) === 'Click or scroll to enter', 'à l\'arrivée, le bouton « Click or scroll to enter » s\'affiche');
  await page.mouse.move(700, 450);
  for (const d of [1, 1, 2, 3, 5, 7, 9, 11]) { await page.mouse.wheel(0, d); await page.waitForTimeout(16); }   // a trackpad gesture starts small
  await page.waitForTimeout(1500);
  const p1 = await fp();
  ok(p1 > 0.02 && p1 < 0.2, 'un geste de trackpad (petits pas) lance la cinématique (p=' + p1.toFixed(3) + ')');
  ok((await cueText()) === 'Skip ›', 'pendant la cinématique, le bouton « Skip › » s\'affiche');
  await page.click('.scroll-cue');                      // Skip
  await page.waitForTimeout(1500);
  const p2 = await fp();
  ok(Math.abs(p2 - 0.592) < 0.004, 'Skip passe la scène et s\'arrête sur le logiciel dessiné (p=' + p2.toFixed(3) + ')');
  ok((await cueText()) === 'Click or scroll to continue', 'à l\'arrêt, « Click or scroll to continue » s\'affiche');
  // click to enter, from the top
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(700);
  await page.mouse.click(1250, 300);
  await page.waitForTimeout(1500);
  const pc = await fp();
  ok(pc > 0.02 && pc < 0.2, 'un clic sur l\'image d\'arrivée lance la visite (p=' + pc.toFixed(3) + ')');
  await page.mouse.wheel(0, 120); await page.waitForTimeout(16); await page.mouse.wheel(0, 120);
  await page.waitForTimeout(1000);
  const pf = await fp();
  ok(pf > pc + 0.08 && pf < 0.592, 'un scroll pendant la visite accélère la scène sans la sauter (p=' + pf.toFixed(3) + ')');
  await page.click('.scroll-cue'); await page.waitForTimeout(1500);
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(400); await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(3500);
  const p3 = await fp();
  ok(Math.abs(p3 - 0.772) < 0.004 && await page.evaluate(() => document.querySelector('.floor-no').textContent === '4'), 'flèche du clavier : l\'ascenseur monte seul jusqu\'à l\'étage 4');
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
