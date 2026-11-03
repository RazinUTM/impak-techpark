// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
/* Smoke test and screenshots of dist/index.html with Playwright (pre-installed in the session).
 * Usage: node tools/shot.js [outdir]   → landing, solo game at three moments, dark theme, phone width. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || path.join(__dirname, '..', 'screenshots');
  fs.mkdirSync(out, { recursive: true });
  const file = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(file);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, '01-landing.png') });
  // start a Rintis practice game
  await page.click('[data-a="solo"][data-level="0"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, '02-solo-setup.png') });
  // select zone C, start the clock at 5 s/month, run a few months
  await page.click('#r-map g[data-act="zone"][data-z="C"]').catch(() => {});
  await page.selectOption('#sel-speed', '5000');
  await page.click('#btn-play');
  await page.waitForTimeout(9000);
  await page.screenshot({ path: path.join(out, '03-solo-running.png') });
  // jump to the next event (Deal Room) and capture it
  await page.click('#btn-step');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, '04-deal.png') });
  // decide (first option) and close the deal, then continue
  await page.click('#r-over .opt').catch(() => {});
  await page.waitForTimeout(300);
  await page.click('#r-over [data-act="solo-close"]').catch(() => {});
  await page.waitForTimeout(600);
  await page.click('#r-over .btn.primary').catch(() => {});   // Continue on the outcome card
  await page.waitForTimeout(400);
  await page.click('#btn-play').catch(() => {});
  await page.waitForTimeout(400);
  // dark theme, open the screen guide
  await page.click('#btn-theme');
  await page.click('#btn-info');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, '05-dark-guide.png') });
  await page.keyboard.press('Escape');
  // BM → EN switch and the Park tab
  await page.click('#btn-lang');
  await page.click('#plot-tabs button[data-plot="park"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, '06-en-park.png') });
  // phone width
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, '07-phone.png'), fullPage: false });
  const state = await page.evaluate(() => { const A = window.IMPAK.APP; const r = window.IMPAK.currentRes(); return { role: A.role, level: r && r.g.level, T: r && r.T, status: r && r.g.status, hold: r && r.ck.hold && r.ck.hold.kind, teams: r && r.teams.length }; });
  console.log(JSON.stringify(state));
  console.log(errors.length ? errors.join('\n') : 'no console errors');
  await browser.close();
})();
