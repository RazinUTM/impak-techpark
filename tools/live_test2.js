// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
/* Second live-mode test (fixes of 5 Nov 2026) against tools/mock_server.js: starting cash set by the GM, typing in
 * the GM message box while the clock runs, manual deal mode, a team choosing in the Deal Room, how often the deal
 * overlay is rebuilt, ending the game, and the way back from the front screen to the console.
 * Usage: node tools/mock_server.js 8787 &   then   node tools/live_test2.js [outdir] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const API = 'http://localhost:8787/exec';
(async () => {
  const out = process.argv[2] || '/tmp/live2'; fs.mkdirSync(out, { recursive: true });
  const url = 'file://' + path.join(__dirname, '..', 'dist', 'index.html') + '?api=' + API;
  const browser = await browser0();
  async function browser0() { return chromium.launch(); }
  const errors = [];
  const mk = async (name) => { const c = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); p.on('pageerror', (e) => errors.push(name + ': ' + e.message)); await p.goto(url); await p.waitForTimeout(600); return p; };
  let fails = 0; const check = (l, c, x) => { console.log((c ? 'ok   ' : 'FAIL ') + l + (x ? ' — ' + x : '')); if (!c) fails++; };

  const gm = await mk('gm');
  await gm.click('[data-a="open"][data-v="gm"]'); await gm.fill('#j-gmpin', '123456'); await gm.fill('#j-email', 'gm@example.my');
  await gm.click('form.join button[type="submit"]'); await gm.waitForTimeout(1200);
  // starting cash 5 -> 8
  for (let i = 0; i < 3; i++) { await gm.click('#app [data-act="step"][data-k="su-cash"][data-d="1"]'); await gm.waitForTimeout(150); }
  await gm.click('#app [data-act="gm-create"]'); await gm.waitForTimeout(1500);
  let st = await gm.evaluate(() => { const g = window.IMPAK.game(); const r = window.IMPAK.currentRes(); return { cash: g.startCash, room: window.IMPAKLive.room, pin: g.pins && g.pins.t1, teamCash: r.teams[0].t.cash, benchCash: r.teams.find((x) => x.bench).t.cash }; });
  check('GM sets the starting cash; teams and benchmarks start with it', st.cash === 8 && st.teamCash === 8 && st.benchCash === 8, JSON.stringify(st));
  const room = st.room, pin = st.pin;

  const team = await mk('team');
  await team.click('[data-a="open"][data-v="live"]'); await team.fill('#j-room', room); await team.fill('#j-pin', pin); await team.fill('#j-name', 'Ali'); await team.fill('#j-email', 'ali@example.com');
  await team.click('form.join button[type="submit"]'); await team.waitForTimeout(1500);
  st = await team.evaluate(() => ({ cash: window.IMPAK.currentRes().teams[0].t.cash, stepsHidden: getComputedStyle(document.querySelector('#task')).display === 'none' || document.querySelector('#task').hidden }));
  check('team starts with 8 Cr; activity steps hidden in a live session', st.cash === 8 && st.stepsHidden, JSON.stringify(st));

  // start, then type a message slowly while the clock runs
  await gm.click('#app [data-act="gm-start"]'); await gm.waitForTimeout(500);
  await gm.click('#gm-notice');
  const msg = 'Sepuluh minit lagi ke checkpoint';
  for (const ch of msg) { await gm.keyboard.type(ch); await gm.waitForTimeout(120); }
  st = await gm.evaluate(() => ({ v: document.querySelector('#gm-notice').value, focused: document.activeElement && document.activeElement.id === 'gm-notice' }));
  check('GM message box keeps focus and text while the console refreshes', st.v === msg && st.focused, JSON.stringify(st));
  await gm.keyboard.press('Enter'); await gm.click('#app [data-act="gm-notice"]').catch(() => {}); await gm.waitForTimeout(5500);
  st = await team.evaluate(() => (document.querySelector('#r-banner .banner.notice') || {}).textContent || '');
  check('team sees the GM message', st.indexOf('Sepuluh minit') >= 0, st.slice(0, 60));

  // manual mode sticks
  await gm.click('#app [data-act="gm-auto"]'); await gm.waitForTimeout(9000);
  const srv = await fetch(API + '?op=state&room=' + room).then((x) => x.json());
  st = await gm.evaluate(() => window.IMPAK.game().auto);
  check('manual mode sticks (GM view and server)', st === false && srv.game.auto === false, 'gm ' + st + ' server ' + srv.game.auto);

  // jump the clock to just before the first deal
  await gm.evaluate(() => { const r = window.IMPAK.currentRes(); const nx = r.ck.next; return window.IMPAK.store().gmUpdate({ accMs: (nx.t - 0.03) * r.g.msPerMonth, startedAt: Date.now() }); });
  await team.waitForTimeout(9000);
  st = await team.evaluate(() => { const r = window.IMPAK.currentRes(); return { hold: r.ck.hold && r.ck.hold.kind, opts: document.querySelectorAll('#r-over .opt').length }; });
  check('team sees the Deal Room', st.hold === 'event' && st.opts >= 2, JSON.stringify(st));
  // how often is the overlay rebuilt? (it used to be every second)
  await team.evaluate(() => { window.__mut = 0; new MutationObserver((m) => { for (const x of m) if (x.type === 'childList' && x.target.id === 'r-over') window.__mut++; }).observe(document.querySelector('#r-over'), { childList: true }); });
  await team.waitForTimeout(6000);
  const rebuilds = await team.evaluate(() => window.__mut);
  check('deal overlay is not rebuilt while it waits', rebuilds === 0, rebuilds + ' rebuilds in 6 s');
  await team.click('#r-over .opt'); await team.waitForTimeout(2500);
  const dec = await fetch(API + '?op=state&room=' + room).then((x) => x.json());
  const eid = Object.keys(dec.decisions)[0];
  check('team choice reaches the server', eid && dec.decisions[eid].t1, JSON.stringify(dec.decisions));
  await team.screenshot({ path: path.join(out, 'deal-team.png') });
  // manual: the deal stays open past its window until the GM closes it
  st = await gm.evaluate(() => { const r = window.IMPAK.currentRes(); return r.ck.hold && r.ck.hold.kind; });
  check('in manual mode the deal waits for the GM', st === 'event');
  await gm.click('#app [data-act="gm-close"]'); await gm.waitForTimeout(6000);
  st = await team.evaluate(() => !!document.querySelector('#r-over .advice.after'));
  check('team sees the outcome with its lesson', st);

  // front screen and back
  await gm.click('#app [data-act="role-screen"]'); await gm.waitForTimeout(800);
  st = await gm.evaluate(() => ({ role: window.IMPAK.APP.role, btn: !document.querySelector('#to-console').hidden }));
  check('front screen shows a way back to the console', st.role === 'screen' && st.btn, JSON.stringify(st));
  await gm.click('#to-console'); await gm.waitForTimeout(800);
  st = await gm.evaluate(() => window.IMPAK.APP.role);
  check('back in the console', st === 'gm', st);

  // end the game
  await gm.click('#app [data-act="gm-resume"]').catch(() => {}); await gm.waitForTimeout(600);
  await gm.click('#app [data-act="gm-end-ask"]'); await gm.waitForTimeout(300);
  await gm.screenshot({ path: path.join(out, 'gm-end-confirm.png') });
  await gm.click('#app [data-act="gm-end-yes"]'); await gm.waitForTimeout(6000);
  const fin = await fetch(API + '?op=state&room=' + room).then((x) => x.json());
  st = await team.evaluate(() => { const r = window.IMPAK.currentRes(); return { final: r.final, status: r.g.status }; });
  check('GM ends the game; teams see the final bell', fin.game.status === 'ended' && st.final, JSON.stringify(st));
  await gm.screenshot({ path: path.join(out, 'gm-ended.png') });
  console.log(errors.length ? 'page errors:\n' + errors.join('\n') : 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all checks passed');
  await browser.close(); process.exit(fails || errors.length ? 1 : 0);
})();
