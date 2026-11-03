/* SPDX-License-Identifier: MIT
   Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
   Lifted verbatim from the author's IMPAK v0.5 build (1 Oct 2026); only this header was added. */
/* Scripted strategies for calibration and for the AI teams in the solo demo.
 * Each strategy: policy, monthly(t, sc, m, act, PB) issuing orders through act(o) (validates and applies),
 * and card(card, t, m, PB) returning "T" | "C" | "L". */
(function (root) {
"use strict";

function admitAll(t, m, act, order) {
  for (const type of order) for (const a of t.applicants.slice()) if (a.type === type) act({ type: "admit", aid: a.id });
}
function borrowFor(t, act, PB, cost, m, cap) {
  const s = PB.capitalSplit(t, cost, m, true); const need = s.cash - t.cash;
  if (need > 0 && t.debt + t.emerg + Math.ceil(need) <= cap) act({ type: "loan", amount: Math.ceil(need) });
}
// run a plan: list of steps {o, when?(t,m), borrow?}; each step done once (tracked in t.plan)
function runPlan(t, sc, m, act, PB, plan, loanCap) {
  t.plan = t.plan || {};
  for (let i = 0; i < plan.length && t.ap > 0; i++) {
    if (t.plan[i]) continue;
    const s = plan[i];
    if (s.when && !s.when(t, m)) continue;
    const o = typeof s.o === "function" ? s.o(t, m) : s.o; if (!o) continue;
    let v = PB.validate(t, sc, o, m);
    if (!v.ok && /cash/i.test(v.why || "") && loanCap) { borrowFor(t, act, PB, v.cost || 0, m, loanCap); v = PB.validate(t, sc, o, m); }
    if (v.ok && act(o)) t.plan[i] = true;
  }
}
const shed = id => ({ o: { type: "build", kind: "retrofit", bid: id } });
const work = (zone, kind) => ({ o: t => { const k = t.zones[zone].svc; const opts = t.zones[zone].works; return { type: "work", zone, kind: kind === "road" && k.road === 0.5 ? "roadHalf" : (kind === "power" && ["A", "B", "C", "D", "E", "F", "G", "H"].some(n => false) ? "power" : kind) }; } });
function powerKind(t, zone, PB) { return PB.CFG.ADJ[zone].some(n => t.zones[n].svc.power >= 1) ? "powerShared" : "power"; }
const pw = zone => ({ o: (t) => ({ type: "work", zone, kind: (globalThis.PB || require("./engine.js")).CFG.ADJ[zone].some(n => t.zones[n].svc.power >= 1) ? "powerShared" : "power" }) });
const fac = k => ({ o: { type: "facility", kind: k } });
const bld = (zone, kind, when) => ({ o: { type: "build", zone, kind }, when });
const needSpace = n => (t) => { let f = 0; for (const b of t.buildings) if (b.status === "ready") f += b.units - usedOf(t, b); return f <= n; };
function usedOf(t, b) { let u = 0; const PB = globalThis.PB || require("./engine.js"); for (const x of t.tenants) if (x.bid === b.id) u += PB.CFG.TEN[x.type].units; for (const k in t.fac) if (t.fac[k] && t.fac[k].bid === b.id) u += PB.CFG.FAC[k].units; return u; }
const occ = x => t => { const PB = globalThis.PB || require("./engine.js"); return PB.occupancy(t) >= x; };
const gate = t => { const PB = globalThis.PB || require("./engine.js"); return PB.gateMet(t); };

function programmes(t, m, act, buffer, per) {
  if ((m - 1) % 3 !== 0) return;
  const lvl = Math.max(0, Math.min(6, Math.floor((t.cash - buffer) / per)));
  if (lvl !== (t.prog || 0) && t.ap > 0) act({ type: "programme", level: lvl });
}
const S = {};

S.garden = {
  label: "Garden", note: "Phased: retrofit first, share before building, conditions on every deal, reserve land", policy: "priority",
  plan: [work("B", "fibre"), shed("B1"), fac("kpi"), work("C", "road"), fac("labaccess"), shed("B2"), fac("incubator"), fac("services"),
    bld("C", "modular", needSpace(2)), fac("covenant"), shed("B3"), bld("C", "modular", needSpace(2)), fac("liaison"), bld("C", "modular", needSpace(1))],
  monthly(t, sc, m, act, PB) {
    runPlan(t, sc, m, act, PB, this.plan, 4);
    if (m >= 25 && m <= 36 && t.hplots.filter(p => p === "reserve").length < 1) act({ type: "reserve" });
    if (PB.inDownturn(sc, m) && t.tenants.filter(x => x.type === "backoffice").length >= 2 && !(t.flags.renegUntil >= m)) act({ type: "reneg" });
    admitAll(t, m, act, ["anchor", "sme", "spinoff", "startup", "backoffice"]);
    if (t.cash > 5 && t.debt + t.emerg > 0) act({ type: "repay", amount: Math.min(Math.floor(t.cash - 3), Math.ceil(t.debt + t.emerg)) });
    if (m > 12) programmes(t, m, act, 6, 3);
  },
  card(card, t, m, PB) {
    const c = { contractor: "C", datacentre: { opt: "C", zone: "D" }, donor: PB.linkedCount(t) >= 1 ? "C" : "L", jv: "C", flood: PB.sound("flood", "L", t, m) ? "L" : "C", telecom: "C", inquiry: "C",
      developer: "C", bts: "C", agency: "C", rector: "C", factory: "C", natlab: "T", holiday: "C", restructure: PB.sound("restructure", "T", t, m) ? "T" : "L", stimulus: "T", talent: "C",
      solar: "C", chemical: "L", greencert: t.cash >= 2 ? "T" : "L", audit: t.esg >= 2 ? "T" : "C", drought: "C" };
    return c[card] || "L";
  },
};

S.bold = {
  label: "Bold", note: "Calculated risk: own Lab early, builds as soon as demand appears, takes deals the rules call sound", policy: "priority",
  plan: [work("B", "fibre"), fac("kpi"), shed("B1"), work("C", "road"), fac("lab"), shed("B2"), fac("incubator"), bld("C", "newbuild", t => gate(t)),
    fac("covenant"), fac("liaison"), shed("B3"), bld("C", "modular", t => gate(t)), bld("C", "newbuild", t => gate(t) && needSpace(3)(t)), fac("services")],
  monthly(t, sc, m, act, PB) {
    runPlan(t, sc, m, act, PB, this.plan, 8);
    if (m >= 25 && m <= 36 && t.hplots.filter(p => p === "reserve").length < 1) act({ type: "reserve" });
    if (PB.inDownturn(sc, m) && t.tenants.filter(x => x.type === "backoffice").length >= 2 && !(t.flags.renegUntil >= m)) act({ type: "reneg" });
    if (PB.inDownturn(sc, m) && t.cash < 0.5) { const b = t.buildings.find(x => x.kind === "newbuild" && x.status === "ready" && !x.leaseBack); if (b) act({ type: "leaseback", bid: b.id }); }
    admitAll(t, m, act, ["anchor", "sme", "spinoff", "startup", "backoffice"]);
    if (t.cash > 6 && t.debt + t.emerg > 0) act({ type: "repay", amount: Math.min(Math.floor(t.cash - 4), Math.ceil(t.debt + t.emerg)) });
    if (m > 12) programmes(t, m, act, 4, 2);
  },
  card(card, t, m, PB) {
    const snd = o => PB.sound(card, o, t, m);
    const c = { contractor: "C", datacentre: { opt: "C", zone: "C" }, donor: PB.linkedCount(t) >= 2 ? "T" : "L", jv: "C", flood: snd("L") ? "L" : "T", telecom: "T", inquiry: "T",
      developer: "C", bts: snd("T") ? "T" : "C", agency: "C", rector: "C", factory: snd("T") ? "T" : "C", natlab: "T", holiday: "C", restructure: snd("T") ? "T" : "L", stimulus: "T", talent: "T",
      solar: t.cash >= 3 ? "T" : "C", chemical: snd("C") ? "C" : "L", greencert: t.cash >= 2 ? "T" : "L", audit: "T", drought: "T" };
    return c[card] || "L";
  },
};

S.purist = {
  label: "Purist", note: "Mission first: linked tenants only, programmes, green buffer and park, no loans", policy: "linked",
  plan: [work("B", "fibre"), fac("kpi"), shed("B1"), fac("incubator"), fac("labaccess"), fac("covenant"), work("C", "road"), shed("B2"), { o: { type: "work", zone: "G", kind: "retention" } },
    fac("liaison"), bld("C", "modular", t => gate(t)), fac("services"), shed("B3")],
  monthly(t, sc, m, act, PB) {
    if (m === 1) act({ type: "declare", zone: "F" });
    runPlan(t, sc, m, act, PB, this.plan, 0);
    if (t.zones.G.mode === "open" && t.zones.G.protected && t.zones.G.plotsUsed === 0) act({ type: "declare", zone: "G" });
    if (m >= 25 && m <= 36 && t.hplots.filter(p => p === "reserve").length < 2) act({ type: "reserve" });
    admitAll(t, m, act, ["anchor", "spinoff", "sme", "startup"]);
    if (m > 12) programmes(t, m, act, 5, 2);
  },
  card(card, t, m, PB) {
    const c = { natlab: "T", stimulus: "T", restructure: PB.sound("restructure", "T", t, m) ? "T" : "L", flood: PB.sound("flood", "L", t, m) ? "L" : "C",
      solar: t.cash >= 3 ? "T" : "C", chemical: "L", greencert: t.cash >= 2 ? "T" : "L", audit: "T", drought: "T" };
    return c[card] || (PB.CARDS[card].C ? "C" : "L");
  },
};

S.rocket = {
  label: "Rocket", note: "Fast growth: services the plateau and builds big early with the fund, fills with anyone, takes growth deals as offered", policy: "open",
  plan: [work("E", "road"), fac("kpi"), work("B", "fibre"), work("E", "water"), pw("E"), bld("E", "newbuild"), work("E", "fibre"), shed("B1"),
    fac("lab"), fac("incubator"), work("C", "road"), bld("C", "newbuild"), fac("liaison"), shed("B2")],
  monthly(t, sc, m, act, PB) {
    runPlan(t, sc, m, act, PB, this.plan, 12);
    if (PB.inDownturn(sc, m) && t.cash < 0.5) { const b = t.buildings.find(x => x.kind === "newbuild" && x.status === "ready" && !x.leaseBack); if (b) act({ type: "leaseback", bid: b.id }); }
    admitAll(t, m, act, ["anchor", "spinoff", "sme", "startup", "backoffice"]);
    if (t.cash > 8 && t.debt + t.emerg > 0) act({ type: "repay", amount: Math.min(Math.floor(t.cash - 5), Math.ceil(t.debt + t.emerg)) });
  },
  card(card, t, m, PB) { return { holiday: "T", rector: "T", restructure: PB.sound("restructure", "T", t, m) ? "T" : "L", flood: "L", solar: "L", greencert: "L", audit: "L", drought: "L" }[card] || "T"; },
};

S.tower = {
  label: "Tower", note: "Landlord: services the highway frontage, builds for corporates, leases land as offered", policy: "open",
  plan: [work("D", "water"), pw("D"), bld("D", "newbuild"), shed("B1"), bld("D", "modular", occ(0.7)), { o: { type: "work", zone: "F", kind: "clear" } }, work("F", "road"), work("F", "water"), pw("F"), bld("F", "newbuild", occ(0.8)), bld("F", "modular", occ(0.8))],
  monthly(t, sc, m, act, PB) {
    runPlan(t, sc, m, act, PB, this.plan, 12);
    admitAll(t, m, act, ["backoffice", "anchor", "sme", "spinoff"]);
    if (t.cash > 8 && t.debt + t.emerg > 0) act({ type: "repay", amount: Math.min(Math.floor(t.cash - 5), Math.ceil(t.debt + t.emerg)) });
  },
  card(card, t, m, PB) { return { donor: "L", jv: "L", telecom: "T", flood: "L", holiday: "T", rector: "T", restructure: "L", stimulus: "L", talent: "L", natlab: "T", solar: "L", greencert: "L", audit: "L", drought: "L" }[card] || "T"; },
};

S.caretaker = {
  label: "Caretaker", note: "Timid: spends the minimum, lets the fund lapse, takes only easy money", policy: "open",
  plan: [work("B", "fibre"), shed("B1")],
  monthly(t, sc, m, act, PB) { runPlan(t, sc, m, act, PB, this.plan, 0); admitAll(t, m, act, ["anchor", "sme", "spinoff", "backoffice"]); },
  card(card) { return { datacentre: "T", developer: "T", agency: "T", rector: "T", holiday: "T", natlab: "T", stimulus: "T", chemical: "T" }[card] || "L"; },
};

S.reckless = {
  label: "Reckless", note: "Everything at once, as offered, on maximum debt", policy: "open",
  plan: [work("E", "road"), work("E", "water"), pw("E"), work("E", "fibre"), bld("E", "newbuild"), { o: { type: "work", zone: "F", kind: "clear" } }, bld("E", "newbuild"), work("D", "water"), pw("D"), bld("D", "newbuild"), work("F", "road"), bld("F", "newbuild"),
    fac("lab"), fac("incubator"), fac("mgmt"), fac("liaison"), bld("E", "newbuild"), work("B", "fibre"), shed("B1"), shed("B2"), shed("B3"), bld("C", "newbuild"), work("C", "road"), bld("D", "modular"), bld("E", "modular")],
  monthly(t, sc, m, act, PB) { runPlan(t, sc, m, act, PB, this.plan, 15); admitAll(t, m, act, ["anchor", "spinoff", "sme", "backoffice", "startup"]); },
  card(card) { return { rector: "L", holiday: "L", restructure: "L" }[card] || "T"; },
};

const ORDER = ["caretaker", "tower", "reckless", "purist", "garden", "bold", "rocket"];
const API = { S, ORDER, admitAll, runPlan };
if (typeof module !== "undefined" && module.exports) module.exports = API; else root.PBAI = API;
})(typeof window !== "undefined" ? window : globalThis);

