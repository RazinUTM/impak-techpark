// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
/* Node check of src/bench.js (learning from the benchmark parks) against real game states, no browser.
 * - no benchmark move or deal later than the cut-off is shown (one quarter late during play; all at the end);
 * - a live room whose Game Master chose 'end' shows nothing until the final bell;
 * - the impact sources add up to the engine's own monthly accrual (within the 0.1 rounding of the history);
 * - the views and the transcript section render in BM and EN for every level.
 * Usage: node tools/bench_unit.js */
'use strict';
const path = require('path'), fs = require('fs');
const S = path.join(__dirname, '..', 'src') + '/', CT = path.join(__dirname, '..', 'content') + '/';
globalThis.PB = require(S + 'engine.js'); globalThis.PBAI = require(S + 'strategies.js');
const G = require(S + 'game.js'); globalThis.IMPAK = G;
const load = (p, extra) => (0, eval)(fs.readFileSync(p, 'utf8') + (extra || ''));   // browser-style scripts that attach to globalThis
require(CT + 'moves.js'); load(CT + 'lessons.js', '\nglobalThis.LESSONS = LESSONS;'); load(CT + 'game-ms.js');
require(S + 'bench.js'); load(S + 'debrief.js');
const B = globalThis.IMPAKBench, D = globalThis.IMPAKDebrief;
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL', m); } };

function clockAt(st, k) {
  const g = st.game, sc = G.scenG(g), pp = G.pausePoints(sc);
  g.status = k >= sc.months ? 'ended' : 'paused'; g.accMs = k * g.msPerMonth; g.closed = {};
  for (const p of pp) if (p.t <= k + 1e-9) g.closed[p.id] = true;
  st._cache = null; return G.compute();
}
async function solo(level, lang) {
  G.HOST.lang = lang;
  const ctx = G.newCtx(); G.APP = ctx; ctx.role = 'solo'; ctx.teamId = 'you';
  await G.newSolo(10000, level); const st = ctx.store, sc = G.scenG(st.game);
  for (const k of [1.5, 3, 7.5, 13, 25.2, sc.months]) {
    const res = clockAt(st, k), tm = G.teamOf(res, 'you'), up = B.cutoff(res);
    ok(up === (res.final ? sc.months : 3 * Math.floor((res.mCur - 1) / 3)), level + ' cut-off at ' + k + ': ' + up);
    for (const x of res.teams.filter((y) => y.bench)) {
      const key = x.id.slice(3);
      ctx.ui.newsSrc = x.id; ctx.ui.benchSel = x.id; ctx.ui.benchOpen = true;
      ok(B.newsTab(res, tm).indexOf(x.name) > 0 && B.learnHTML(res, tm).indexOf('bench-open') > 0 && B.studyHTML(res, tm).indexOf('class="bch"') > 0, level + ' ' + key + ' renders at ' + k);
      for (const Q of B.digest(res, key, up)) ok(3 * Q.q + 3 <= up, level + ' ' + key + ' quarter ' + Q.q + ' beyond the cut-off ' + up);
      ok(B.movesOf(res, key, up).every((o) => o.m <= up), level + ' ' + key + ' move beyond the cut-off');
      ok(B.stateAt(res, key, up).ipHist.length === up, level + ' ' + key + ' history length at ' + up);
    }
    ctx.ui.benchOpen = false;
  }
  const res = clockAt(st, sc.months), tm = G.teamOf(res, 'you');
  ok(/class="db-lead"/.test(B.debriefHTML(res, tm)), level + ' debrief section');
  /* impact sources: the engine adds (sum of sources)/12 each month, counted in full with KPI and half without */
  for (const key of ['garden', 'bold', 'rocket']) {
    let worst = 0;
    for (let m = 14; m < sc.months; m += 7) {
      const a = B.stateAt(res, key, m - 1), b = B.stateAt(res, key, m);
      if (a.receiver || b.receiver) continue;
      /* the month's accrual uses the state after that month's orders, exits and graduations, i.e. the state at its end;
         months with one-off impact (graduates, deals, a JV exit, a bailout) are skipped */
      const step = b.ipHist[m - 1] - a.ipHist[m - 2], rate = B.engine(b).counted / 12;
      if (b.grads === a.grads && !sc.events.some((e) => e.month === m) && !b.log.some((l) => l.m === m && (l.kind === 'bad' || l.kind === 'good' || /graduated|exited|bailed|policy|Spill/.test(l.text)))) worst = Math.max(worst, Math.abs(step - rate));
    }
    ok(worst <= 0.11, level + ' ' + key + ' impact sources match the engine (worst gap ' + worst.toFixed(3) + ')');
  }
}
async function live() {
  G.HOST.lang = 'ms';
  const ctx = G.newCtx(); G.APP = ctx; ctx.live = G.MemStore('live'); ctx.store = ctx.live; ctx.role = 'team'; ctx.teamId = 't1';
  await ctx.live.gmSet({ gid: 'oak-1-x', seed: 'oak-1', level: 'lestari', site: 'corridor', teams: [{ id: 't1', name: 'Pasukan Helang' }, { id: 't2', name: 'Pasukan Rusa' }], bench: ['garden', 'rocket'], benchView: 'end',
    status: 'paused', startedAt: 0, accMs: 0, msPerMonth: 30000, window: 90, auto: true, closed: {}, dec: {}, openAt: {}, defence: {}, reveal: false });
  const st = ctx.live, sc = G.scenG(st.game);
  let res = clockAt(st, 20), tm = G.teamOf(res, 't1');
  const ev = sc.events.filter((e) => e.month <= 20).slice(-1)[0];
  ok(B.view(res) === 'end' && B.cutoff(res) === 0, 'live: the GM choice hides the benchmarks');
  ctx.ui.newsSrc = 'ai-garden'; ctx.ui.benchOpen = true;
  ok(!/class="bch"/.test(B.learnHTML(res, tm) + B.studyHTML(res, tm)) && /loceng akhir/.test(B.newsTab(res, tm)) && B.dealHTML(res, tm, ev) === '', 'live: nothing about the moves is shown');
  st.game.benchView = 'lag'; res = clockAt(st, 20); tm = G.teamOf(res, 't1');
  ok(B.cutoff(res) === 18 && /Garden/.test(B.dealHTML(res, tm, ev)), 'live: one quarter late after the GM switches');
  st.game.benchView = 'end'; res = clockAt(st, sc.months); tm = G.teamOf(res, 't1');
  ok(B.view(res) === 'all' && /class="bch"/.test(B.studyHTML(res, tm)), 'live: everything at the final bell');
  const doc = D.bilingual(res, tm, {});
  ok(/Cara pendahulu membina park/.test(doc) && /How the leading benchmark built its park/.test(doc), 'transcript carries the section in both languages');
}
(async () => {
  for (const [lv, lg] of [['rintis', 'ms'], ['bina', 'en'], ['lestari', 'ms'], ['lestari', 'en']]) await solo(lv, lg);
  await live();
  console.log(fails ? fails + ' of ' + n + ' checks FAILED' : 'all ' + n + ' benchmark checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
