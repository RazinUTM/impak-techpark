// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
/* Live room against tools/mock_server.js: the Game Master unticks the benchmark-view box at set-up (benchmarks hidden
 * until the final bell), a team sees nothing about their moves, the GM switches to "one quarter late" from the console
 * and the team then follows a benchmark in News.
 * Usage: node tools/mock_server.js 8787 &   then   node tools/live_bench_test.js [outdir] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const API = 'http://localhost:8787/exec';
(async () => {
  const out = process.argv[2] || path.join(__dirname, '..', 'screenshots'); fs.mkdirSync(out, { recursive: true });
  const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html') + '?api=' + API;
  const browser = await chromium.launch(); const errors = []; let fails = 0;
  const check = (l, c, x) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (x ? ' — ' + x : '')); if (!c) fails++; };
  const mk = async (name) => { const c = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); p.on('pageerror', (e) => errors.push(name + ': ' + e.message)); await p.goto(url); await p.waitForTimeout(700); return p; };
  const gm = await mk('gm');
  await gm.click('[data-a="open"][data-v="gm"]'); await gm.fill('#j-gmpin', '123456'); await gm.fill('#j-email', 'gm@example.my');
  await gm.click('form.join button[type="submit"]'); await gm.waitForTimeout(1200);
  const box = await gm.$('#app [data-act="su-benchview"]'); check('set-up form has the benchmark-view checkbox, ticked by default', !!box && await box.isChecked());
  await box.click(); await gm.waitForTimeout(200);
  await gm.screenshot({ path: path.join(out, 'B-gm-setup.png') });
  await gm.click('#app [data-act="gm-create"]'); await gm.waitForTimeout(1500);
  const room = await gm.evaluate(() => window.IMPAKLive.room), pin = await gm.evaluate(() => window.IMPAK.game().pins.t1);
  let s = await fetch(API + '?op=state&room=' + room).then((x) => x.json());
  check('the room stores benchView = end', s.game && s.game.benchView === 'end', s.game && s.game.benchView);
  const chip = await gm.evaluate(() => { const b = document.querySelector('#app [data-act="gm-benchview"]'); return b ? b.parentElement.innerText : ''; });
  check('GM console shows the setting with a toggle', /final bell|loceng akhir/i.test(chip), chip.replace(/\n/g, ' ').slice(0, 120));
  const team = await mk('team');
  await team.click('[data-a="open"][data-v="live"]'); await team.fill('#j-room', room); await team.fill('#j-pin', pin); await team.fill('#j-name', 'Ali'); await team.fill('#j-email', 'ali@example.com');
  await team.click('form.join button[type="submit"]'); await team.waitForTimeout(1500);
  await gm.click('#app [data-act="gm-start"]'); await team.waitForTimeout(5000);
  await team.click('#plot-tabs button[data-plot="stand"]'); await team.waitForTimeout(300);
  let txt = await team.evaluate(() => document.querySelector('#r-tab .bl') ? document.querySelector('#r-tab .bl').innerText : '');
  check('team: the Standings study is hidden', /final bell|loceng akhir/i.test(txt) && !/bench-open/.test(await team.evaluate(() => document.querySelector('#r-tab').innerHTML)), txt.slice(0, 100));
  await team.click('#plot-tabs button[data-plot="news"]'); await team.waitForTimeout(300);
  await team.click('#r-tab [data-act="news-src"][data-k="ai-garden"]'); await team.waitForTimeout(300);
  txt = await team.evaluate(() => document.querySelector('#r-tab').innerText);
  check('team: the benchmark news is hidden', /final bell|loceng akhir/i.test(txt), txt.slice(0, 100));
  await gm.click('#app [data-act="gm-benchview"]'); await gm.waitForTimeout(800);
  s = await fetch(API + '?op=state&room=' + room).then((x) => x.json());
  check('GM toggle saves benchView = lag', s.game.benchView === 'lag', s.game.benchView);
  await team.waitForTimeout(5500);
  txt = await team.evaluate(() => document.querySelector('#r-tab').innerText);
  check('team: the news follows the benchmark one quarter late after the toggle', /one quarter late|lewat satu suku tahun/i.test(txt), txt.slice(0, 120));
  console.log(errors.length ? 'page errors:\n' + errors.join('\n') : 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all live benchmark checks passed');
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})();
