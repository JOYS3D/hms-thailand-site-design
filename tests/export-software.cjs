// Renders the finished software drawing once, as the still image shown without JavaScript.
// Run: node tests/export-software.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const data = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 3200; c.height = 1800;
    const ctx = c.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    window.HMSDash.draw(ctx, 1600, 900, 1, 0.8, true);
    return c.toDataURL('image/png');
  });
  const out = path.resolve(__dirname, '..', 'assets', 'film', 'software-final.png');
  fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
  console.log('écrit', out, fs.statSync(out).size, 'octets');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
