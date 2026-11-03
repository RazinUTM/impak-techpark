// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
/* End-to-end live-mode test against tools/mock_server.js: Game Master creates a room and starts the clock,
 * a team joins with the PIN and places an order, the front screen shows the room. Screenshots to [outdir].
 * Usage: node tools/mock_server.js 8787 &   then   node tools/live_test.js [outdir] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const API = 'http://localhost:8787/exec';
(async () => {
  const out = process.argv[2] || path.join(__dirname, '..', 'screenshots'); fs.mkdirSync(out, { recursive: true });
  const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html') + '?api=' + API;
  const browser = await chromium.launch();
  const errors = [];
  const mk = async (name) => { const c = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); p.on('pageerror', (e) => errors.push(name + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); }); await p.goto(url); await p.waitForTimeout(600); return p; };
  let fails = 0; const check = (l, c, x) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (x ? ' — ' + x : '')); if (!c) fails++; };

  // Game Master
  const gm = await mk('gm');
  await gm.click('[data-a="open"][data-v="gm"]');
  await gm.fill('#j-gmpin', '123456'); await gm.fill('#j-email', 'gm@example.my');
  await gm.click('form.join button[type="submit"]');
  await gm.waitForTimeout(1200);
  let st = await gm.evaluate(() => ({ role: window.IMPAK.APP.role, gmNew: window.IMPAK.APP.ui.gmNew, setupVisible: !!document.querySelector('#app .setup') }));
  check('GM console opens the set-up form', st.role === 'gm' && st.setupVisible, JSON.stringify(st));
  await gm.screenshot({ path: path.join(out, 'L1-gm-setup.png') });
  await gm.click('#app [data-act="gm-create"]');
  await gm.waitForTimeout(1500);
  st = await gm.evaluate(() => ({ room: window.IMPAKLive.room, pins: window.IMPAK.game() && window.IMPAK.game().pins, status: window.IMPAK.game() && window.IMPAK.game().status, teams: window.IMPAK.game() && window.IMPAK.game().teams.length }));
  check('room created with PINs', st.room && st.pins && Object.keys(st.pins).length === st.teams, 'room ' + st.room + ' teams ' + st.teams);
  const room = st.room, pin = st.pins && st.pins.t1;
  await gm.screenshot({ path: path.join(out, 'L2-gm-console.png') });

  // Team
  const team = await mk('team');
  await team.click('[data-a="open"][data-v="live"]');
  await team.fill('#j-room', room); await team.fill('#j-pin', pin); await team.fill('#j-name', 'Ali'); await team.fill('#j-email', 'ali@example.com');
  await team.click('form.join button[type="submit"]');
  await team.waitForTimeout(1500);
  st = await team.evaluate(() => ({ role: window.IMPAK.APP.role, teamId: window.IMPAK.APP.teamId, mode: window.IMPAK.store() && window.IMPAK.store().mode, status: window.IMPAK.game() && window.IMPAK.game().status, locked: document.querySelector('.transport').classList.contains('locked') }));
  check('team joined and waits for the GM', st.role === 'team' && st.teamId === 't1' && st.mode === 'live' && st.status === 'setup' && st.locked, JSON.stringify(st));
  await team.screenshot({ path: path.join(out, 'L3-team-waiting.png') });

  // GM starts the clock; team sees it within a poll
  await gm.click('#app [data-act="gm-start"]');
  await team.waitForTimeout(5500);
  st = await team.evaluate(() => { const r = window.IMPAK.currentRes(); return { status: r && r.g.status, T: r && r.T }; });
  check('team sees the running clock', st.status === 'running' && st.T > 0, JSON.stringify(st));

  // team places an order in zone C
  await team.click('#r-map g[data-act="zone"][data-z="C"]');
  await team.waitForTimeout(400);
  const btn = await team.$('#r-zone button.act:not([disabled])');
  check('an order button is available', !!btn);
  if (btn) { await btn.click(); await team.waitForTimeout(1500); }
  const r = await fetch(API + '?op=state&room=' + room).then((x) => x.json());
  check('order reached the server', r.orders && r.orders.t1 && r.orders.t1.length === 1, JSON.stringify(r.orders));
  await team.screenshot({ path: path.join(out, 'L4-team-live.png') });

  // GM sees the order count; front screen opens
  await gm.waitForTimeout(5000);
  st = await gm.evaluate(() => ({ n: (window.IMPAK.store().ordersFor('t1') || []).length }));
  check('GM store received the order', st.n === 1, JSON.stringify(st));
  const scr = await mk('screen');
  await scr.click('[data-a="screen"]');
  await scr.fill('#ask-in', room); await scr.click('dialog.askbox [data-a="ok"]');
  await scr.waitForTimeout(1500);
  st = await scr.evaluate(() => ({ role: window.IMPAK.APP.role, stage: !!document.querySelector('#app .scr') }));
  check('front screen shows the room', st.role === 'screen' && st.stage, JSON.stringify(st));
  await scr.screenshot({ path: path.join(out, 'L5-screen.png') });
  console.log(errors.length ? 'page errors:\n' + errors.join('\n') : 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all live checks passed');
  await browser.close();
  process.exit(fails || errors.length ? 1 : 0);
})();
