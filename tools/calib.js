#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
/* Validation of src/engine.js after the port (DESIGN.md s7):
 *   1. determinism: two independent runs of the same (level, seed, style) give identical final states;
 *   2. replay equality: PB.replay(scenario, log, decisions) reproduces the live month-by-month run;
 *   3. calibration: style-bot means and Gold shares per level against the v0.5 table (300 seeds).
 * Usage: node tools/calib.js [seeds=300] [defence=auto]
 */
"use strict";
const path = require("path");
const PB = require(path.join(__dirname, "..", "src", "engine.js"));
globalThis.PB = PB;
const AI = require(path.join(__dirname, "..", "src", "strategies.js"));

const SEEDS = parseInt(process.argv[2] || "300", 10);
const LEVELS = ["rintis", "bina", "lestari"];
const V05 = { // mean · Gold share, project doc 1 Oct 2026
  bold: { rintis: [91.2, 98], bina: [84.7, 84], lestari: [83.0, 74] },
  garden: { rintis: [90.7, 100], bina: [81.6, 67], lestari: [79.4, 46] },
  purist: { rintis: [76.2, 6], bina: [77.1, 30], lestari: [79.5, 38] },
  rocket: { rintis: [73.9, 13], bina: [63.9, 0], lestari: [56.5, 0] },
  reckless: { rintis: [67.2, 0], bina: [32.5, 0], lestari: [31.3, 0] },
  tower: { rintis: [41.2, 0], bina: [48.3, 0], lestari: [40.2, 0] },
  caretaker: { rintis: [37.8, 0], bina: [39.2, 0], lestari: [35.7, 0] },
};

function play(sc, key) {
  const S = AI.S[key];
  const t = PB.newTeam(S.label, S.policy, sc.lv);
  const log = [], dec = {}; let seq = 0;
  const act = (m) => (o) => { const v = PB.validate(t, sc, o, m); if (!v.ok) return false; const ok = PB.applyOrder(t, sc, o, m); if (ok) log.push(Object.assign({ t: m - 1 + 0.2, seq: seq++ }, o)); return ok; };
  for (let m = 1; m <= sc.months; m++) {
    if (t.receiver) continue;
    PB.startMonth(t, sc, m); S.monthly(t, sc, m, act(m), PB);
    for (const e of sc.events.filter((x) => x.month === m)) { const o = PB.eligible(e.card, t, m) ? S.card(e.card, t, m, PB) : null; dec[e.id] = o; PB.applyEvent(t, sc, e, o, m); }
    PB.endMonth(t, sc, m);
  }
  return { t, log, dec };
}
// plan = bot bookkeeping, not engine state; the three history arrays are padded by replay() for a team in
// receivership (the live loop stops recording), so they are compared only while the team is solvent.
const strip = (t) => { const c = JSON.parse(JSON.stringify(t)); delete c.now; delete c.plan; if (c.receiver) { delete c.cashHist; delete c.netHist; delete c.ipHist; } return JSON.stringify(c); };

function main() {
  let detFail = 0, repFail = 0, games = 0;
  const rows = [];
  const defenceFor = (lv) => (lv.score.D ? 11 : 0);      // v0.5 gave benchmark (AI) teams D = 11 of 15 (app line "bench ? 11")
  for (const level of LEVELS) {
    for (const key of AI.ORDER) {
      let sum = 0, gold = 0, bailed = 0, sumD0 = 0, goldD0 = 0;
      for (let i = 1; i <= SEEDS; i++) {
        const seed = "cal-" + i;
        const sc = PB.makeScenario(seed, level);
        const a = play(sc, key), b = play(PB.makeScenario(seed, level), key);
        games++;
        if (strip(a.t) !== strip(b.t)) detFail++;
        const r = PB.replay(sc, a.t.name, a.t.policy, a.log, a.dec, null, sc.months);
        if (strip(r) !== strip(a.t) || Math.abs(PB.rubric(r, sc, 11, sc.months).total - PB.rubric(a.t, sc, 11, sc.months).total) > 1e-9) repFail++;
        const D = defenceFor(sc.lv);
        const rb = PB.rubric(a.t, sc, D, sc.months), rb0 = PB.rubric(a.t, sc, 0, sc.months);
        sum += rb.total; if (rb.medal === "gold") gold++; if (a.t.bailouts || a.t.receiver) bailed++;
        sumD0 += rb0.total; if (rb0.medal === "gold") goldD0++;
      }
      const ref = (V05[key] || {})[level] || [NaN, NaN];
      rows.push({ level, key, mean: sum / SEEDS, gold: 100 * gold / SEEDS, meanD0: sumD0 / SEEDS, goldD0: 100 * goldD0 / SEEDS, bailed: 100 * bailed / SEEDS, ref });
    }
  }
  console.log(`games ${games} (×2 for determinism)   determinism mismatches ${detFail}   replay mismatches ${repFail}`);
  console.log("level     style      mean(D=11)   Gold%   mean(D=0) Gold%   bailed%   v0.5 mean Gold%");
  for (const r of rows) console.log(`${r.level.padEnd(9)} ${r.key.padEnd(10)} ${r.mean.toFixed(1).padStart(8)} ${r.gold.toFixed(0).padStart(6)}   ${r.meanD0.toFixed(1).padStart(8)} ${r.goldD0.toFixed(0).padStart(6)}   ${r.bailed.toFixed(0).padStart(6)}   ${String(r.ref[0]).padStart(8)} ${String(r.ref[1]).padStart(5)}`);
  const bad = rows.filter((r) => isFinite(r.ref[0]) && Math.min(Math.abs(r.mean - r.ref[0]), Math.abs(r.meanD0 - r.ref[0])) > 2.5);
  console.log(bad.length ? `WARN ${bad.length} rows differ from v0.5 by more than 2.5 points` : "calibration within 2.5 points of v0.5 on every row (D=full or D=0)");
  process.exit(detFail || repFail ? 1 : 0);
}
main();
