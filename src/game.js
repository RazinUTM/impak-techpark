
/* SPDX-License-Identifier: MIT
   Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia */
/* IMPAK – Technovation Park — game core (carried over from v0.5; the browser host now lives in app.js and live.js).
 * The same file runs in the browser and in Node (tools/calib.js). Views are pure string builders that read the current context APP. */
(function (root) {
"use strict";
const IS_NODE = typeof module !== "undefined" && module.exports && typeof document === "undefined";
const PB = root.PB || (IS_NODE ? require("./engine.js") : null);
if (IS_NODE && !root.PB) root.PB = PB;
const AI = root.PBAI || (IS_NODE ? require("./strategies.js") : null);
const C = PB.CFG, CARDS = PB.CARDS;
const BRAND = {
  name: "IMPAK", tag: "Technovation Park", mark: "IMPAK™ – Technovation Park",
  get copyright() { return HOST.lang === "ms" ? "© 2026 Ahmad Razin Zainal Abidin dan Universiti Teknologi Malaysia · kod MIT · kandungan permainan CC BY-NC-ND 4.0" : "© 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia · code MIT · game content CC BY-NC-ND 4.0"; },
  version: "0.6.0-beta.2",
};

/* =============================================================== host adapter (browser or server fills this in) */
const HOST = {
  kind: "browser", offline: false,
  now: () => Date.now(),
  toast: () => {}, save: () => {}, hash: () => {},
  landing: () => "", footer: () => "",
  act: {}, site: "corridor",
};

/* =============================================================== utilities */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const n1 = v => (Math.round((+v || 0) * 10) / 10).toFixed(1).replace("-", "−");
const n0 = v => String(Math.round(+v || 0)).replace("-", "−");
const sg1 = v => ((v || 0) >= 0 ? "+" : "−") + Math.abs(Math.round((v || 0) * 10) / 10).toFixed(1);
const pc = v => Math.round((v || 0) * 100) + "%";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mname = m => PB.monthName(m);
function deepMerge(a, b) {
  const o = Object.assign({}, a || {});
  for (const k in b) {
    const v = b[k];
    if (v && typeof v === "object" && !Array.isArray(v) && o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) o[k] = deepMerge(o[k], v);
    else o[k] = v;
  }
  return o;
}
function rid(n) {
  const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = "";
  let r;
  if (root.crypto && root.crypto.getRandomValues) r = root.crypto.getRandomValues(new Uint32Array(n || 6));
  else r = Array.from({ length: n || 6 }, () => Math.floor(Math.random() * 1e9));
  for (const x of r) s += a[x % a.length]; return s;
}
const SEEDW = ["arus", "cendana", "meranti", "jati", "rimba", "sinar", "pelita", "tanjung", "kinta", "gemas", "lestari", "merbau", "damar", "kenari", "bayu", "delima"];
function newSeed() { return SEEDW[Math.floor(Math.random() * SEEDW.length)] + "-" + (1000 + Math.floor(Math.random() * 9000)); }
let SEQ = 0; function nextSeq() { SEQ = (SEQ + 1) % 1000; return Date.now() * 1000 + SEQ; }
const now = () => HOST.now();
function toast(msg, kind) { HOST.toast(msg, kind); }

/* =============================================================== levels */
const LEVEL_KEYS = ["rintis", "bina", "lestari"];
function lvl(k) { return PB.levelOf(k || "lestari"); }
const LOCKED_IN = { D: "bina", E: "bina", H: "bina", F: "lestari", G: "lestari" };
const LEVEL_TEXT = {
  rintis: { pace: 45000, get blurb() { return L("Zones A–C only, three years, a 20 Cr fund that pays every capital cost, five friendly deals and no downturn. Learn to service land, build, fill units and keep income above costs.", "Zon A–C sahaja, tiga tahun, Development Fund 20 Cr yang membayar semua kos modal, lima deal mesra dan tiada downturn. Belajar menyediakan services, membina, mengisi unit dan mengekalkan pendapatan melebihi kos."); } },
  bina: { pace: 60000, get blurb() { return L("Adds the highway strip, the plateau and the university reserve. Four years, twelve deals with a die for conditions, loans, and a downturn announced six months ahead.", "Ditambah jalur lebuh raya, dataran tinggi dan tanah rizab universiti. Empat tahun, dua belas deal dengan dadu untuk Conditions, pinjaman, dan downturn yang diumumkan enam bulan lebih awal."); } },
  lestari: { pace: 60000, get blurb() { return L("The full game: all eight zones with the forest ridge and the wetland, five years, fifteen deals, a secret downturn that can become a crisis, and ESG as a Gold gate.", "Permainan penuh: kesemua lapan zon termasuk rabung hutan dan tanah lembap, lima tahun, lima belas deal, downturn rahsia yang boleh menjadi krisis, dan ESG sebagai syarat pingat Emas."); } },
};
function lvSub(X) { return HOST.lang === "ms" ? ({ rintis: "Buka pintu", bina: "Kembangkan park", lestari: "Bertahan dan lestari" }[X.key] || X.sub) : X.sub; }
function lvLabel(k) { const L = lvl(k); return "Level " + L.n + " · " + L.name; }
function yearsWord(n) { return (HOST.lang === "ms" ? ["Kosong", "Satu", "Dua", "Tiga", "Empat", "Lima"] : ["zero", "One", "Two", "Three", "Four", "Five"])[n] || String(n); }
function levelAcres(L) { return L.zones.reduce((a, z) => a + C.ZONES[z].acres, 0); }

/* =============================================================== scenario, clock, AI */
const SC = {};
function scen(seed, level) { const k = seed + "|" + (level || "lestari"); return SC[k] || (SC[k] = PB.makeScenario(seed, level || "lestari")); }
/* v0.6: a game may set its own starting cash (g.startCash); the scenario's level copy carries it to newTeam() */
function scenG(g) {
  const base = scen(g.seed, g.level || "lestari");
  if (g.startCash == null || g.startCash === base.lv.startCash) return base;
  const k = g.seed + "|" + (g.level || "lestari") + "|cash" + g.startCash;
  return SC[k] || (SC[k] = Object.assign({}, base, { lv: Object.assign({}, base.lv, { startCash: g.startCash }), _pp: null }));
}
function pausePoints(sc) {
  if (sc._pp) return sc._pp;
  const lv = sc.lv;
  const p = sc.events.map(e => ({ id: e.id, t: e.t, kind: "event", ev: e }));
  if (sc.months > lv.fundEnd) p.push({ id: "cp24", t: lv.fundEnd, kind: "checkpoint", phase: 1 });
  if (lv.zones.includes("H") && sc.months > 36) p.push({ id: "cp36", t: 36, kind: "checkpoint", phase: 2 });
  if (sc.downturn.forecastAt) p.push({ id: "fc", t: sc.downturn.forecastAt - 1 + 0.02, kind: "forecast" });
  if (!sc.downturn.none && sc.downturn.start <= sc.months) p.push({ id: "dt", t: sc.downturn.start - 1 + 0.02, kind: "downturn" });
  p.push({ id: "end", t: sc.months, kind: "end" });
  p.sort((a, b) => a.t - b.t);
  return (sc._pp = p);
}
function clockOf(g, sc, nowMs) {
  const closed = g.closed || {};
  let T = g.status === "setup" ? 0 : (g.accMs + (g.status === "running" ? Math.max(0, nowMs - g.startedAt) : 0)) / g.msPerMonth;
  const next = pausePoints(sc).find(p => !closed[p.id]) || null;
  let hold = null;
  if (next && T >= next.t - 1e-9) { T = next.t; hold = next; }
  if (!next || g.status === "ended") T = sc.months;
  let openAt = null;
  if (hold) openAt = (g.openAt && g.openAt[hold.id]) || (g.startedAt + (hold.t * g.msPerMonth - g.accMs));
  return { T, hold, next, openAt };
}
const AIC = {};
function aiRecord(sc, key) {
  const S = AI.S[key]; const t = PB.newTeam(S.label, S.policy, sc.lv); const log = [], dec = {}; let seq = 0;
  /* each applied order is logged; an admission also keeps the applicant's type (ten) for the benchmark news in bench.js */
  const act = m => o => { const v = PB.validate(t, sc, o, m); if (!v.ok) return false; const a = o.type === "admit" ? t.applicants.find(x => x.id === o.aid) : null; const ok = PB.applyOrder(t, sc, o, m); if (ok) log.push(Object.assign({ t: m - 1 + 0.2, seq: seq++ }, o, a ? { ten: a.type } : null)); return ok; };
  for (let m = 1; m <= sc.months; m++) {
    if (t.receiver) continue;
    PB.startMonth(t, sc, m); S.monthly(t, sc, m, act(m), PB);
    for (const e of sc.events.filter(x => x.month === m)) { const o = PB.eligible(e.card, t, m) ? S.card(e.card, t, m, PB) : null; dec[e.id] = o; PB.applyEvent(t, sc, e, o, m); }
    PB.endMonth(t, sc, m);
  }
  return { log, dec, label: S.label, policy: S.policy, note: S.note };
}
function aiRec(seed, level, key, sc) { sc = sc || scen(seed, level); const k = seed + "|" + level + "|" + key + "|" + sc.lv.startCash; return AIC[k] || (AIC[k] = aiRecord(sc, key)); }

/* =============================================================== in-memory store (solo practice, and every room on the server) */
function MemStore(mode) {
  return {
    mode: mode || "solo", version: 0, listeners: new Set(), game: null, orders: {}, decisions: {}, ready: true,
    emit() { this.version++; for (const f of this.listeners) f(this); },
    on(f) { this.listeners.add(f); },
    ordersFor(team) { return this.orders[team] || []; },
    decisionOf(eid, team) { return (this.decisions[eid] || {})[team] || null; },
    async placeOrder(team, o, t) { (this.orders[team] = this.orders[team] || []).push(Object.assign({ t, seq: nextSeq() }, o)); this.emit(); },
    async decide(team, eid, opt) { (this.decisions[eid] = this.decisions[eid] || {})[team] = opt; this.emit(); },
    async gmSet(g) { this.game = g; this.orders = {}; this.decisions = {}; this._cache = null; this._auto = null; this.emit(); },
    async gmUpdate(p) { this.game = deepMerge(this.game, p); this.emit(); },
    dump() { return { mode: this.mode, game: this.game, orders: this.orders, decisions: this.decisions }; },
    load(d) { this.game = d.game; this.orders = d.orders || {}; this.decisions = d.decisions || {}; this._cache = null; },
  };
}

/* =============================================================== context */
function newCtx() {
  return {
    role: null, teamId: null, store: null, live: null, solo: null, canEdit: false, dbState: "loading",
    ui: { zone: "C", tab: "park", loan: 2, repay: 1, seenReveal: null, seenEnd: false, setup: null, confirmNew: false, purge: null, soloLevel: "rintis" },
  };
}
let APP = newCtx();
function withCtx(ctx, fn) { const prev = APP; APP = ctx; try { return fn(); } finally { APP = prev; } }
function store() { return APP.store; }
function game() { return APP.store && APP.store.game; }

/* =============================================================== compute (cached per store) */
function compute() {
  const st = store(), g = st && st.game; if (!g || !g.seed || !g.teams) return null;
  const level = g.level || "lestari";
  const sc = scenG(g), ck = clockOf(g, sc, now()), T = ck.T, M = sc.months;
  const final = g.status === "ended" || T >= M - 1e-9;
  const mCur = T >= M - 1e-9 ? M : Math.floor(T + 1e-9) + 1;
  const ol = {}; let vis = 0;
  for (const tm of g.teams) { ol[tm.id] = st.ordersFor(tm.id); for (const o of ol[tm.id]) if (o.t <= T + 1e-9) vis++; }
  const key = [g.gid, level, Math.floor(T + 1e-9), final ? "E" : "", vis, JSON.stringify(g.closed || {}), JSON.stringify(g.dec || {}), (g.bench || []).join(","),
    g.teams.map(x => x.id + ":" + x.name).join(","), JSON.stringify(g.defence || {})].join("|");
  const cache = st._cache;
  if (cache && cache.key === key) { cache.res.ck = ck; cache.res.T = T; cache.res.g = g; return cache.res; }
  const teams = [];
  const lvD = sc.lv.score.D > 0;
  const mk = (id, name, bench, t) => {
    const D = !lvD ? null : (bench ? 11 : ((g.defence || {})[id] != null ? g.defence[id] : null));
    return { id, name, bench, t, ps: PB.parkScore(t, sc, mCur), P: PB.money(t, sc, mCur), occ: PB.occupancy(t), ci: PB.committedIncome(t),
      now: PB.rubric(t, sc, null, mCur), rub: final ? PB.rubric(t, sc, D, M) : null, hasD: !lvD || D != null };
  };
  for (const tm of g.teams) {
    const dec = {}; for (const eid in (g.dec || {})) dec[eid] = (g.dec[eid] || {})[tm.id] || "L";
    teams.push(mk(tm.id, tm.name, false, PB.replay(sc, tm.id, "priority", ol[tm.id], dec, g.closed || {}, T)));
  }
  for (const k of (g.bench || [])) {
    if (!AI.S[k]) continue; const r = aiRec(g.seed, level, k, sc);
    teams.push(mk("ai-" + k, r.label, true, PB.replay(sc, r.label, r.policy, r.log, r.dec, g.closed || {}, T)));
  }
  const res = { key, sc, lv: sc.lv, ck, T, mCur, months: M, final, teams, g };
  st._cache = { key, res };
  return res;
}
function teamOf(res, id) { return res.teams.find(x => x.id === id); }

/* =============================================================== text helpers */
const ZTEXT = {
  A: "Admin building and the inherited rental block: 4 units let to 3 back-office tenants and 1 Tech SME.",
  B: "Three old sheds. Retrofit each into a 3-unit workshop. Tech tenants need fibre in this zone first.",
  C: "Beside the university labs. Each linked tenant here adds +1 impact a year. At the start its road is half built.",
  D: "Visible from the highway. Back-office tenants pay 30% more here: the landlord temptation.",
  E: "The largest buildable area, with no services yet. Low ground: it floods unless it is protected.",
  F: "Forest. Clear it (after an environmental approval) to build, or declare it a green buffer for +1 impact a year.",
  G: "Wetland. Retention works make it buildable and protect Zone E from floods; then it can also become a retention park (+1 impact a year).",
  H: "University Reserve, released on 1 January Year 3. Every plot needs a signed use by 31 December Year 3 or the university takes it back.",
};
/* zone texts that depend on the site plan */
const ZTEXT_SITE = {
  corridor: {
    A: "The Technology Transfer Office (TTO) admin building is the park office, next to the inherited rental block: 4 units let to 3 back-office tenants and 1 Tech SME.",
    C: "Facing the university campus across the highway. Each linked tenant here adds +1 impact a year. At the start its road is half built.",
    D: "The frontage at the interchange, seen from the highway to the city. Back-office tenants pay 30% more here: the landlord temptation.",
  },
};
const ZTEXT_MS = {
  A: "Bangunan pentadbiran dan blok sewaan warisan: 4 unit disewa kepada 3 penyewa back-office dan 1 Tech SME.",
  B: "Tiga shed lama. Retrofit setiap satu menjadi workshop 3 unit. Penyewa teknologi perlukan fibre di zon ini dahulu.",
  C: "Bersebelahan makmal universiti. Setiap penyewa linked di sini menambah +1 impact setahun. Pada permulaan, road-nya baru separuh siap.",
  D: "Kelihatan dari lebuh raya. Penyewa back-office membayar 30% lebih di sini: godaan untuk menjadi tuan tanah semata-mata.",
  E: "Kawasan boleh bina yang paling luas, belum ada services. Tanah rendah: ia dilanda banjir jika tidak dilindungi.",
  F: "Hutan. Buka hutan ini (selepas kelulusan alam sekitar) untuk membina, atau isytiharkan sebagai green buffer untuk +1 impact setahun.",
  G: "Tanah lembap. Retention works menjadikannya boleh dibina dan melindungi Zon E daripada banjir; selepas itu ia juga boleh dijadikan retention park (+1 impact setahun).",
  H: "University Reserve, dilepaskan pada 1 Januari Tahun 3. Setiap plot perlu penggunaan yang ditandatangani sebelum 31 Disember Tahun 3 atau universiti mengambilnya semula.",
};
const ZTEXT_SITE_MS = {
  corridor: {
    A: "Bangunan pentadbiran Technology Transfer Office (TTO) ialah pejabat park, bersebelahan blok sewaan warisan: 4 unit disewa kepada 3 penyewa back-office dan 1 Tech SME.",
    C: "Berhadapan kampus universiti di seberang lebuh raya. Setiap penyewa linked di sini menambah +1 impact setahun. Pada permulaan, road-nya baru separuh siap.",
    D: "Hadapan persimpangan, kelihatan dari lebuh raya ke bandar. Penyewa back-office membayar 30% lebih di sini: godaan untuk menjadi tuan tanah semata-mata.",
  },
};
function ztext(z) { const g = APP.store && APP.store.game; const k = (g && g.site) || HOST.site || "corridor"; const ms = HOST.lang === "ms"; return (((ms ? ZTEXT_SITE_MS : ZTEXT_SITE)[k === "utm" ? "corridor" : k] || {})[z]) || (ms ? ZTEXT_MS : ZTEXT)[z]; }
const SVCN = { road: "Road", water: "Water", power: "Power", fibre: "Fibre" };
const KSHORT = { block: "Block", shed: "Shed", retrofit: "Workshop", modular: "Modular", newbuild: "New Build", factory: "Factory" };
const TYPE_LABEL = t => tenL(t);
const FACTXT_MS = {
  lab: "Memperoleh 0.4 Cr setahun bagi setiap penyewa linked (hingga 2.0). +1 impact setahun dengan 1–2 penyewa linked, +2 dengan 3 atau lebih. Startup lebih kerap bergraduat; spin-off kekal lebih lama.",
  labaccess: "Membolehkan anda menerima R&D anchor. +1 impact setahun selagi anda ada 2 atau lebih penyewa linked.",
  incubator: "4 tempat startup: setiap satu membayar 0.1 Cr dan menambah +1 impact setahun. Startup yang bergraduat masuk sebagai Tech SME (+3 impact). Spin-off kekal lebih lama.",
  liaison: "Satu pemohon tambahan setiap suku tahun. +1 impact setahun selagi anda ada 2 atau lebih penyewa linked.",
  covenant: "Setiap Jun satu penyewa back-office bertukar menjadi Tech SME yang linked. +1 impact setahun bagi setiap 2 penyewa linked.",
  kpi: "Impact disahkan dan dikira penuh. Tanpanya, impact hanya dikira separuh.",
  mgmt: "+1 action point setiap suku tahun.",
  services: "Memperoleh 0.15 Cr setahun bagi setiap penyewa. Dalam gelombang downturn, separuh daripada Tech SME yang sepatutnya tutup akan kekal (3 bulan tanpa sewa).",
};
const FACTXT = {
  lab: "Earns 0.4 Cr a year per linked tenant (up to 2.0). +1 impact a year with 1–2 linked tenants, +2 with 3 or more. Startups graduate more often; spin-offs stay longer.",
  labaccess: "Lets you admit R&D anchors. +1 impact a year while you have 2 or more linked tenants.",
  incubator: "4 startup places: each pays 0.1 Cr and adds +1 impact a year. Graduates move in as Tech SMEs (+3 impact). Spin-offs stay longer.",
  liaison: "One extra applicant every quarter. +1 impact a year while you have 2 or more linked tenants.",
  covenant: "Every June one back-office tenant converts to a linked Tech SME. +1 impact a year for every 2 linked tenants.",
  kpi: "Impact is verified and counts in full. Without it, impact counts half.",
  mgmt: "+1 action point every quarter.",
  services: "Earns 0.15 Cr a year per tenant. In a downturn wave, half of the Tech SMEs that would close stay (3 months rent-free).",
};
const NOT_ELIG_MS = {
  contractor: "Anda tiada plot boleh bina: zon yang ada road dan plot kosong.", datacentre: "Anda tiada plot untuk ditawarkan.",
  inquiry: "Anda tiada plot boleh bina.", developer: "Anda tiada plot Zon H yang belum ditandatangani.", bts: "Anda tiada plot Zon H yang belum ditandatangani dan tiada Lab atau Lab Access.",
  natlab: "Anda tiada plot Zon H yang dirizabkan.", holiday: "Anda tiada penyewa anchor.", stimulus: "Anda tiada incubator.", flood: "Tiada zon anda di tanah rendah.",
  chemical: "Anda tiada ruang 2 unit kosong yang ada road, water dan power.",
};
const NOT_ELIG = {
  contractor: "You have no buildable plot: a zone with a road and a free plot.", datacentre: "You have no plot to offer.",
  inquiry: "You have no buildable plot.", developer: "You have no unsigned Zone H plot.", bts: "You have no unsigned Zone H plot and no Lab or Lab Access.",
  natlab: "You have no reserved Zone H plot.", holiday: "You have no anchor tenant.", stimulus: "You have no incubator.", flood: "None of your zones is on low ground.",
  chemical: "You have no free 2-unit space with road, water and power.",
};
const SDG_MS = { 4: "Pendidikan berkualiti", 6: "Air bersih", 7: "Tenaga bersih", 8: "Pekerjaan wajar", 9: "Industri & inovasi", 11: "Bandar mampan", 12: "Pengeluaran bertanggungjawab", 13: "Tindakan iklim", 15: "Kehidupan di darat", 16: "Institusi kukuh" };
const SDG = { 4: "Quality education", 6: "Clean water", 7: "Clean energy", 8: "Decent work", 9: "Industry & innovation", 11: "Sustainable cities", 12: "Responsible production", 13: "Climate action", 15: "Life on land", 16: "Strong institutions" };
function sdgChips(Cd) { const S = HOST.lang === "ms" ? SDG_MS : SDG; return (Cd.sdg || []).map(n => `<span class="chip sdg" title="${esc(S[n] || "")}">SDG ${n} · ${esc(S[n] || "")}</span>`).join(""); }
function decOpt(d) { return d && typeof d === "object" ? d.opt : d; }
function decZone(d) { return d && typeof d === "object" ? d.zone : null; }
function decLabel(d) { const o = decOpt(d); if (!o) return ""; return (OPTL[o] || o) + (decZone(d) ? L(" · Zone ", " · Zon ") + decZone(d) : ""); }
function siteZones(card, t, m) {
  if (card === "datacentre") return PB.siteOptions(t, m);
  return ["C", "D", "E", "H", "F", "G"].filter(z => PB.canBuildIn(t, z, m) && PB.plotsFree(t, z, m) > 0);
}
function defaultZone(card, t, m, zones) { if (!zones.length) return null; if (card === "datacentre") return zones.includes("D") ? "D" : zones[0]; return PB.bestBuildZone(t, m) || zones[0]; }
function siteNote(card, t, z, m) {
  if (card === "datacentre") { const ST = PB.siteTerms(t, z, m, true); return L(`income ${n1(1.0 * ST.mult)}/yr · +${1 + ST.ip} impact · agree on ${ST.thresh}–6`, `pendapatan ${n1(1.0 * ST.mult)}/thn · +${1 + ST.ip} impact · setuju jika dadu ${ST.thresh}–6`) + (ST.esg ? ` · ESG ${ST.esg}` : "") + (ST.waits ? L(" · waits for road + power", " · menunggu road + power") : ""); }
  const sv = t.zones[z].svc; const ok = sv.road >= 1 && sv.water >= 1 && sv.power >= 1;
  return (ok ? L("serviced", "ada services") : L("no full services yet: nobody moves in until road, water and power are done", "services belum lengkap: tiada penyewa masuk sehingga road, water dan power siap")) + (sv.fibre >= 1 ? " · fibre" : L(" · no fibre", " · tiada fibre")) + (z === "C" ? L(" · +1 impact per linked tenant", " · +1 impact bagi setiap penyewa linked") : "") + (z === "D" ? L(" · back-office rent ×1.3", " · sewa back-office ×1.3") : "") + ((z === "E" || z === "G") && !t.zones[z].protected ? L(" · flood risk", " · risiko banjir") : "");
}
function phaseName(m, sc) {
  if (sc && sc.level === "rintis") return m <= 24 ? L("Phase 1 · Build", "Fasa 1 · Bina") : L("Phase 2 · Operate", "Fasa 2 · Operasi");
  return m <= 24 ? L("Phase 1 · Build", "Fasa 1 · Bina") : (m <= 36 ? L("Phase 2 · Expand", "Fasa 2 · Kembang") : L("Phase 3 · Survive", "Fasa 3 · Bertahan"));
}
function phaseChip(res) {
  const m = res.mCur, dn = PB.inDownturn(res.sc, m);
  return `<span class="chip ${dn ? "bad" : "acc"}">${dn ? L("Phase 3 · ", "Fasa 3 · ") + L(C.SEV[res.sc.downturn.sev].label + " downturn", "downturn " + sevL(res.sc.downturn.sev)) : phaseName(m, res.sc)}</span>`;
}
function levelChip(res) { return `<span class="chip lvl">${esc(lvLabel(res.sc.level))}</span>`; }
function statusChip(g, ck) {
  if (g.status === "setup") return `<span class="chip">${L("Waiting to start", "Menunggu mula")}</span>`;
  if (g.status === "ended") return `<span class="chip">${L("Game over", "Tamat")}</span>`;
  if (ck.hold) {
    const k = ck.hold.kind;
    if (k === "event") return `<span class="chip amb"><span class="dot"></span>Deal Room</span>`;
    if (k === "end") return `<span class="chip amb">${L("Final bell", "Loceng akhir")}</span>`;
    return `<span class="chip amb">${k === "downturn" ? "Downturn" : (k === "forecast" ? L("Forecast", "Ramalan") : "Checkpoint")}</span>`;
  }
  if (g.lastReveal && g.status === "paused") return `<span class="chip amb">${L("Deal closed", "Deal ditutup")}</span>`;
  if (g.status === "paused") return `<span class="chip">${L("Paused", "Berjeda")}</span>`;
  return `<span class="chip good"><span class="dot"></span>${L("Running", "Berjalan")}</span>`;
}
function dateParts(T, months) { return PB.dateLabel(Math.min(T, (months || 60) - 1e-6), months || 60); }
function orderText(o) {
  switch (o.type) {
    case "work": return L(C.WORKS[o.kind].label + " ordered in Zone " + o.zone + ".", workL(o.kind) + " diarahkan di Zon " + o.zone + ".");
    case "build": return o.kind === "retrofit" ? L("Retrofit of " + o.bid + " ordered.", "Retrofit " + o.bid + " diarahkan.") : L(C.BUILD[o.kind].label + " ordered in Zone " + o.zone + ".", C.BUILD[o.kind].label + " diarahkan di Zon " + o.zone + ".");
    case "facility": return C.FAC[o.kind].label + L(" launched.", " dilancarkan.");
    case "admit": return L("Applicant admitted.", "Pemohon diterima masuk.");
    case "loan": return L("Borrowed " + o.amount + " Cr.", "Meminjam " + o.amount + " Cr.");
    case "repay": return L("Repaid " + o.amount + " Cr.", "Membayar balik " + o.amount + " Cr.");
    case "programme": return L("Programme budget set to " + o.level + " Cr a year.", "Bajet program ditetapkan pada " + o.level + " Cr setahun.");
    case "policy": return L("Admission policy set to " + o.policy + ".", "Polisi kemasukan ditetapkan kepada " + o.policy + ".");
    case "cancel": return C.FAC[o.kind].label + L(" closed.", " ditutup.");
    default: return L("Order placed.", "Arahan dibuat.");
  }
}
function canAct(res) {
  const g = res.g, ck = res.ck, tm = teamOf(res, APP.teamId);
  const no = w => ({ ok: false, why: whyL(w) });
  if (!tm) return no("Pick a team first.");
  if (g.status === "setup") return no("The clock has not started yet.");
  if (res.final) return no("The game is over.");
  if (ck.hold && ck.hold.kind === "event") return no("The Deal Room is open: decide on the deal first.");
  if (ck.hold && ck.hold.kind === "end") return no("The game is over.");
  if (tm.t.receiver) return no("Your park is in receivership.");
  return { ok: true };
}
function partLabel(k, lv) { const ops = lv.labels && lv.labels.B3 === "Operations"; return ({ A: L("Park score", "Skor park"), B1: L("Phase 1", "Fasa 1"), B2: L("Zone H", "Zon H"), B3: ops ? L("Operations", "Operasi") : L("Survival", "Survival"), C: L("Decisions", "Keputusan"), D: L("Defence", "Defence"), E: "ESG" }[k]); }
function parts(lv) { return ["A", "B1", "B2", "B3", "C", "D", "E"].filter(k => lv.score[k] > 0); }

/* =============================================================== language of the guide-side views (v0.6)
   HOST.lang is set by the shell ('ms' | 'en'). Technical terms stay in English in both languages. */
const L = (en, ms) => (HOST.lang === "ms" ? ms : en);
/* engine text in BM (content/game-ms.js); the engine itself stays verbatim */
const MSX = () => (HOST.lang === "ms" && root.IMPAK_MS) || null;
let CARD_TITLES = null;
function cardL(card, f) { const M = MSX(); return (M && M.CARDS[card] && M.CARDS[card][f]) || CARDS[card][f]; }
function noteL(text) { const M = MSX(); if (!M) return text; if (!CARD_TITLES) { CARD_TITLES = {}; for (const k in CARDS) CARD_TITLES[CARDS[k].title] = k; M.init(PB); } return M.note(text, whyL, CARD_TITLES); }
function tenL(type) { const M = MSX(); return type === "startup" ? "Startup" : ((M && M.TEN[type]) || C.TEN[type].label); }
function workL(k) { const M = MSX(); return (M && M.WORKS[k]) || C.WORKS[k].label; }
function esgWhyL(w) { const M = MSX(); return M ? M.esgWhy(w) : w; }
const toneL = tone => tone === "threat" ? L("Threat", "Ancaman") : L("Opportunity", "Peluang");
const OPTL = { T: "Take", C: "Conditions", L: "Leave" };
const MONS = { Jan: "Jan", Feb: "Feb", Mar: "Mac", Apr: "Apr", May: "Mei", Jun: "Jun", Jul: "Jul", Aug: "Ogo", Sep: "Sep", Oct: "Okt", Nov: "Nov", Dec: "Dis" };
const monL = mo => HOST.lang === "ms" ? (MONS[mo] || mo) : mo;
const yrL = n => L("Year ", "Tahun ") + n;
const dmyL = d => d.day + " " + monL(d.month);
const MON_MS = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
function mnameL(m) { if (HOST.lang !== "ms") return mname(m); if (m < 1) m = 1; return MON_MS[(m - 1) % 12] + " T" + Math.ceil(m / 12); }
const SEV_MS = { mild: "ringan", severe: "teruk", crisis: "krisis" };
function sevL(key) { const S = C.SEV[key]; return HOST.lang === "ms" ? SEV_MS[key] || S.label : S.label; }
/* engine reasons (engine.js stays verbatim) mapped to BM */
const WHY_MS = {
  "This zone is not part of this level.": "Zon ini bukan sebahagian daripada level ini.",
  "Unknown order.": "Arahan tidak dikenali.",
  "This zone needs a road (and clearance or retention works) before building.": "Zon ini perlukan road (dan clearance atau retention works) sebelum boleh dibina.",
  "The park is in receivership.": "Park dalam receivership.",
  "That work is not available in this zone now.": "Kerja itu tidak tersedia di zon ini sekarang.",
  "That is already your policy.": "Itu memang polisi anda sekarang.",
  "That applicant has gone.": "Pemohon itu sudah pergi.",
  "Only during the downturn.": "Hanya semasa downturn.",
  "Only an empty, ready building can be mothballed.": "Hanya bangunan kosong yang siap boleh di-mothball.",
  "Only a finished New Build or Modular block can be sold and leased back.": "Hanya New Build atau Modular block yang siap boleh dijual dan disewa semula (sale and leaseback).",
  "Not running.": "Tidak berjalan.",
  "Not mothballed.": "Tidak di-mothball.",
  "No unsigned Zone H plot.": "Tiada plot Zon H yang belum ditandatangani.",
  "No free plot in this zone.": "Tiada plot kosong di zon ini.",
  "No back-office tenants.": "Tiada penyewa back-office.",
  "No action points left this quarter.": "Action point suku ini sudah habis.",
  "Needs a free unit in a ready building with fibre.": "Perlukan unit kosong dalam bangunan siap yang ada fibre.",
  "Choose a shed to retrofit.": "Pilih shed untuk di-retrofit.",
  "Cannot repay that amount.": "Tidak boleh bayar balik jumlah itu.",
  "Already running.": "Sudah berjalan.",
  "An anchor needs a Lab or Lab Access.": "Anchor perlukan Lab atau Lab Access.",
  "Finish the retention works first; then the wetland can become a park.": "Siapkan retention works dahulu; kemudian tanah lembap boleh dijadikan park.",
  "No free incubator place.": "Tiada tempat kosong dalam incubator.",
  "No free unit with road, water and power.": "Tiada unit kosong yang ada road, water dan power.",
  "No free unit with road, water, power and fibre.": "Tiada unit kosong yang ada road, water, power dan fibre.",
  "Only the untouched forest can be declared a green buffer.": "Hanya hutan yang belum diteroka boleh diisytiharkan green buffer.",
  "Your admission policy does not allow this applicant.": "Polisi kemasukan anda tidak membenarkan pemohon ini.",
  "Pick a team first.": "Pilih team dahulu.",
  "The clock has not started yet.": "Jam belum bermula.",
  "The game is over.": "Permainan sudah tamat.",
  "The Deal Room is open: decide on the deal first.": "Deal Room sedang dibuka: putuskan deal itu dahulu.",
  "Your park is in receivership.": "Park anda dalam receivership.",
};
function whyL(w) {
  if (!w || HOST.lang !== "ms") return w;
  if (WHY_MS[w]) return WHY_MS[w];
  let m;
  if ((m = /^Not enough cash \(([\d.]+) Cr needed\)\. Borrow first\.$/.exec(w))) return "Tunai tidak cukup (" + m[1] + " Cr diperlukan). Pinjam dahulu.";
  if ((m = /^Loan limit is ([\d.]+) Cr in total( during the downturn)?\.$/.exec(w))) return "Had pinjaman ialah " + m[1] + " Cr kesemuanya" + (m[2] ? " semasa downturn" : "") + ".";
  if ((m = /^Choose a new level from 0 to (\d+)\.?$/.exec(w))) return "Pilih tahap baharu dari 0 hingga " + m[1] + ".";
  return w;
}

/* =============================================================== site plan */
function svcState(t, z, k) {
  const S = t.zones[z]; const v = S.svc[k];
  const inWork = S.works.some(w => w.kind === k || (k === "road" && w.kind === "roadHalf") || (k === "power" && w.kind === "powerShared"));
  return v >= 1 ? "on" : (inWork ? "work" : (v > 0 ? "half" : "off"));
}
function zoneSlots(t, z, m, SI) {
  const Z = C.ZONES[z], out = [];
  const bl = t.buildings.filter(b => b.zone === z);
  if (z === "A") { const ad = (SI || siteOf()).admin; out.push({ k: "static", label: ad[0], sub: ad[1] }); for (const b of bl) out.push({ k: "b", b }); return out; }
  if (z === "B") { for (const b of bl) out.push({ k: "b", b }); return out; }
  if (z === "H") {
    if (m < Z.release) return [{ k: "locked" }];
    let bi = 0; const hb = bl.slice();
    for (const p of t.hplots) {
      if (p === null) out.push({ k: "free" });
      else if (p === "build") out.push(hb[bi] ? { k: "b", b: hb[bi++] } : { k: "lease", label: "Built" });
      else if (p === "lease" || p === "leaseC") out.push({ k: "lease", label: "Lease", sub: p === "leaseC" ? "covenant" : "as offered" });
      else if (p === "reserve") out.push({ k: "lease", label: "Reserved", sub: "named use" });
      else if (p === "natlab") out.push({ k: "lease", label: "Nat. lab", sub: "linked" });
      else if (p === "reclaimed") out.push({ k: "gone", label: "Lost" });
    }
    return out;
  }
  for (const b of bl) out.push({ k: "b", b });
  for (const l of t.leases) if ((l.kind === "dc" && z === "D") || (l.kind === "dcC" && (l.zone || "D") === z)) out.push({ k: "lease", label: "Data ctr", sub: l.kind === "dcC" ? "covenant" : "lease" });
  const free = Z.plots - t.zones[z].plotsUsed; for (let i = 0; i < free; i++) out.push({ k: "free" });
  return out;
}
function boxSVG(x, y, s, t, T, D) {
  D = D || BOX_VALLEY;
  const W = D.w, H = D.h; let cls = "bx", inner = "";
  if (s.k === "b") {
    const b = s.b; cls += " " + (b.status === "ready" ? "ready" : b.status);
    inner += `<text x="${x + 5}" y="${y + D.t1}">${esc(b.id)}</text><text class="k" x="${x + 5}" y="${y + D.t2}">${esc(KSHORT[b.kind] || b.kind)}</text>`;
    if (b.status === "building") {
      const p = clamp((T - (b.startAt - 1)) / Math.max(1, b.readyAt - b.startAt + 1), 0, 1);
      inner += `<rect class="prog-bg" x="${x + 5}" y="${y + D.cy + 1}" width="${W - 10}" height="${D.ch - 2}" rx="2"/><rect class="prog" x="${x + 5}" y="${y + D.cy + 1}" width="${(W - 10) * p}" height="${D.ch - 2}" rx="2"/>`;
    } else if (b.status !== "shed") {
      const used = t.tenants.filter(q => q.bid === b.id).reduce((a, q) => a + C.TEN[q.type].units, 0);
      let fac = 0; for (const k in t.fac) if (t.fac[k] && t.fac[k].bid === b.id) fac += C.FAC[k].units;
      const n = Math.min(b.units, 6), cw = (W - 10) / 6;
      for (let i = 0; i < n; i++) inner += `<rect class="uc ${i < used ? "on" : (i < used + fac ? "fac" : "")}" x="${x + 5 + i * cw + 0.5}" y="${y + D.cy}" width="${cw - 1.5}" height="${D.ch}" rx="1.5"/>`;
    }
  } else if (s.k === "free") { cls += " free"; inner = `<text class="free" x="${x + W / 2}" y="${y + H / 2 + 4}" text-anchor="middle">+ plot</text>`; }
  else if (s.k === "static" || s.k === "lease") { cls += " lease"; inner = `<text x="${x + 5}" y="${y + D.t1}">${esc(s.label)}</text><text class="k" x="${x + 5}" y="${y + D.t2}">${esc(s.sub || "")}</text>`; }
  else if (s.k === "gone") { cls += " gone"; inner = `<text class="k" x="${x + 5}" y="${y + D.t2}">${esc(s.label)}</text>`; }
  return `<g class="${cls}"><rect class="b" x="${x}" y="${y}" width="${W}" height="${H}" rx="4"/>${inner}</g>`;
}
const BOX_VALLEY = { w: 54, h: 46, t1: 14, t2: 26, cy: 33, ch: 8, svc: [20, 17, 24, 12.5], sub: 16 };
const BOX_CORRIDOR = { w: 46, h: 38, t1: 13, t2: 23, cy: 28, ch: 7, svc: [17, 15, 19, 11], sub: 14 };
/* generic valley: campus to the west, the highway along the south, a ridge to the north-east, a creek running from the ridge into the wetland */
const GEO_VALLEY = {
  H: { poly: [[72, 16], [330, 26], [350, 148], [250, 168], [74, 150]], label: [86, 42], svc: [86, 66], slots: [[86, 94], [144, 94], [202, 94], [260, 94]], wk: 50, acres: "15 ac · beside the campus" },
  C: { poly: [[74, 150], [250, 168], [350, 148], [370, 262], [292, 312], [58, 320]], label: [86, 186], svc: [262, 176], slots: [[86, 222], [144, 222], [202, 222], [260, 222]], acres: "15 ac · campus edge" },
  E: { poly: [[350, 148], [580, 104], [640, 262], [620, 400], [416, 400], [420, 336], [370, 262]], label: [384, 184], svc: [500, 150], slots: [[384, 208], [442, 208], [500, 208], [384, 262], [442, 262]], acres: "15 ac · plateau" },
  F: { poly: [[330, 26], [600, 8], [972, 26], [982, 210], [750, 246], [640, 262], [580, 104]], label: [612, 58], svc: [870, 40], slots: [[612, 126], [670, 126], [728, 126], [786, 126]], acres: "15 ac · ridge, 60 m rise" },
  G: { poly: [[640, 262], [750, 246], [982, 210], [990, 432], [880, 440], [830, 400], [620, 400]], label: [706, 296], svc: [880, 262], slots: [[706, 322], [764, 322]], acres: "10 ac · low ground, creek outfall" },
  A: { poly: [[58, 320], [200, 330], [196, 440], [64, 470]], label: [78, 356], svc: [96, 372], slots: [[78, 388], [136, 388]], acres: "8 ac · at the junction" },
  B: { poly: [[200, 330], [292, 312], [370, 262], [420, 336], [410, 440], [196, 440]], label: [212, 356], svc: [312, 328], slots: [[212, 388], [270, 388], [328, 388]], acres: "12 ac · old works yard" },
  D: { poly: [[196, 440], [410, 440], [416, 400], [830, 400], [860, 472], [196, 472]], label: [614, 424], svc: [740, 448], slots: [[430, 418], [488, 418], [546, 418]], acres: "10 ac · long strip on the highway" },
};
/* Campus corridor: the outline of a real university park strip along a highway, rotated 41° so the highway runs along the top and
 * stretched 1.5× across the strip to make room for play. The zones are the game's own layout (same neighbours as the valley map),
 * not the plots of the approved plan. */
const GEO_CORRIDOR = {
  H: { poly: [[40, 84], [320, 89], [320, 219], [292, 194], [255, 172], [200, 170], [140, 182], [92, 195], [60, 207], [50, 183], [38, 93]], label: [56, 106], svc: [232, 97], slots: [[56, 126], [104, 126], [152, 126], [200, 126]], note: [56, 150], wkAt: [56, 181], acres: "15 ac" },
  C: { poly: [[320, 89], [458, 93], [458, 198], [560, 198], [560, 250], [470, 250], [320, 168]], label: [328, 110], svc: [330, 130], slots: [[362, 150], [410, 150], [464, 205], [512, 205]], note: [330, 160], wkAt: [330, 160], wrap: true, acres: "15 ac" },
  A: { poly: [[458, 93], [582, 97], [582, 198], [458, 198]], label: [466, 114], svc: [466, 134], slots: [[464, 156], [516, 156]], wkAt: [466, 196], acres: "8 ac" },
  B: { poly: [[582, 97], [735, 101], [735, 250], [560, 250], [560, 198], [582, 198]], label: [590, 118], svc: [590, 137], slots: [[590, 158], [638, 158], [686, 158]], wkAt: [566, 214], acres: "12 ac" },
  D: { poly: [[735, 101], [895, 105], [912, 126], [906, 168], [907, 213], [735, 213]], label: [744, 119], svc: [744, 138], slots: [[744, 159], [792, 159], [840, 159]], note: [744, 184], wkAt: [744, 209], acres: "10 ac" },
  E: { poly: [[320, 168], [470, 250], [735, 250], [735, 213], [775, 213], [775, 361], [770, 360], [700, 362], [640, 375], [578, 402], [548, 380], [505, 340], [470, 315], [420, 282], [370, 255], [330, 228], [320, 219]], label: [522, 272], svc: [694, 262], slots: [[522, 292], [570, 292], [618, 292], [666, 292], [714, 292]], note: [522, 316], wkAt: [524, 348], acres: "15 ac" },
  G: { poly: [[812, 213], [907, 213], [908, 243], [922, 303], [940, 366], [812, 366]], label: [820, 232], svc: [820, 252], slots: [[820, 276], [868, 276]], note: [818, 292], wkAt: [818, 352], wrap: 17, acres: "10 ac" },
  F: { poly: [[775, 213], [812, 213], [812, 366], [940, 366], [962, 441], [950, 471], [922, 525], [893, 576], [866, 588], [842, 570], [822, 513], [794, 393], [775, 361]], label: [806, 386], svc: [806, 406], slots: [[812, 426], [860, 426], [822, 468], [870, 468]], note: [812, 442], wkAt: [826, 530], wrap: 20, acres: "15 ac" },
};
const SITES = {
  valley: { key: "valley", name: "Green valley", h: 560, geo: GEO_VALLEY, box: BOX_VALLEY, cls: "", off: [930, 512], admin: ["Admin", "office"],
    under: () => `<polygon class="campus" points="6,14 60,10 72,150 56,320 64,470 6,478"/><text class="zsub" text-anchor="middle" transform="translate(32 240) rotate(-90)">University campus</text>`,
    ridge: `<path d="M700 220 C 720 150 800 110 900 130 S 980 190 985 230"/><path d="M745 235 C 760 180 820 145 900 160 S 970 205 980 236"/><path d="M790 246 C 800 205 850 180 905 190 S 960 220 972 246"/><path d="M640 262 C 660 190 740 130 860 112"/>`,
    over: () => `<path d="M 790 34 C 730 120 690 190 640 262 C 612 300 640 356 690 396" style="fill:none;stroke:var(--wave);opacity:.85" stroke-width="3" stroke-linecap="round" pointer-events="none"/><text class="zsub" x="646" y="236" pointer-events="none" style="font-size:10.5px">creek</text>
<path class="hwy" d="M 0 486 C 200 480 420 478 640 482 S 900 486 1000 470 L 1000 508 C 900 522 700 520 640 518 S 200 516 0 522 Z"/><text class="hwytext" x="300" y="508" text-anchor="middle">HIGHWAY · THE ONLY PUBLIC ACCESS</text>
<rect x="118" y="460" width="14" height="30" style="fill:var(--hwy)"/><text class="zsub" x="140" y="466" style="font-size:10.5px" pointer-events="none">gate</text>` },
  corridor: { key: "corridor", name: "Campus corridor", h: 620, geo: GEO_CORRIDOR, box: BOX_CORRIDOR, cls: " corridor", off: [96, 560], admin: ["TTO", "admin office"],
    under: () => `<path class="campus" d="M 262 6 L 1000 6 L 1000 78 L 262 58 Z"/><text class="zsub" x="600" y="36" text-anchor="middle" style="font-size:13px;font-weight:600">University campus</text>
<text class="zsub" x="98" y="300" pointer-events="none">golf course</text><text class="zsub" x="330" y="360" pointer-events="none">homes</text>
<path d="M 985 110 C 978 200 996 300 978 380 S 960 520 972 620" style="fill:none;stroke:var(--wave);opacity:.8" stroke-width="7" stroke-linecap="round"/><text class="zsub" x="984" y="400" pointer-events="none" style="font-size:10.5px" text-anchor="end" transform="rotate(-80 984 400)">river</text>`,
    ridge: `<path d="M 800 420 C 840 400 900 400 950 440"/><path d="M 810 460 C 850 440 900 445 940 480"/><path d="M 822 505 C 860 485 895 490 925 520"/><path d="M 836 548 C 865 532 890 536 905 555"/>`,
    over: () => `<path d="M 858 580 C 850 520 880 470 872 420 C 866 390 880 350 902 320 C 930 290 960 300 980 320" style="fill:none;stroke:var(--wave);opacity:.85" stroke-width="3" stroke-linecap="round" pointer-events="none"/><text class="zsub" x="878" y="512" pointer-events="none" style="font-size:10.5px">creek</text>
<path class="hwy" d="M 0 55 L 1000 80 L 1000 104 L 0 79 Z"/><text class="hwytext" x="290" y="72" text-anchor="middle" transform="rotate(1.4 290 72)">HIGHWAY · COAST TO CITY</text>
<text class="zsub" x="6" y="50" pointer-events="none" style="font-size:11px">← coast</text><text class="hwytext" x="992" y="97" pointer-events="none" text-anchor="end">city →</text>
<path d="M 930 104 L 930 6" style="stroke:var(--hwy);stroke-width:9"/><text class="zsub" x="922" y="22" pointer-events="none" style="font-size:11px" text-anchor="end">university ↑</text>
<path d="M 866 588 L 872 620" style="stroke:var(--hwy);stroke-width:9"/><text class="zsub" x="858" y="612" pointer-events="none" style="font-size:11px" text-anchor="end">township ↓</text>
<rect x="514" y="70" width="12" height="28" style="fill:var(--hwy)"/>
<g transform="translate(40 250) rotate(-31)" pointer-events="none"><path d="M0 -16 L6 6 L0 2 L-6 6 Z" style="fill:var(--ink-2)"/><text class="zsub" x="0" y="-20" text-anchor="middle" style="font-size:10px;font-weight:700">N</text></g>
<text class="zsub" x="40" y="604" pointer-events="none" style="font-size:10.5px">__SITE_NOTE__</text>` },
};
SITES.utm = SITES.corridor;   // games saved by v0.5.1
const SITE_TXT_MS = { "HIGHWAY · COAST TO CITY": "LEBUH RAYA · PANTAI KE BANDAR", "HIGHWAY · THE ONLY PUBLIC ACCESS": "LEBUH RAYA · SATU-SATUNYA AKSES AWAM", "University campus": "Kampus universiti",
  "city →": "bandar →", "creek": "anak sungai", "gate": "pintu masuk", "golf course": "padang golf", "homes": "perumahan", "river": "sungai", "township ↓": "perbandaran ↓", "university ↑": "universiti ↑", "← coast": "← pantai" };
function siteTextL(svg) {
  svg = svg.replace("__SITE_NOTE__", L("Site inspired by UTM Technovation Park, Skudai. Zones and conditions are a game layout, not the approved plan.", "Tapak diilhamkan daripada UTM Technovation Park, Skudai. Zon dan syaratnya ialah susun atur permainan, bukan pelan yang diluluskan."));
  return HOST.lang === "ms" ? svg.replace(/>([^<>]{2,})<\/text>/g, (m, x) => ">" + (SITE_TXT_MS[x] || x) + "</text>") : svg;
}
function siteKey() { const g = APP.store && APP.store.game; const k = (g && g.site) || HOST.site || "corridor"; return SITES[k] ? k : "corridor"; }
function siteOf(k) { return SITES[k || siteKey()]; }
const GEO = GEO_VALLEY;   // kept for any caller that expects the old name
const ACRES_MS = {"10 ac · long strip on the highway": "10 ek · jalur panjang di lebuh raya", "10 ac · low ground, creek outfall": "10 ek · tanah rendah, muara anak sungai", "12 ac · old works yard": "12 ek · bekas kawasan bengkel", "15 ac · beside the campus": "15 ek · di sebelah kampus", "15 ac · campus edge": "15 ek · pinggir kampus", "15 ac · plateau": "15 ek · dataran tinggi", "15 ac · ridge, 60 m rise": "15 ek · rabung, naik 60 m", "8 ac · at the junction": "8 ek · di persimpangan"};
function acresL(a) { return HOST.lang === "ms" ? (ACRES_MS[a] || String(a).replace(/ ac\b/, " ek")) : a; }
const ZSHORT = { A: "Gateway", B: "Old Workshops", C: "Campus Edge", D: "Highway Frontage", E: "Central Plateau", F: "Forest Ridge", G: "Wetland", H: "University Reserve" };
function poly(pts) { return pts.map(p => p.join(",")).join(" "); }
function noteSVG(cls, x, y, txt, wrap) {
  if (!wrap) return `<text class="${cls}" x="${x}" y="${y}">${esc(txt)}</text>`;
  const max = wrap === true ? 18 : wrap, lines = [];
  for (const part of txt.split(" · ")) {
    let cur = "";
    for (const w of part.split(" ")) { if (cur && (cur + " " + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; }
    if (cur) lines.push(cur);
  }
  return `<text class="${cls}" x="${x}" y="${y}">${lines.map((w, i) => `<tspan x="${x}" dy="${i ? 12.5 : 0}">${esc(w)}</tspan>`).join("")}</text>`;
}
function planSVG(t, m, T, sel, idp, siteK) {
  const p = idp || "m", SI = siteOf(siteK), GE = SI.geo, D = SI.box;
  let s = `<svg class="plan${SI.cls}" viewBox="0 0 1000 ${SI.h}" role="img" aria-label="${L("Site plan of the park in eight zones", "Pelan tapak park dalam lapan zon")} (${esc(SI.name)})">
<defs>
<pattern id="${p}pf" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="7" cy="8" r="4.4" style="fill:var(--tree)" opacity=".5"/><circle cx="19" cy="19" r="3.6" style="fill:var(--tree)" opacity=".42"/></pattern>
<pattern id="${p}pb" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="9" cy="10" r="3.6" style="fill:var(--tree)" opacity=".28"/><circle cx="25" cy="25" r="3" style="fill:var(--tree)" opacity=".24"/></pattern>
<pattern id="${p}pw" width="30" height="14" patternUnits="userSpaceOnUse"><path d="M0 7 q7.5 -5 15 0 t15 0" style="fill:none;stroke:var(--wave)" stroke-width="1.5" opacity=".6"/></pattern>
<pattern id="${p}ph" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" style="stroke:var(--map-edge)" stroke-width="1.3" opacity=".5"/></pattern>
<clipPath id="${p}cf"><polygon points="${poly(GE.F.poly)}"/></clipPath>
</defs>
${siteTextL(SI.under())}`;
  for (const z of ["H", "C", "E", "F", "G", "A", "B", "D"]) {
    const G = GE[z], S = t.zones[z], Z = C.ZONES[z];
    const [lx, ly] = G.label, [fx, fy] = G.slots[0], [nx, ny] = G.note || [fx, fy + 30];
    if (S.locked) {
      const LL = lvl(LOCKED_IN[z]);
      s += `<g class="zone locked${sel === z ? " sel" : ""}" data-act="zone" data-z="${z}" tabindex="0" role="button" aria-label="${L(`Zone ${z}, ${esc(Z.name)}, not in this level`, `Zon ${z}, ${esc(Z.name)}, bukan dalam level ini`)}"><polygon class="zfill z-${z}" points="${poly(G.poly)}"/><polygon points="${poly(G.poly)}" fill="url(#${p}ph)" pointer-events="none"/>
<text class="zname" x="${lx}" y="${ly}">${z} · ${esc(Z.name)}</text><text class="zsub" x="${lx}" y="${ly + D.sub}">${esc(acresL(G.acres))}</text>${noteSVG("lockt", nx, ny, L("Opens in Level ", "Dibuka dalam Level ") + LL.n + " · " + LL.name, G.wrap)}</g>`;
      continue;
    }
    let over = "", tag = "";
    if (S.mode === "forest") over = `<polygon points="${poly(G.poly)}" fill="url(#${p}pf)" pointer-events="none"/>`;
    if (S.mode === "buffer") over = `<polygon points="${poly(G.poly)}" fill="url(#${p}pb)" pointer-events="none"/>`;
    if (S.mode === "wet" || S.mode === "park") over = `<polygon points="${poly(G.poly)}" fill="url(#${p}pw)" pointer-events="none"/>`;
    if (z === "H" && m < Z.release) over = `<polygon points="${poly(G.poly)}" fill="url(#${p}ph)" pointer-events="none"/>`;
    if (S.mode === "buffer") tag = L("Green buffer · +1 impact/yr", "Green buffer · +1 impact/thn"); if (S.mode === "park") tag = L("Retention park · +1 impact/yr", "Retention park · +1 impact/thn");
    let plots = "";
    if (Z.plots) { const used = z === "H" ? t.hplots.filter(q => q !== null).length : S.plotsUsed; plots = ` · ${used}/${Z.plots} plot${L("s", "")}`; }
    if (z === "B") plots = " · 3 shed" + L("s", "");
    s += `<g class="zone${sel === z ? " sel" : ""}" data-act="zone" data-z="${z}" tabindex="0" role="button" aria-label="${L("Zone", "Zon")} ${z}, ${esc(Z.name)}"><polygon class="zfill z-${z}" points="${poly(G.poly)}"/>`;
    if (z === "F") s += `<g clip-path="url(#${p}cf)" pointer-events="none" style="fill:none;stroke:var(--map-edge);opacity:.45" stroke-width="1">${SI.ridge}</g>`;
    s += over;
    s += `<text class="zname" x="${lx}" y="${ly}">${z} · ${esc(Z.name)}</text><text class="zsub" x="${lx}" y="${ly + D.sub}">${esc(acresL(G.acres))}${plots}</text>`;
    let [sx, sy] = G.svc; const [cw, ch, cp, cty] = D.svc;
    for (const k of ["road", "water", "power", "fibre"]) { s += `<g class="svc ${svcState(t, z, k)}"><rect x="${sx}" y="${sy}" width="${cw}" height="${ch}" rx="3"/><text x="${sx + cw / 2}" y="${sy + cty}">${k[0].toUpperCase()}</text></g>`; sx += cp; }
    if (z === "H" && m < Z.release) s += noteSVG("lockt", nx, ny, L("Locked · released 1 Jan, Year 3", "Dikunci · dilepaskan 1 Jan, Tahun 3"), G.wrap);
    else if (tag) s += noteSVG("note-good", nx, ny, tag, G.wrap);
    else if (S.mode === "forest") s += noteSVG("lockt", nx, ny, L("Forest · clear it (ESG −3) or keep it", "Hutan · buka (ESG −3) atau kekalkan"), G.wrap);
    else if (S.mode === "wet") s += noteSVG("lockt", nx, ny, L("Wetland · retention works first", "Tanah lembap · retention works dahulu"), G.wrap);
    else { const slots = zoneSlots(t, z, m, SI); slots.forEach((sl, i) => { if (G.slots[i]) s += boxSVG(G.slots[i][0], G.slots[i][1], sl, t, T, D); }); }
    const wk = S.works.slice(0, G.wrap ? 1 : 2).map(w => (C.WORKS[w.kind].label.replace(" connection", "").replace(" (shared substation)", "")) + " → " + mnameL(w.doneAt));
    const [wx, wy] = G.wkAt || [fx, fy + (G.wk || 62)];
    if (wk.length) s += `<text class="wk" x="${wx}" y="${wy}">${esc(wk.join(" · "))}</text>`;
    if (S.protected && (z === "E" || z === "G")) s += `<text class="note-good" x="${wx}" y="${wy + 14}">${L("flood-protected", "dilindungi banjir")}</text>`;
    s += `</g>`;
  }
  s += siteTextL(SI.over());
  const X = t.buildings.filter(b => b.zone === "X");
  if (X.length) { const [ox, oy] = SI.off; s += `<text class="zsub" x="${ox - 50}" y="${oy + 24}">${L("Off-site", "Luar tapak")}</text>`; X.forEach(b => { s += boxSVG(ox, oy, { k: "b", b }, t, T, D); }); }
  return s + `</svg>`;
}
function planLegend() {
  return `<div class="maplegend"><span><i style="background:var(--accent);border-color:var(--accent)"></i>${L("service in place", "services tersedia")}</span><span><i style="background:var(--accent-soft);border-color:var(--accent)"></i>${L("partial", "separa")}</span><span><i style="background:var(--amber-soft);border-color:var(--amber)"></i>${L("works under way", "kerja sedang berjalan")}</span><span><i style="background:var(--panel)"></i>${L("missing", "tiada")}</span><span>R road · W water · P power · F fibre</span><span>${L("Squares in a building: let units (teal), facilities (amber), empty", "Petak dalam bangunan: unit disewa (teal), kemudahan (amber), kosong")}</span></div>`;
}

/* =============================================================== team view parts */
function apDots(ap) { let s = ""; const n = Math.max(ap, 0); for (let i = 0; i < Math.max(3, n); i++) s += `<i class="${i < n ? "on" : ""}"></i>`; return s; }
function nextAPMonth(m, months) { const q = Math.floor((m - 1) / 3); const nm = (q + 1) * 3 + 1; return nm <= months ? mname(nm).replace(/ Y\d/, "") : "—"; }
function brandHTML(sub) { return `<div class="brand" data-act="home" title="${L("Back to start", "Kembali ke halaman utama")}">${BRAND.name} <span>${esc(sub || BRAND.tag)}</span></div>`; }
function barTeam(res, tm) {
  const t = tm.t, g = res.g, ck = res.ck, d = dateParts(ck.T, res.months), frac = ck.T - Math.floor(ck.T), lv = res.lv;
  const cap = PB.loanCap(t, res.sc, res.mCur);
  const fund = res.mCur <= t.fundEnd ? n1(t.fund) : `<small>lapsed</small>`;
  const net = tm.P.net, run = net < 0 && t.cash > 0 ? t.cash / -net : (t.cash <= 0 ? 0 : 99);
  const cashCls = t.cash < 0 || run < 6 ? "bad" : (run < 12 ? "warn" : ""), cashTip = t.cash < 0 ? "Cash is negative: the bank will step in" : (run < 12 ? "At this rate cash runs out in about " + Math.max(1, Math.floor(run)) + " months" : "Cash and the monthly change (income minus costs)");
  const left = t.fundEnd - res.mCur + 1, fundCls = res.mCur <= t.fundEnd && t.fund > 3 && left <= 6 ? "warn" : "", fundTip = res.mCur <= t.fundEnd ? "Development Fund left; it lapses at the end of Year " + Math.ceil(t.fundEnd / 12) + (left <= 6 ? " (" + left + " months): spend it or lose it" : "") : "The Development Fund has closed";
  const debt = t.debt + t.emerg, loanCls = t.emerg > 0 || (cap > 0 && debt / cap >= 0.8) ? "warn" : "";
  const behind = res.ck.T > 12 && tm.ps.score < lv.score.parkTarget * (res.ck.T - 6) / res.months;
  return `<div class="bar-in">
${brandHTML()}
<div class="teamname">${esc(tm.name)}</div>
<div class="dateblk"><span class="d">${d.day} ${d.month}</span><span class="y">Year ${d.year}</span><span class="daybar" aria-hidden="true"><i style="width:${pc(frac)}"></i></span></div>
${levelChip(res)} ${phaseChip(res)} ${statusChip(g, ck)}
<div class="spacer"></div>
<div class="kpis">
<div class="kpi ${cashCls}" title="${esc(cashTip)}"><span class="label">Cash, Cr</span><span class="v">${n1(t.cash)} <small class="${net < 0 ? "neg" : (net > 0 ? "pos" : "")}">${net < 0 ? "▼" : (net > 0 ? "▲" : "")} ${sg1(net)}/mo</small></span></div>
<div class="kpi ${fundCls}" title="${esc(fundTip)}"><span class="label">Fund</span><span class="v">${fund}${fundCls ? `<small> ${left} mo</small>` : ""}</span></div>
${lv.key === "rintis" ? "" : `<div class="kpi ${loanCls}" title="${t.emerg > 0 ? "Includes an emergency loan from the bank" : "Loans against the bank's limit"}"><span class="label">Loans</span><span class="v">${n1(debt)}<small> / ${cap}</small></span></div>`}
<div class="kpi ${behind ? "warn" : ""}" title="${behind ? "Below the pace needed to reach the target by the final bell" : "Park score against the level target"}"><span class="label">Score</span><span class="v">${n0(tm.ps.score)}<small> / ${lv.score.parkTarget}</small></span></div>
${lv.score.E > 0 ? `<div class="kpi"><span class="label">ESG</span><span class="v" style="color:${t.esg < 0 ? "var(--bad)" : "inherit"}">${t.esg >= 0 ? "+" : ""}${n1(t.esg)}</span></div>` : ""}
<div class="kpi ${t.ap === 0 ? "dim" : ""}" title="Action points: each order for works, a building or a facility uses one. You get ${t.apQ} at the start of every quarter; unused points are lost."><span class="label">Action points</span><span class="v"><span class="ap">${apDots(t.ap)}</span>${t.ap} left${nextAPMonth(res.mCur, res.months) === "—" ? "" : `<small> · ${t.apQ} more in ${nextAPMonth(res.mCur, res.months)}</small>`}</span></div>
</div></div>`;
}
function soloControls(res) {
  const g = res.g; if (store().mode !== "solo" || HOST.shell) return "";   // v0.6: the shell's clock bar replaces this strip
  const paces = [[5000, "5 s"], [10000, "10 s"], [20000, "20 s"], [60000, "60 s"]];
  let b = "";
  if (g.status === "setup") b += `<button class="btn primary" data-act="solo-start">Start the clock</button>`;
  else if (g.status === "running") b += `<button class="btn" data-act="solo-pause">Pause</button>`;
  else if (g.status === "paused" && !g.lastReveal) b += `<button class="btn primary" data-act="solo-resume">Resume</button>`;
  b += `<span class="label" style="margin-left:6px">One month every</span>` + paces.map(([v, l]) => `<button class="btn sm${g.msPerMonth === v ? " primary" : ""}" data-act="solo-pace" data-v="${v}">${l}</button>`).join("");
  b += `<span class="spacer"></span><span class="label">New game</span>` + LEVEL_KEYS.map(k => `<button class="btn sm" data-act="solo-new" data-level="${k}" title="${esc(LEVEL_TEXT[k].blurb)}">${esc(lvLabel(k))}</button>`).join("");
  return `<div class="banner info"><span class="label">Practice</span>${HOST.offline ? `<span class="chip warn">Offline copy · results are not recorded</span>` : ""}${b}</div>`;
}
/* coach: up to three concrete next steps, shown in Levels 1 and 2 */
function coachTips(res, tm) {
  const t = tm.t, m = res.mCur, sc = res.sc, tips = [];
  if (!canAct(res).ok) return tips;
  const adm = t.applicants.filter(a => PB.validate(t, sc, { type: "admit", aid: a.id }, m).ok);
  if (adm.length) tips.push({ text: L(`${adm.length} applicant${adm.length > 1 ? "s" : ""} can move in now. Admitting is free and uses no action points.`, `${adm.length} pemohon boleh masuk sekarang. Penerimaan percuma dan tidak menggunakan action point.`), act: "tab", k: "apps", go: L("Open applicants", "Buka pemohon") });
  else if (t.applicants.length) {
    const why = whyL(PB.validate(t, sc, { type: "admit", aid: t.applicants[0].id }, m).why || "");
    tips.push({ text: L(`Applicants are waiting but cannot move in: ${why.replace(/\.$/, "")}. Retrofit a shed in Zone B or build in Zone C, and bring fibre where tech tenants need it.`,
      `Ada pemohon menunggu tetapi belum boleh masuk: ${why.replace(/\.$/, "")}. Retrofit shed di Zon B atau bina di Zon C, dan sediakan fibre di tempat penyewa teknologi memerlukannya.`), act: "zone", z: t.zones.B.svc.fibre < 1 ? "B" : "C", go: L("Show me", "Tunjukkan") });
  }
  if (!t.fac.kpi && m >= 2) tips.push({ text: L("Launch KPI & Impact Reporting: until you do, your impact counts only half.", "Lancarkan KPI & Impact Reporting: selagi belum, impact anda hanya dikira separuh."), act: "tab", k: "fac", go: L("Facilities", "Kemudahan") });
  if (t.zones.C.svc.road < 1 && !t.zones.C.works.length && m <= 18) tips.push({ text: L("Zone C's road is half built. Completing it (0.8 Cr, 2 months) opens four plots beside the campus.", "Road Zon C baru separuh siap. Menyiapkannya (0.8 Cr, 2 bulan) membuka empat plot di sebelah kampus."), act: "zone", z: "C", go: L("Zone C", "Zon C") });
  if (m <= t.fundEnd && t.fund > 3 && m >= t.fundEnd - 8) tips.push({ text: L(`${n1(t.fund)} Cr of the fund lapses on 31 Dec Year 2. Spend it on works, buildings or facilities while it pays ${pc(t.fundShare)}.`, `${n1(t.fund)} Cr daripada fund akan luput pada 31 Dis Tahun 2. Belanjakan untuk kerja, bangunan atau kemudahan selagi ia membayar ${pc(t.fundShare)}.`), act: "zone", z: "B", go: L("Spend it", "Belanjakan") });
  if (tm.ps.fcr < 1 && tm.ps.fcr < 8) tips.push({ text: L(`Income covers only ${pc(tm.ps.fcr)} of upkeep and interest. Fill empty units before you build more.`, `Pendapatan hanya menampung ${pc(tm.ps.fcr)} daripada upkeep dan faedah. Penuhkan unit kosong sebelum membina lagi.`), act: "tab", k: "park", go: "Park" });
  if (tm.P.net < 0 && t.cash > 0 && t.cash / -tm.P.net < 8) { const n = Math.max(1, Math.floor(t.cash / -tm.P.net)); tips.push({ text: L(`At this rate your cash runs out in about ${n} months.`, `Pada kadar ini, tunai anda habis dalam kira-kira ${n} bulan.`), act: "tab", k: "money", go: L("Money", "Kewangan") }); }
  if (t.ap > 0 && m % 3 === 0) { const mm = mnameL(m).replace(/ [YT]\d/, ""); tips.push({ text: L(`You still have ${t.ap} action point${t.ap > 1 ? "s" : ""}. They are lost at the end of ${mm}.`, `Anda masih ada ${t.ap} action point. Ia akan hilang pada hujung ${mm}.`), act: "tab", k: "fac", go: L("Use them", "Gunakan") }); }
  return tips.slice(0, 3);
}
function coachHTML(res, tm) {
  if (!res.lv.coach || res.g.status === "setup") return "";
  const tips = coachTips(res, tm); if (!tips.length) return "";
  return `<div class="banner coach"><span class="label">Coach</span><div class="tips">${tips.map(x => `<div class="tip"><span>${esc(x.text)}</span><button class="btn sm" data-act="${x.act}"${x.k ? ` data-k="${x.k}"` : ""}${x.z ? ` data-z="${x.z}"` : ""}>${esc(x.go)}</button></div>`).join("")}</div></div>`;
}
function bannerTeam(res, tm) {
  const g = res.g, ck = res.ck, t = tm.t, m = res.mCur, lv = res.lv, out = [];
  out.push(soloControls(res));
  if (g.notice && g.notice.text) out.push(`<div class="banner notice"><span class="label">Game Master</span><b>${esc(g.notice.text)}</b></div>`);
  if (g.fast && g.status !== "ended" && store().mode === "solo") out.push(`<div class="banner down fastend"><b>${L("Ending the game: the remaining months play out without new orders.", "Menamatkan permainan: baki bulan berjalan tanpa arahan baharu.")}</b><span>${Math.max(0, Math.ceil(res.months - res.ck.T))} ${L("months left", "bulan lagi")}</span><button class="btn sm" data-act="solo-end-now">${L("End now", "Tamat sekarang")}</button></div>`);
  if (g.status === "setup" && store().mode === "live") out.push(`<div class="banner info"><b>${L("Waiting for the Game Master.", "Menunggu Game Master.")}</b><span class="muted">${L("Explore your site, the applicants and the rules. Orders open when the clock starts.", "Tinjau tapak, pemohon dan peraturan. Arahan dibuka apabila jam bermula.")}</span></div>`);
  if (t.receiver) out.push(`<div class="banner down"><b>Receivership.</b><span>${L("Your park went bankrupt twice. You can no longer act, and only half of your impact counts.", "Park anda bankrap dua kali. Anda tidak boleh bertindak lagi, dan hanya separuh impact dikira.")}</span></div>`);
  if (ck.hold && ck.hold.kind === "checkpoint") {
    const r = tm.now;
    if (ck.hold.phase === 1) out.push(`<div class="banner phase"><b>${L("Checkpoint · end of Phase 1.", "Checkpoint · tamat Fasa 1.")}</b><span>${L(`The Development Fund has closed. You used ${n1(t.snap.fundUsed || 0)} of ${t.fund0} Cr; committed income grew by ${sg1((t.snap.ci24 || 0) - t.snap.ci0)} Cr a year.`, `Development Fund sudah ditutup. Anda menggunakan ${n1(t.snap.fundUsed || 0)} daripada ${t.fund0} Cr; committed income bertambah ${sg1((t.snap.ci24 || 0) - t.snap.ci0)} Cr setahun.`)} <b>B1 = ${n1(r.B1)} / ${lv.score.B1}.</b> ${lv.key === "rintis" ? L("Year 3: run the park. Fill your units and keep income above costs.", "Tahun 3: operasikan park. Penuhkan unit dan kekalkan pendapatan melebihi kos.") : L("Zone H opens now.", "Zon H dibuka sekarang.")}</span></div>`);
    else out.push(`<div class="banner phase"><b>${L("Checkpoint · end of Phase 2.", "Checkpoint · tamat Fasa 2.")}</b><span>${L("Zone H plots signed", "Plot Zon H ditandatangani")}: ${(t.snap.hplots || t.hplots).filter(p => p && p !== "reclaimed").length} ${L("of", "daripada")} 4. <b>B2 = ${n1(r.B2)} / ${lv.score.B2}.</b> ${lv.downturn && lv.downturn.forecast ? L("Watch for the economists' forecast.", "Perhatikan ramalan pakar ekonomi.") : L("Phase 3 begins: a downturn will start in an unannounced month between January and June of Year 4.", "Fasa 3 bermula: downturn akan bermula pada bulan yang tidak diumumkan antara Januari dan Jun Tahun 4.")}</span></div>`);
  }
  if (ck.hold && ck.hold.kind === "forecast") { const k = res.sc.downturn.sev, S = C.SEV[k]; out.push(`<div class="banner down"><b>${L(`Forecast: a ${S.label.toLowerCase()} downturn from ${mname(res.sc.downturn.start)}.`, `Ramalan: downturn ${sevL(k)} bermula ${mnameL(res.sc.downturn.start)}.`)}</b><span>${L(`You have six months to prepare: rates rise to ${pc(S.rate)}, the loan limit falls to ${S.cap} Cr and unlinked rents fall ${pc(S.cut)}.`, `Anda ada enam bulan untuk bersedia: kadar faedah naik ke ${pc(S.rate)}, had pinjaman turun ke ${S.cap} Cr dan sewa penyewa unlinked jatuh ${pc(S.cut)}.`)}</span></div>`); }
  if (ck.hold && ck.hold.kind === "downturn") { const k = res.sc.downturn.sev, S = C.SEV[k]; out.push(`<div class="banner down"><b>${L(`Downturn: ${S.label}.`, `Downturn: ${sevL(k)}.`)}</b><span>${L(`Loan rate ${pc(S.rate)}, loan limit ${S.cap} Cr, unlinked rents −${pc(S.cut)} (linked −${pc(S.cut / 2)}), fewer applicants. Tenants close now and again in 12 months.`, `Kadar pinjaman ${pc(S.rate)}, had pinjaman ${S.cap} Cr, sewa unlinked −${pc(S.cut)} (linked −${pc(S.cut / 2)}), pemohon berkurang. Penyewa tutup sekarang dan sekali lagi dalam 12 bulan.`)}</span></div>`); }
  if (g.status === "paused" && !ck.hold && !g.lastReveal && store().mode === "live") out.push(`<div class="banner info"><b>${L("Clock paused", "Jam berjeda")}</b><span class="muted">${L("by the Game Master. You can still place orders.", "oleh Game Master. Anda masih boleh membuat arahan.")}</span></div>`);
  if (!ck.hold && g.status !== "setup" && g.status !== "ended") {
    if (m <= t.fundEnd && t.fund > 0 && m >= 13 && !lv.coach) out.push(`<div class="banner info"><span class="chip warn">Fund</span><span>${L(`${n1(t.fund)} Cr of the Development Fund left. It lapses on 31 Dec Year 2 (${t.fundEnd - m + 1} months).`, `Baki Development Fund ${n1(t.fund)} Cr. Ia luput pada 31 Dis Tahun 2 (${t.fundEnd - m + 1} bulan lagi).`)}</span></div>`);
    if (!t.zones.H.locked && m >= 25 && m <= 36 && t.hplots.includes(null)) { const n = t.hplots.filter(q => q === null).length; out.push(`<div class="banner info"><span class="chip warn">${L("Zone H", "Zon H")}</span><span>${L(`${n} plot(s) unsigned. Sign a use by 31 Dec Year 3 (${36 - m + 1} months) or they are reclaimed.`, `${n} plot belum ditandatangani. Tandatangani penggunaannya sebelum 31 Dis Tahun 3 (${36 - m + 1} bulan lagi) atau ia diambil semula.`)}</span></div>`); }
  }
  out.push(coachHTML(res, tm));
  if (res.final && !g.reveal) out.push(`<div class="banner phase"><b>${L("Final bell.", "Loceng akhir.")}</b><span>${lv.score.D > 0 ? L("Your results appear here after the defence round.", "Keputusan anda dipaparkan di sini selepas pusingan defence.") : L("Your results appear here when the Game Master reveals the medals.", "Keputusan anda dipaparkan di sini apabila Game Master mendedahkan pingat.")}</span></div>`);
  return out.join("");
}
function zonePanel(res, tm) {
  const t = tm.t, m = res.mCur, sc = res.sc, z = APP.ui.zone, Z = C.ZONES[z], S = t.zones[z];
  const acres = L(" acres", " ekar"), mo = L(" months", " bulan");
  if (S.locked) { const LL = lvl(LOCKED_IN[z]); return `<div class="zp-head"><h2>${z} · ${esc(Z.name)}</h2><span class="chip">${Z.acres}${acres}</span></div><p class="muted" style="margin:0">${esc(ztext(z))}</p><div class="note">${L(`This zone is not part of ${esc(lvLabel(sc.level))}. It opens in Level ${LL.n} · ${esc(LL.name)}.`, `Zon ini bukan sebahagian daripada ${esc(lvLabel(sc.level))}. Ia dibuka dalam Level ${LL.n} · ${esc(LL.name)}.`)}</div>`; }
  const act = canAct(res);
  const btn = (o, title, lines, extraWarn) => {
    const v = PB.validate(t, sc, o, m); const why = !act.ok ? act.why : (!v.ok ? whyL(v.why) : "");
    return `<button class="act${extraWarn ? " warnact" : ""}" data-act="order" data-o="${esc(JSON.stringify(o))}"${why ? " disabled" : ""}><b>${esc(title)}</b>${lines.map(l => `<span class="c">${esc(l)}</span>`).join("")}${why ? `<span class="why">${esc(why)}</span>` : (extraWarn ? `<span class="why">${esc(extraWarn)}</span>` : "")}</button>`;
  };
  const split = cost => { const s = PB.capitalSplit(t, cost, m, true); return s.fund > 0 ? (s.cash > 0.001 ? L(`Fund pays ${n1(s.fund)} · cash ${n1(s.cash)}`, `Fund bayar ${n1(s.fund)} · tunai ${n1(s.cash)}`) : L(`The fund pays it all`, `Fund membayar semuanya`)) : L(`All from cash`, `Semua daripada tunai`); };
  let h = `<div class="zp-head"><h2>${z} · ${esc(Z.name)}</h2><span class="chip">${Z.acres}${acres}</span>${Z.plots ? `<span class="chip">${Z.plots} plot${L(Z.plots > 1 ? "s" : "", "")}</span>` : ""}${S.protected && (z === "E" || z === "G") ? `<span class="chip good">${L("Flood-protected", "Dilindungi daripada banjir")}</span>` : ""}${S.mode === "buffer" ? `<span class="chip good">Green buffer</span>` : ""}${S.mode === "park" ? `<span class="chip good">Retention park</span>` : ""}</div>
<p class="muted" style="margin:0">${esc(ztext(z))}</p>`;
  h += `<div class="svcrow">` + ["road", "water", "power", "fibre"].map(k => {
    const st = svcState(t, z, k); const w = S.works.find(x => x.kind === k || (k === "road" && x.kind === "roadHalf") || (k === "power" && x.kind === "powerShared"));
    const lab = st === "on" ? L("in place", "tersedia") : (st === "work" ? L("ready end of ", "siap hujung ") + mnameL(w.doneAt) : (st === "half" ? L("half built", "separuh siap") : L("missing", "tiada")));
    return `<span class="chip ${st === "on" ? "acc" : (st === "work" ? "amb" : (st === "half" ? "warn" : ""))}">${SVCN[k]}: ${lab}</span>`;
  }).join("") + `</div>`;
  for (const w of S.works) if (w.kind === "clear" || w.kind === "retention") h += `<div class="note warn">${esc(workL(w.kind))} ${L("under way: ready end of", "sedang berjalan: siap hujung")} ${mnameL(w.doneAt)}.</div>`;
  if (z === "H" && m < Z.release) h += `<div class="note">${L("Locked until 1 January Year 3 (the Land Grant).", "Dikunci sehingga 1 Januari Tahun 3 (Land Grant).")}</div>`;
  const bl = t.buildings.filter(b => b.zone === z || (z === "A" && b.zone === "X"));
  if (bl.length) {
    h += `<div class="scroll-x"><table class="tbl bld"><thead><tr><th>${L("Building", "Bangunan")}</th><th>Status</th><th class="r">${L("Units let", "Unit disewa")}</th><th class="r">${L("Upkeep/yr", "Upkeep/thn")}</th><th></th></tr></thead><tbody>`;
    for (const b of bl) {
      const used = PB.usedUnits(t, b);
      const status = b.status === "ready" ? L("Ready", "Siap") : (b.status === "building" ? L("Ready end of ", "Siap hujung ") + mnameL(b.readyAt) : (b.status === "moth" ? L("Mothballed", "Di-mothball") : L("Old shed", "Shed lama")));
      let a = "";
      if (b.status === "ready" && used === 0) a += btn({ type: "moth", bid: b.id }, "Mothball", [L("1 AP · stops upkeep", "1 AP · upkeep berhenti")]);
      if (b.status === "moth") a += btn({ type: "unmoth", bid: b.id }, L("Reopen", "Buka semula"), ["1 Cr · 1 AP"]);
      if ((b.kind === "newbuild" || b.kind === "modular") && b.status !== "building" && !b.leaseBack) a += btn({ type: "leaseback", bid: b.id }, L("Sell and lease back", "Jual dan sewa semula"), [(b.kind === "newbuild" ? L("+5 Cr now, 0.7 Cr/yr lease", "+5 Cr sekarang, sewa 0.7 Cr/thn") : L("+3 Cr now, 0.4 Cr/yr lease", "+3 Cr sekarang, sewa 0.4 Cr/thn")) + " · 1 AP"]);
      h += `<tr><td><b>${esc(b.id)}</b> <span class="muted">${esc(KSHORT[b.kind] || b.kind)}${b.zone === "X" ? L(" (off-site)", " (luar tapak)") : ""}</span>${b.spec ? ` <span class="chip warn">${L("speculative", "spekulatif")}</span>` : ""}${b.leaseBack ? ` <span class="chip">${L("leased back", "disewa semula")}</span>` : ""}</td><td>${status}</td><td class="r mono">${b.status === "shed" ? "—" : used + "/" + b.units}</td><td class="r mono">${b.status === "ready" ? n1(b.upkeep + (b.leaseBack || 0)) : (b.leaseBack ? n1(b.leaseBack) : "—")}</td><td>${a ? `<div class="acts" style="grid-template-columns:1fr">${a}</div>` : ""}</td></tr>`;
    }
    h += `</tbody></table></div>`;
  }
  const acts = [];
  for (const k of PB.worksOptions(t, z, m)) {
    const W = C.WORKS[k];
    const extra = k === "clear" ? L(` (+${W.delay} if the approval is late: 1 in 3)`, ` (+${W.delay} jika kelulusan lewat: 1 dalam 3)`) : "";
    acts.push(btn({ type: "work", zone: z, kind: k }, workL(k), [`${n1(W.cost)} Cr · ${W.months}${mo}${extra} · 1 AP`, split(W.cost)]));
  }
  if (z === "B") for (const b of t.buildings.filter(b => b.zone === "B" && b.status === "shed")) acts.push(btn({ type: "build", kind: "retrofit", bid: b.id }, "Retrofit " + b.id, [`3 Cr · 6${mo} · 3 unit${L("s", "")} · 1 AP`, split(3)]));
  if (Z.plots && z !== "A" && z !== "B" && !(z === "H" && m < Z.release) && S.mode !== "forest" && S.mode !== "wet" && S.mode !== "buffer" && S.mode !== "park") {
    const gate = PB.gateMet(t);
    for (const k of ["modular", "newbuild"]) {
      const B = C.BUILD[k];
      acts.push(btn({ type: "build", zone: z, kind: k }, B.label, [`${B.cost} Cr · ${B.months}${mo} · ${B.units} unit${L("s", "")} · upkeep ${n1(B.upkeep)}/${L("yr", "thn")} · 1 AP`, split(B.cost)],
        gate ? "" : L(`Speculative: occupancy ${pc(PB.occupancy(t))} is below 80% and you have no anchor. Half the time it costs +2 Cr and 3 months more.`, `Spekulatif: penghunian ${pc(PB.occupancy(t))} bawah 80% dan anda tiada anchor. Dalam separuh kes, kosnya +2 Cr dan 3 bulan lebih lama.`)));
    }
  }
  if (z === "F" && S.mode === "forest") acts.push(btn({ type: "declare", zone: "F" }, L("Declare a green buffer", "Isytiharkan green buffer"), [L("Free · no AP · +1 impact a year · ESG +2 · no building here", "Percuma · tiada AP · +1 impact setahun · ESG +2 · tiada pembinaan di sini")]));
  if (z === "G" && S.mode === "open" && S.protected && S.plotsUsed === 0) acts.push(btn({ type: "declare", zone: "G" }, L("Make a retention park", "Jadikan retention park"), [L("Free · no AP · +1 impact a year · ESG +2 · no building here", "Percuma · tiada AP · +1 impact setahun · ESG +2 · tiada pembinaan di sini")]));
  if (z === "H" && m >= Z.release && m <= Z.signBy && t.hplots.includes(null)) acts.push(btn({ type: "reserve" }, L("Reserve a plot for a named user", "Rizabkan plot untuk pengguna yang dinamakan"), [L("Free · no AP · counts as a signed use for B2", "Percuma · tiada AP · dikira sebagai penggunaan yang ditandatangani untuk B2")]));
  if (acts.length) h += `<div class="label">${L("Actions in this zone", "Tindakan di zon ini")}</div><div class="acts">${acts.join("")}</div>`;
  else if (!bl.length) h += `<div class="note">${L("Nothing to order here right now.", "Tiada apa-apa untuk diarahkan di sini buat masa ini.")}</div>`;
  return h;
}
function tabsTeam(res, tm) {
  const t = tm.t; const n = t.applicants.length;
  const tabs = [["apps", L("Applicants", "Pemohon") + (n ? `<span class="badge">${n}</span>` : "")], ["park", "Park"], ["impact", "Impact"], ["money", L("Money", "Kewangan")], ["fac", L("Facilities", "Kemudahan")], ["stand", L("Standings", "Kedudukan")], ["news", L("News", "Berita")], ["rules", L("Rules", "Peraturan")]];
  return tabs.map(([k, l]) => `<button class="${APP.ui.tab === k ? "on" : ""}" data-act="tab" data-k="${k}">${l}</button>`).join("");
}
function tabBody(res, tm) {
  switch (APP.ui.tab) {
    case "apps": return tabApps(res, tm);
    case "impact": return tabImpact(res, tm);
    case "money": return tabMoney(res, tm);
    case "fac": return tabFac(res, tm);
    case "stand": return tabStand(res, tm);
    case "news": return tabNews(res, tm);
    case "rules": return RULES_HTML(res.sc);
    default: return tabPark(res, tm);
  }
}
function tabApps(res, tm) {
  const t = tm.t, m = res.mCur, sc = res.sc, act = canAct(res), yr = L("yr", "thn");
  let h = `<div class="label">${L("Applying now", "Memohon sekarang")}</div>`;
  if (!t.applicants.length) h += `<div class="note">${L("No applicants this month. New ones arrive most months; an Industry Liaison Office and an anchor tenant each bring one more every quarter.", "Tiada pemohon bulan ini. Pemohon baharu datang hampir setiap bulan; Industry Liaison Office dan penyewa anchor masing-masing membawa seorang lagi setiap suku tahun.")}</div>`;
  else {
    h += `<div class="applist">`;
    for (const a of t.applicants) {
      const T = a.type === "startup" ? null : C.TEN[a.type];
      const v = PB.validate(t, sc, { type: "admit", aid: a.id }, m); const why = !act.ok ? act.why : (!v.ok ? whyL(v.why) : "");
      const meta = a.type === "startup" ? [L(`incubator place`, `tempat dalam incubator`), L(`pays 0.1 Cr/yr`, `membayar 0.1 Cr/thn`), `+1 impact/${yr}`, L(`may graduate into a Tech SME (+3 impact)`, `mungkin bergraduat menjadi Tech SME (+3 impact)`)]
        : [`${T.units} unit${L(T.units > 1 ? "s" : "", "")}`, L(`rent ${n1(T.rent)} Cr/yr`, `sewa ${n1(T.rent)} Cr/thn`) + (a.type === "backoffice" ? L(" (1.3 in Zone D)", " (1.3 di Zon D)") : ""), `+${n1(T.ip)} impact/${yr}`, T.linked ? "linked" : "unlinked", T.tech ? L("needs fibre", "perlukan fibre") : L("no fibre needed", "tidak perlukan fibre"), a.type === "anchor" ? L("needs Lab or Lab Access", "perlukan Lab atau Lab Access") : ""].filter(Boolean);
      h += `<div class="appl"><div><b>${esc(a.name)}</b> <span class="chip ${a.type === "backoffice" ? "warn" : "acc"}">${esc(TYPE_LABEL(a.type))}</span><div class="meta">${meta.map(x => `<span>${esc(x)}</span>`).join("")}<span>${L("waits until end of ", "menunggu hingga hujung ")}${mnameL(a.expire)}</span></div></div>
<button class="btn ${why ? "" : "primary"}" data-act="order" data-o="${esc(JSON.stringify({ type: "admit", aid: a.id }))}"${why ? " disabled" : ""}>${L("Admit", "Terima")}</button>${why ? `<div class="why">${esc(why)}</div>` : ""}</div>`;
    }
    h += `</div>`;
  }
  if (t.pendingAnchor) h += `<div class="note good">${L(`An R&D anchor has agreed to take 3 units when a ready unit block with fibre is free (until end of ${mnameL(t.pendingAnchor.until)}).`, `Sebuah R&D anchor bersetuju mengambil 3 unit apabila ada blok unit siap dengan fibre yang kosong (sehingga hujung ${mnameL(t.pendingAnchor.until)}).`)}</div>`;
  h += `<div class="note">${L("Admission policy", "Polisi kemasukan")}: <b>${esc(t.policy)}</b>. ${t.policy === "priority" ? L("Unlinked tenants are admitted only while they fill 50% of let units or less.", "Penyewa unlinked diterima hanya selagi mereka mengisi 50% atau kurang daripada unit yang disewa.") : (t.policy === "linked" ? L("Only linked tenants are admitted.", "Hanya penyewa linked diterima.") : L("Anyone is admitted.", "Semua pemohon diterima."))} ${L("Change it in Money.", "Tukar dalam Kewangan.")}</div>`;
  const groups = {};
  for (const x of t.tenants) { const g = groups[x.type] = groups[x.type] || { n: 0, units: 0, rent: 0, ip: 0 }; g.n++; g.units += C.TEN[x.type].units; g.rent += C.TEN[x.type].rent; g.ip += C.TEN[x.type].ip; }
  h += `<div class="label">${L("Tenants now", "Penyewa sekarang")}</div><div class="scroll-x"><table class="tbl"><thead><tr><th>${L("Type", "Jenis")}</th><th class="r">${L("Count", "Bilangan")}</th><th class="r">Unit</th><th class="r">${L("List rent/yr", "Sewa senarai/thn")}</th><th class="r">Impact/${yr}</th></tr></thead><tbody>`;
  for (const k of ["anchor", "bigAnchor", "sme", "spinoff", "agencyL", "agency", "chemC", "chem", "backoffice"]) if (groups[k]) h += `<tr><td>${esc(tenL(k))}${C.TEN[k].linked ? "" : ` <span class="chip warn">unlinked</span>`}</td><td class="r mono">${groups[k].n}</td><td class="r mono">${groups[k].units}</td><td class="r mono">${n1(groups[k].rent)}</td><td class="r mono">${n1(groups[k].ip)}</td></tr>`;
  h += `<tr><td>${L("Startups (incubated)", "Startup (dalam incubator)")}</td><td class="r mono">${t.startups.length}</td><td class="r mono">—</td><td class="r mono">${n1(0.1 * t.startups.length)}</td><td class="r mono">${t.startups.length}</td></tr>`;
  for (const l of t.leases) h += `<tr><td>${esc(l.label)}${l.linked ? "" : ` <span class="chip warn">unlinked</span>`}</td><td class="r mono">1</td><td class="r mono">${l.units}</td><td class="r mono">${n1(l.income)}</td><td class="r mono">${n1(l.ip)}</td></tr>`;
  h += `</tbody></table></div>`;
  return h;
}
function spark(vals, label) {
  const w = 300, h = 64, pad = 4; if (!vals.length) vals = [0];
  const mn = Math.min(0, ...vals), mx = Math.max(0.1, ...vals), sx = i => pad + (w - 2 * pad) * (vals.length === 1 ? 1 : i / (vals.length - 1)), sy = v => h - pad - (h - 2 * pad) * (v - mn) / (mx - mn || 1);
  const pts = vals.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
  const last = vals[vals.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"><line class="zero" x1="${pad}" x2="${w - pad}" y1="${sy(0)}" y2="${sy(0)}"/><polygon class="ar" points="${sx(0)},${sy(0)} ${pts} ${sx(vals.length - 1)},${sy(0)}"/><polyline class="ln" points="${pts}"/><circle class="end" cx="${sx(vals.length - 1)}" cy="${sy(last)}" r="3.5"/></svg>`;
}
/* socio-economic impact of the park: derived from the tenants, shown for the debrief, not scored */
function tabImpact(res, tm) {
  const t = tm.t, m = res.mCur, so = PB.socio(t), sc = res.sc, yr = L("yr", "thn");
  const tile = (lab, v, sub, cls) => `<div class="tile ${cls || ""}"><span class="label">${lab}</span><span class="v">${v}</span>${sub ? `<span class="faint" style="font-size:11.5px">${sub}</span>` : ""}</div>`;
  const bench = res.teams.filter(x => x.bench).map(x => ({ name: x.name, so: PB.socio(x.t) }));
  const best = bench.length ? bench.reduce((a, b) => b.so.jobs > a.so.jobs ? b : a) : null;
  const uniPct = pc(so.uniShare), extPct = pc(1 - so.uniShare);
  const hist = (t.socioLog || []).filter(x => x.m % 12 === 0).slice(); if (res.final) hist.push(Object.assign({ m: res.months }, so));
  const rows = hist.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>${L("End of", "Hujung")}</th><th class="r">${L("Jobs", "Pekerjaan")}</th><th class="r">${L("Interns/yr", "Intern/thn")}</th><th class="r">${L("Firms", "Syarikat")}</th><th class="r">${L("Alumni-founded", "Diasaskan alumni")}</th><th class="r">${L("University share", "Bahagian universiti")}</th><th class="r">${L("Economic impact, Cr/yr", "Impak ekonomi, Cr/thn")}</th></tr></thead><tbody>${hist.map(x => `<tr><td>${yrL(x.m / 12)}</td><td class="r mono">${x.jobs}</td><td class="r mono">${x.interns}</td><td class="r mono">${x.firms}</td><td class="r mono">${x.alumni}</td><td class="r mono">${pc(x.uniShare)}</td><td class="r mono">${n1(x.econ)}</td></tr>`).join("")}</tbody></table></div>` : "";
  return `<div class="tiles">
${tile(L("Jobs in the park", "Pekerjaan dalam park"), so.jobs, L(`${PB.SOCIO.parkStaff} park staff + tenants and startups`, `${PB.SOCIO.parkStaff} staf park + penyewa dan startup`))}
${tile(L("Student interns / yr", "Pelajar intern / thn"), so.interns, L("places offered by linked tenants and startups", "tempat yang ditawarkan oleh penyewa linked dan startup"))}
${tile(L("Firms", "Syarikat"), so.firms, L(`${so.graduates} graduated from the incubator`, `${so.graduates} bergraduat daripada incubator`))}
${tile(L("Alumni-founded firms", "Syarikat diasaskan alumni"), so.alumni, L(`${pc(so.firms ? so.alumni / so.firms : 0)} of firms`, `${pc(so.firms ? so.alumni / so.firms : 0)} daripada syarikat`))}
${tile(L("Economic impact, Cr / yr", "Impak ekonomi, Cr / thn"), n1(so.econ), L(`direct output ${n1(so.output)} × local multiplier ${PB.SOCIO.mult}`, `output langsung ${n1(so.output)} × pengganda tempatan ${PB.SOCIO.mult}`))}
${tile(L("University-linked share", "Bahagian berkait universiti"), uniPct, L(`of firms · ${pc(so.uniOutShare)} of output`, `daripada syarikat · ${pc(so.uniOutShare)} daripada output`), so.uniShare >= 0.5 ? "good" : "")}
</div>
<div class="label" style="margin-top:12px">${L("Who the park works for", "Untuk siapa park ini bekerja")}</div>
<div class="sharebar" role="img" aria-label="${L("University-linked", "Berkait universiti")} ${uniPct}, ${L("external", "luar")} ${extPct}"><i class="u" style="width:${uniPct}"></i><i class="x" style="width:${extPct}"></i></div>
<div class="rleg" style="justify-content:flex-start;margin-top:6px"><span><i class="s0"></i>${L("University-linked", "Berkait universiti")} ${uniPct}</span><span><i style="background:var(--rule)"></i>${L("External", "Luar")} ${extPct}</span></div>
<p class="muted" style="font-size:12.5px">${L("University-linked: spin-offs, graduates, alumni-founded firms, R&D anchors with a lab link, covenant leases and startups. External: back-office corporates, agencies, chemicals firms, as-offered leases. These figures are shown for the debrief; they do not count in the marks.", "Berkait universiti: spin-off, graduan, syarikat yang diasaskan alumni, R&D anchor yang berhubung dengan makmal, covenant lease dan startup. Luar: korporat back-office, agensi, firma kimia, lease seperti ditawarkan. Angka ini dipaparkan untuk sesi ulasan; ia tidak dikira dalam markah.")}</p>
${best ? `<div class="faint" style="font-size:12.5px">${L(`For comparison, the benchmark park with most jobs right now is ${esc(best.name)}: ${best.so.jobs} jobs, ${best.so.interns} interns, economic impact ${n1(best.so.econ)} Cr/yr, university-linked ${pc(best.so.uniShare)}.`, `Sebagai perbandingan, park benchmark dengan pekerjaan paling banyak sekarang ialah ${esc(best.name)}: ${best.so.jobs} pekerjaan, ${best.so.interns} intern, impak ekonomi ${n1(best.so.econ)} Cr/thn, berkait universiti ${pc(best.so.uniShare)}.`)}</div>` : ""}
${rows}`;
}
function tabPark(res, tm) {
  const t = tm.t, m = res.mCur, ps = tm.ps, lv = res.lv, W = lv.score, yr = L("yr", "thn");
  const fcr = ps.fcr, dr = ps.drift;
  const tile = (lab, v, cls, sub) => `<div class="tile ${cls || ""}"><span class="label">${lab}</span><span class="v">${v}</span>${sub ? `<span class="faint" style="font-size:11.5px">${sub}</span>` : ""}</div>`;
  let h = `<div class="tiles">
${tile(L("Income/yr", "Pendapatan/thn"), n1(tm.ci), "", L("committed rent + leases", "sewa committed + lease"))}
${tile(L("Upkeep/yr", "Upkeep/thn"), n1(PB.annualUpkeep(t, m)), "", L("buildings, facilities, office", "bangunan, kemudahan, pejabat"))}
${tile("FCR12", fcr > 8 ? "—" : fcr.toFixed(2), fcr >= 1.3 ? "good" : (fcr >= 1 ? "" : "bad"), L("income ÷ (upkeep + interest)", "pendapatan ÷ (upkeep + faedah)"))}
${tile(L("Occupancy", "Penghunian"), pc(tm.occ), tm.occ >= 0.8 ? "good" : (tm.occ < 0.5 ? "warn" : ""), L(PB.occUnits(t) + " of " + PB.readyUnits(t) + " units", PB.occUnits(t) + " daripada " + PB.readyUnits(t) + " unit"))}
${tile(L("Landlord drift", "Drift tuan tanah"), pc(dr), dr > 0.5 ? "bad" : (dr > 0.4 ? "warn" : "good"), L("unlinked share of let units", "bahagian unlinked dalam unit disewa"))}
${tile("Impact", n1(ps.ip), "", n1(t.ipv) + L(" verified · ", " disahkan · ") + n1(t.ipu) + L(" unverified", " belum disahkan"))}
${tile(L("Linked tenants", "Penyewa linked"), PB.linkedCount(t), "", t.startups.length + " startup" + L("s", ""))}
${tile("Bailout", t.bailouts, t.bailouts ? "bad" : "good", t.receiver ? "receivership" : (t.bailouts ? L("one more ends the park", "sekali lagi park akan tamat") : L("none so far", "tiada setakat ini")))}
${W.E > 0 ? tile("ESG", (t.esg >= 0 ? "+" : "") + n1(t.esg), t.esg < 0 ? "bad" : (t.esg >= 3 ? "good" : ""), L("Part E ", "Bahagian E ") + n1(tm.now.E) + " / " + W.E + (lv.esgGate ? L(" · Gold needs ≥ 0", " · Emas perlukan ≥ 0") : "")) : ""}
</div>`;
  h += `<div class="label">${L("Park score now", "Skor park sekarang")}</div><table class="tbl pl"><tbody>
<tr><td>${L("Impact counted (verified + half of unverified)", "Impact dikira (disahkan + separuh yang belum disahkan)")}</td><td>${n1(ps.ip)}</td></tr>
<tr><td>${L("FCR12 bonus", "Bonus FCR12")} (${fcr > 8 ? L("no costs", "tiada kos") : fcr.toFixed(2)})</td><td>${sg1(ps.fcrBonus)}</td></tr>
<tr><td>${L("Landlord drift penalty", "Penalti drift tuan tanah")} (${pc(dr)})</td><td>${sg1(-ps.driftPen)}</td></tr>
<tr><td>${L("Debt penalty (half of debt above cash)", "Penalti hutang (separuh daripada hutang yang melebihi tunai)")}</td><td>${sg1(-ps.debtPen)}</td></tr>
<tr class="tot"><td>${L("Park score · target ", "Skor park · sasaran ")}${W.parkTarget}</td><td>${n1(ps.score)}</td></tr>
<tr><td>${L(`Part A so far (${W.A} × score ÷ ${W.parkTarget}, max ${W.A})`, `Bahagian A setakat ini (${W.A} × skor ÷ ${W.parkTarget}, maks ${W.A})`)}</td><td>${n1(W.A * clamp(ps.score / W.parkTarget, 0, 1))}</td></tr></tbody></table>`;
  if (t.esgLog.length) h += `<div class="label">${L("ESG record", "Rekod ESG")}</div><div class="log">${t.esgLog.slice().reverse().slice(0, 8).map(x => `<div><span class="m">${mnameL(x.m)}</span><span class="${x.d > 0 ? "good" : "bad"}">${x.d > 0 ? "+" : ""}${x.d} · ${esc(esgWhyL(x.why))}</span></div>`).join("")}</div>`;
  const cm = commitments(t, m);
  if (cm.length) h += `<div class="label">${L("Commitments from deals", "Komitmen daripada deal")}</div><ul style="margin:0;padding-left:18px">${cm.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  const cash = t.cashHist.slice(-36), ip = t.ipHist.slice(-60);
  h += `<div><div class="label">${L(`Net cash (cash − loans), last ${cash.length} months`, `Tunai bersih (tunai − pinjaman), ${cash.length} bulan terakhir`)}</div>${spark(cash, L("Net cash history", "Sejarah tunai bersih"))}</div>`;
  h += `<div><div class="label">${L("Impact counted, cumulative", "Impact dikira, kumulatif")}</div>${spark(ip, L("Impact history", "Sejarah impact"))}</div>`;
  const BST = { ready: L("ready", "siap"), moth: L("mothballed", "di-mothball"), shed: L("shed", "shed") };
  h += `<div class="label">${L("Buildings", "Bangunan")}</div><div class="scroll-x"><table class="tbl"><thead><tr><th>Id</th><th>${L("Kind", "Jenis")}</th><th>Status</th><th class="r">${L("Let", "Disewa")}</th></tr></thead><tbody>${t.buildings.map(b => `<tr><td><b>${esc(b.id)}</b></td><td>${esc(KSHORT[b.kind] || b.kind)}</td><td>${b.status === "building" ? L("ready end of ", "siap hujung ") + mnameL(b.readyAt) : esc(BST[b.status] || b.status)}</td><td class="r mono">${b.status === "shed" ? "—" : PB.usedUnits(t, b) + "/" + b.units}</td></tr>`).join("")}</tbody></table></div>`;
  return h;
}
function commitments(t, m) {
  const f = t.flags, o = [];
  if (t.zones.E.protected && t.zones.G.protected && t.zones.G.mode !== "open" && t.zones.G.mode !== "park") o.push(L("Emergency drainage: Zones E and G are flood-protected.", "Saliran kecemasan: Zon E dan G dilindungi daripada banjir."));
  if (f.insured) o.push(L("Flood insurance: 0.3 Cr a year; flood repairs are covered.", "Insurans banjir: 0.3 Cr setahun; kos pembaikan banjir ditanggung."));
  if (f.donor) o.push(L("Donor equipment: 1.2 Cr a year service contract", "Peralatan penderma: kontrak servis 1.2 Cr setahun") + (f.donorFreeUntil >= 48 ? L(" (the donor pays it until the end of Year 4).", " (penderma membayarnya hingga akhir Tahun 4).") : "."));
  if (f.telco) o.push(L("Telco deal: fibre everywhere; 5% of rent goes to the telco.", "Deal telco: fibre di semua zon; 5% sewa kepada telco."));
  if (f.jv === "offered") o.push(L("Joint venture as offered: in Year 4 the partner may leave with its startups.", "Joint venture seperti ditawarkan: pada Tahun 4 rakan kongsi mungkin keluar bersama startup-nya."));
  if (f.jv === "cond") o.push(L("Joint venture with a joint selection panel.", "Joint venture dengan panel pemilihan bersama."));
  if (f.share) o.push(L("Surplus share: " + Math.round(f.share * 100) + "% of every monthly surplus goes to the university.", "Perkongsian lebihan: " + Math.round(f.share * 100) + "% daripada setiap lebihan bulanan kepada universiti."));
  if (f.allocStop) o.push(L("The university allocation has stopped.", "Peruntukan universiti telah dihentikan."));
  if (f.fixedRate) o.push(L("Loan rate fixed at 10%.", "Kadar pinjaman ditetapkan pada 10%."));
  if (f.exclusive) o.push(L("Anchor exclusivity: one linked admission a quarter.", "Hak eksklusif anchor: satu kemasukan linked setiap suku tahun."));
  if (f.stimulus) o.push(L("Startup stimulus: one extra startup applicant a quarter.", "Stimulus startup: satu pemohon startup tambahan setiap suku tahun."));
  if (f.holiday === "free") o.push(L("Anchor rent holiday until the end.", "Cuti sewa anchor hingga tamat."));
  if (f.holiday === "half") o.push(L("Anchors pay half rent until the end.", "Anchor membayar separuh sewa hingga tamat."));
  if (f.solar) o.push(L("Solar canopies: upkeep −" + n1(f.solar) + " Cr a year.", "Kanopi solar: upkeep −" + n1(f.solar) + " Cr setahun."));
  if (f.cert) o.push(L("Green certification: 0.2 Cr a year; one extra linked applicant a quarter while ESG ≥ 3.", "Pensijilan hijau: 0.2 Cr setahun; satu pemohon linked tambahan setiap suku tahun selagi ESG ≥ 3."));
  if (f.rain) o.push(L("Rainwater storage: immune to drought surcharges.", "Simpanan air hujan: kebal terhadap surcaj kemarau."));
  if (f.droughtUntil && f.droughtUntil >= m) o.push(L("Water surcharge +0.4 Cr a year until ", "Surcaj air +0.4 Cr setahun sehingga ") + mnameL(f.droughtUntil) + ".");
  for (const l of t.leases) if (l.zone && !PB.leaseActive(t, l)) o.push(l.label + L(": income starts once Zone " + l.zone + " has road and power.", ": pendapatan bermula apabila Zon " + l.zone + " ada road dan power."));
  if (f.renegUntil && f.renegUntil >= m) o.push(L("Back-office rents at 70% until the end of ", "Sewa back-office pada 70% hingga hujung ") + mnameL(f.renegUntil) + ".");
  return o;
}
function stepper(key, val) {
  return `<span class="stepper"><button data-act="step" data-k="${key}" data-d="-1" aria-label="${L("Less", "Kurang")}">−</button><span>${val}</span><button data-act="step" data-k="${key}" data-d="1" aria-label="${L("More", "Lebih")}">+</button></span>`;
}
function tabMoney(res, tm) {
  const t = tm.t, sc = res.sc, m = res.mCur, P = tm.P, act = canAct(res);
  const cap = PB.loanCap(t, sc, m), head = PB.headroom(t, sc, m);
  APP.ui.loan = clamp(APP.ui.loan, 1, Math.max(1, Math.floor(head)));
  APP.ui.repay = clamp(APP.ui.repay, 1, Math.max(1, Math.ceil(t.debt + t.emerg)));
  const ob = (o, label, cls) => { const v = PB.validate(t, sc, o, m); const why = !act.ok ? act.why : (!v.ok ? whyL(v.why) : ""); return `<button class="btn ${cls || ""}" data-act="order" data-o="${esc(JSON.stringify(o))}"${why ? ` disabled title="${esc(why)}"` : ""}>${label}</button>`; };
  const dn = PB.inDownturn(sc, m);
  let h = `<div class="label">${L("This month, at annual rates (Cr)", "Bulan ini, pada kadar tahunan (Cr)")}</div><table class="tbl pl"><tbody>
<tr><td>${L("Rent", "Sewa")}</td><td>${n1(P.rent + P.telco)}</td></tr>${P.telco ? `<tr><td>${L("Telco share (5%)", "Bahagian telco (5%)")}</td><td>${sg1(-P.telco)}</td></tr>` : ""}
<tr><td>Ground lease</td><td>${n1(P.lease)}</td></tr><tr><td>${L("Facility and startup income", "Pendapatan kemudahan dan startup")}</td><td>${n1(P.facInc)}</td></tr>
<tr><td>${L("University allocation", "Peruntukan universiti")}</td><td>${n1(P.alloc)}</td></tr><tr><td>Upkeep</td><td>${sg1(-P.upkeep)}</td></tr><tr><td>${L("Interest", "Faedah")}</td><td>${sg1(-P.interest)}</td></tr>
${P.share ? `<tr><td>${L("Surplus share to the university", "Bahagian lebihan kepada universiti")}</td><td>${sg1(-P.share)}</td></tr>` : ""}
<tr class="tot"><td>${L("Net this month", "Bersih bulan ini")}</td><td>${sg1(P.net)}</td></tr></tbody></table>`;
  const rate = PB.rateOf(t, sc, m);
  h += `<div class="label">${L("Loans", "Pinjaman")}</div><div class="note">${L(`Bank loans ${n1(t.debt)} Cr at ${pc(rate)}${t.flags.fixedRate ? " (fixed)" : ""} · emergency ${n1(t.emerg)} Cr at ${pc(dn ? C.EMERG_P3 : C.EMERG)} · limit ${cap} Cr${dn ? " during the downturn" : ""}. If cash falls below zero you get an emergency loan if the limit allows; otherwise the university bails you out (−5 impact, one action point fewer). A second bailout is receivership.`,
    `Pinjaman bank ${n1(t.debt)} Cr pada ${pc(rate)}${t.flags.fixedRate ? " (tetap)" : ""} · kecemasan ${n1(t.emerg)} Cr pada ${pc(dn ? C.EMERG_P3 : C.EMERG)} · had ${cap} Cr${dn ? " semasa downturn" : ""}. Jika tunai jatuh bawah sifar, anda mendapat pinjaman kecemasan jika had membenarkan; jika tidak, universiti akan menyelamatkan anda (−5 impact, kurang satu action point). Bailout kali kedua bermakna receivership.`)}</div>
<div class="row">${stepper("loan", APP.ui.loan)} ${ob({ type: "loan", amount: APP.ui.loan }, L("Borrow ", "Pinjam ") + APP.ui.loan + " Cr", "primary")} <span class="muted">headroom ${n1(head)} Cr · ${L("no AP", "tiada AP")}</span></div>
<div class="row">${stepper("repay", APP.ui.repay)} ${ob({ type: "repay", amount: APP.ui.repay }, L("Repay ", "Bayar balik ") + APP.ui.repay + " Cr")} <span class="muted">${L("emergency loans are repaid first", "pinjaman kecemasan dibayar dahulu")}</span></div>`;
  const lv = t.prog || 0;
  h += `<div class="label">Innovation programmes</div><div class="note">${L(`Challenges, grants and events for your tenants: each 1 Cr a year adds +${C.PROG.ipPerCr} impact a year. Changing the level costs 1 AP.`, `Cabaran, geran dan acara untuk penyewa anda: setiap 1 Cr setahun menambah +${C.PROG.ipPerCr} impact setahun. Menukar tahap memerlukan 1 AP.`)}</div><div class="levels">`;
  for (let i = 0; i <= C.PROG.max; i++) { const o = { type: "programme", level: i }; const v = PB.validate(t, sc, o, m); const dis = i !== lv && (!act.ok || !v.ok); h += `<button class="${i === lv ? "on" : ""}" data-act="order" data-o="${esc(JSON.stringify(o))}"${dis || i === lv ? " disabled" : ""}>${i}</button>`; }
  h += `</div>`;
  h += `<div class="label">${L("Admission policy", "Polisi kemasukan")}</div><div class="row">`;
  for (const [k, l] of [["open", L("Open: anyone", "Open: semua")], ["priority", L("Priority: unlinked ≤ 50%", "Priority: unlinked ≤ 50%")], ["linked", L("Linked only", "Linked sahaja")]]) h += t.policy === k ? `<span class="chip acc">${l}</span>` : ob({ type: "policy", policy: k }, l, "sm");
  h += `</div><div class="faint" style="font-size:12px">${L("Changing policy costs 1 AP and −2 impact.", "Menukar polisi memerlukan 1 AP dan −2 impact.")}</div>`;
  if (dn) h += `<div class="label">${L("Downturn tools", "Alat semasa downturn")}</div><div class="row">${ob({ type: "reneg" }, L("Renegotiate back-office rents (70% for 12 months)", "Runding semula sewa back-office (70% selama 12 bulan)"))}</div><div class="faint" style="font-size:12px">${L("Halves back-office closures and exits while it runs. 1 AP. Mothball empty buildings or sell and lease back in the zone panel.", "Mengurangkan separuh penutupan dan keluarnya penyewa back-office selagi berkuat kuasa. 1 AP. Mothball bangunan kosong atau jual dan sewa semula di panel zon.")}</div>`;
  return h;
}
function tabFac(res, tm) {
  const t = tm.t, sc = res.sc, m = res.mCur, act = canAct(res);
  let h = `<div class="facs">`;
  for (const k of ["kpi", "incubator", "labaccess", "lab", "liaison", "covenant", "services", "mgmt"]) {
    const F = C.FAC[k], on = !!t.fac[k];
    const o = on ? { type: "cancel", kind: k } : { type: "facility", kind: k };
    const v = PB.validate(t, sc, o, m); const why = !act.ok ? act.why : (!v.ok ? whyL(v.why) : "");
    const s = PB.capitalSplit(t, F.cost, m, true);
    h += `<div class="fac${on ? " on" : ""}"><div class="top"><b>${esc(F.label)}</b>${on ? `<span class="chip acc">${L("running since ", "berjalan sejak ")}${mnameL(t.fac[k].since)}</span>` : ""}</div>
<div class="mono" style="font-size:12px;color:var(--ink-2)">${F.cost ? n1(F.cost) + " Cr" + (s.fund > 0 ? ` (fund ${n1(s.fund)} · ${L("cash", "tunai")} ${n1(s.cash)})` : "") : L("No set-up cost", "Tiada kos permulaan")} · upkeep ${n1(F.upkeep)}/${L("yr", "thn")}${F.units ? L(` · uses ${F.units} unit with fibre`, ` · menggunakan ${F.units} unit dengan fibre`) : ""}</div>
<div class="muted" style="font-size:12.5px">${esc((HOST.lang === "ms" ? FACTXT_MS : FACTXT)[k])}</div>
<div class="row"><button class="btn sm ${on ? "danger" : "primary"}" data-act="order" data-o="${esc(JSON.stringify(o))}"${why ? " disabled" : ""}>${on ? L("Close (no AP)", "Tutup (tiada AP)") : L("Launch · 1 AP", "Lancarkan · 1 AP")}</button>${why ? `<span class="faint" style="font-size:12px">${esc(why)}</span>` : ""}</div></div>`;
  }
  return h + `</div>`;
}
function tabNews(res, tm) {
  const LG = tm.t.log.slice().reverse();
  if (!LG.length) return `<div class="note">${L("Nothing yet. News about works, tenants and deals appears here.", "Belum ada apa-apa. Berita tentang kerja, penyewa dan deal dipaparkan di sini.")}</div>`;
  return `<div class="log">${LG.map(l => `<div><span class="m">${mnameL(l.m)}</span><span class="${esc(l.kind)}">${esc(noteL(l.text))}</span></div>`).join("")}</div>`;
}
function sortedTeams(res) { return res.teams.slice().sort((a, b) => (a.t.receiver - b.t.receiver) || (b.ps.score - a.ps.score)); }
function tabStand(res, tm) {
  const rows = sortedTeams(res), E = res.lv.score.E > 0;
  return `<div class="scroll-x"><table class="tbl"><thead><tr><th>#</th><th>Park</th><th class="r">${L("Score", "Skor")}</th><th class="r">Impact</th>${E ? `<th class="r">ESG</th>` : ""}<th class="r">${L("Income", "Pendapatan")}</th><th class="r">${L("Occ.", "Penghunian")}</th></tr></thead><tbody>${rows.map((x, i) => `<tr${x.id === tm.id ? ` style="background:var(--accent-soft)"` : ""}><td class="mono">${i + 1}</td><td><b>${esc(x.name)}</b>${x.bench ? ` <span class="chip">benchmark</span>` : ""}${x.t.receiver ? ` <span class="chip bad">receivership</span>` : (x.t.bailouts ? ` <span class="chip warn">bailout</span>` : "")}</td><td class="r mono">${n0(x.ps.score)}</td><td class="r mono">${n0(x.ps.ip)}</td>${E ? `<td class="r mono">${x.t.esg >= 0 ? "+" : ""}${n1(x.t.esg)}</td>` : ""}<td class="r mono">${n1(x.ci)}</td><td class="r mono">${pc(x.occ)}</td></tr>`).join("")}</tbody></table></div>
<div class="faint" style="font-size:12px">${L("Benchmarks are scripted parks playing the same site and deals: Garden grows in phases, Bold takes calculated risks, Purist is mission-first, Rocket grows fast on debt, Tower builds for corporates, Caretaker spends the minimum, Reckless does everything at once.", "Benchmark ialah park berskrip yang bermain di tapak dan deal yang sama: Garden berkembang secara berperingkat, Bold mengambil risiko yang dikira, Purist mengutamakan misi, Rocket berkembang pantas dengan hutang, Tower membina untuk korporat, Caretaker berbelanja minimum, Reckless melakukan semuanya serentak.")}</div>`;
}
const RULES_CACHE = {};
function RULES_HTML(sc) {
  const lv = sc.lv, ck = lv.key + "|" + (HOST.lang || "en"); if (RULES_CACHE[ck]) return RULES_CACHE[ck];
  const ms = HOST.lang === "ms";
  const W = C.WORKS, B = C.BUILD, T = C.TEN, S = lv.score, M = lv.medals, Y = Math.round(sc.months / 12);
  const zones = lv.zones.map(z => z + " " + ZSHORT[z]).join(", ");
  const phases = lv.key === "rintis"
    ? L(`<li><b>Phase 1 · Build</b> (Years 1–2): the fund pays every capital cost. Checkpoint B1 at the end of Year 2.</li><li><b>Phase 2 · Operate</b> (Year 3): no fund, no downturn. Fill your units and keep income above costs.</li>`,
      `<li><b>Fasa 1 · Bina</b> (Tahun 1–2): Development Fund membayar semua kos modal. Checkpoint B1 pada akhir Tahun 2.</li><li><b>Fasa 2 · Operasi</b> (Tahun 3): tiada fund, tiada downturn. Penuhkan unit anda dan kekalkan pendapatan melebihi kos.</li>`)
    : L(`<li><b>Phase 1 · Build</b> (Years 1–2): spend the fund well. Checkpoint B1 at the end of Year 2.</li><li><b>Phase 2 · Expand</b> (Year 3): Zone H is released; sign a use for every plot by 31 December Year 3. Checkpoint B2.</li><li><b>Phase 3 · Survive</b> (Year${Y > 4 ? "s 4–5" : " 4"}): ${lv.downturn && lv.downturn.forecast ? "economists announce a downturn six months before it starts" : "a downturn starts in a secret month between January and June of Year 4"} and it lasts to the end.</li>`,
      `<li><b>Fasa 1 · Bina</b> (Tahun 1–2): belanjakan Development Fund dengan bijak. Checkpoint B1 pada akhir Tahun 2.</li><li><b>Fasa 2 · Kembang</b> (Tahun 3): Zon H dilepaskan; tandatangani penggunaan setiap plot sebelum 31 Disember Tahun 3. Checkpoint B2.</li><li><b>Fasa 3 · Bertahan</b> (Tahun ${Y > 4 ? "4–5" : "4"}): ${lv.downturn && lv.downturn.forecast ? "pakar ekonomi mengumumkan downturn enam bulan sebelum ia bermula" : "downturn bermula pada bulan rahsia antara Januari dan Jun Tahun 4"} dan berterusan hingga tamat.</li>`);
  const scoreRows = ms ? {
    A: `Skor park (impact + bonus FCR12 − penalti drift dan hutang), dinilai berbanding target tetap ${S.parkTarget}`,
    B1: `Fasa 1: Development Fund yang digunakan (40%) dan committed income yang ditambah hingga akhir Tahun 2, markah penuh pada +${S.fundIncomeTarget} Cr/thn (60%)`,
    B2: `Fasa 2: plot Zon H dengan penggunaan yang ditandatangani (suku markah setiap satu; lease seperti ditawarkan dikira 60% daripadanya)`,
    B3: lv.key === "rintis" ? `Operasi: tiada bailout, FCR12 ≥ 1 di akhir, dan occupancy dari 50% hingga 90% (satu pertiga setiap satu)` : `Fasa 3: tiada bailout semasa downturn, FCR12 ≥ 1 di akhir, pengekalan penyewa dari ${pc(C.RET[0])} hingga ${pc(C.RET[1])} (satu pertiga setiap satu)`,
    C: `Kualiti keputusan: bahagian keputusan Deal Room yang wajar; Leave pada peluang yang wajar diambil hanya dapat separuh`,
    D: `Defence: penerangan strategi pasukan anda, dinilai oleh fasilitator`,
    E: `ESG: ${S.E} × (ESG − ${C.ESG.floor}) ÷ ${C.ESG.target - C.ESG.floor}, dihadkan; markah penuh pada ESG ${C.ESG.target}`,
  } : {
    A: `Park score (impact + FCR12 bonus − drift and debt penalties), marked against a fixed target of ${S.parkTarget}`,
    B1: `Phase 1: fund used (40%) and committed income added by the end of Year 2, full marks at +${S.fundIncomeTarget} Cr/yr (60%)`,
    B2: `Phase 2: Zone H plots with a signed use (a quarter each; a lease as offered counts 60% of that)`,
    B3: lv.key === "rintis" ? `Operations: never bailed out, FCR12 ≥ 1 at the end, and occupancy from 50% to 90% (a third each)` : `Phase 3: no bailout in the downturn, FCR12 ≥ 1 at the end, tenant retention from ${pc(C.RET[0])} to ${pc(C.RET[1])} (a third each)`,
    C: `Decision quality: share of sound Deal Room decisions; leaving an opportunity you could soundly take earns half`,
    D: `Defence: your team's explanation of its strategy, marked by the facilitators`,
    E: `ESG: ${S.E} × (ESG − ${C.ESG.floor}) ÷ ${C.ESG.target - C.ESG.floor}, capped; full marks at ESG ${C.ESG.target}`,
  };
  const th = (en, m2) => L(en, m2);
  let h = `<div class="rules"><div class="note"><b>${esc(lvLabel(lv.key))} · ${esc(lvSub(lv))}.</b> ${esc(LEVEL_TEXT[lv.key].blurb)} ${L("Zones in play", "Zon yang dimainkan")}: ${esc(zones)}.</div>
<h3>${L("Time", "Masa")}</h3><ul>${L(`<li>The clock runs from 1 January Year 1 to 31 December Year ${Y}. Money is posted at the end of each month.</li>
<li>${lv.apQ} action points a quarter, reset on 1 January, April, July and October; unused points are lost. Works, buildings, facilities, programmes, policy changes, mothballing and lease-backs use 1 point; admitting tenants, loans and repayments are free.</li>
<li>${sc.events.length} deals arrive. Each pauses the clock in the Deal Room. No decision counts as Leave. ${lv.dice ? "Conditions depend on a die rolled when the deal closes." : "In this level every counterparty accepts your conditions."}</li>`,
`<li>Jam berjalan dari 1 Januari Tahun 1 hingga 31 Disember Tahun ${Y}. Wang direkodkan pada hujung setiap bulan.</li>
<li>${lv.apQ} action point setiap suku tahun, ditetapkan semula pada 1 Januari, April, Julai dan Oktober; point yang tidak digunakan akan hilang. Kerja tanah, bangunan, kemudahan, program, perubahan polisi, mothball dan lease-back menggunakan 1 point; menerima penyewa, pinjaman dan bayaran balik adalah percuma.</li>
<li>${sc.events.length} deal akan tiba. Setiap satu menghentikan jam di Deal Room. Tiada keputusan dikira sebagai Leave. ${lv.dice ? "Conditions bergantung pada dadu yang dibaling apabila deal ditutup." : "Dalam level ini setiap pihak menerima syarat anda."}</li>`)}</ul>
<h3>${L("Money", "Kewangan")}</h3><ul>${L(`<li>Start with ${lv.startCash} Cr cash. The ${lv.fund} Cr Development Fund pays ${pc(lv.fundShare)} of every capital cost (works, buildings, facilities) until 31 December Year 2; what is left then lapses.</li>
<li>The university allocation is 1 Cr a year in Years 1–3 and nothing after.</li>
<li>Bank loans up to ${C.LOAN_CAP} Cr at ${pc(C.RATE)}. When cash falls below zero you get an emergency loan at ${pc(C.EMERG)} if the limit allows; otherwise the university bails you out: −5 impact and one action point fewer next quarter. A second bailout puts the park in receivership.</li>`,
`<li>Mula dengan tunai ${lv.startCash} Cr. Development Fund ${lv.fund} Cr membayar ${pc(lv.fundShare)} daripada setiap kos modal (kerja tanah, bangunan, kemudahan) hingga 31 Disember Tahun 2; baki selepas itu luput.</li>
<li>Peruntukan universiti ialah 1 Cr setahun pada Tahun 1–3 dan tiada selepas itu.</li>
<li>Pinjaman bank hingga ${C.LOAN_CAP} Cr pada ${pc(C.RATE)}. Apabila tunai jatuh bawah sifar, anda mendapat pinjaman kecemasan pada ${pc(C.EMERG)} jika had membenarkan; jika tidak, universiti akan menyelamatkan anda: −5 impact dan kurang satu action point pada suku tahun berikutnya. Bailout kali kedua meletakkan park dalam receivership.</li>`)}</ul>
<h3>${L("Land works", "Kerja tanah")}</h3><table class="tbl"><thead><tr><th>${L("Work", "Kerja")}</th><th class="r">Cr</th><th class="r">${L("Months", "Bulan")}</th></tr></thead><tbody>${Object.keys(W).filter(k => lv.zones.includes("F") || (k !== "clear" && k !== "retention")).map(k => `<tr><td>${esc(workL(k))}</td><td class="r mono">${n1(W[k].cost)}</td><td class="r mono">${W[k].months}</td></tr>`).join("")}</tbody></table>
<p>${L("Tenants move in only where the zone has road, water and power; tech tenants also need fibre. A shared substation applies when a neighbouring zone already has power.", "Penyewa hanya boleh masuk jika zon itu ada road, water dan power; penyewa teknologi juga perlukan fibre. Substation dikongsi terpakai apabila zon jiran sudah ada power.")}</p>
<h3>${L("Buildings", "Bangunan")}</h3><table class="tbl"><thead><tr><th>${L("Building", "Bangunan")}</th><th class="r">Cr</th><th class="r">${L("Months", "Bulan")}</th><th class="r">Unit</th><th class="r">Upkeep/${L("yr", "thn")}</th></tr></thead><tbody>${Object.keys(B).map(k => `<tr><td>${esc(B[k].label)}</td><td class="r mono">${B[k].cost}</td><td class="r mono">${B[k].months}</td><td class="r mono">${B[k].units}</td><td class="r mono">${n1(B[k].upkeep)}</td></tr>`).join("")}</tbody></table>
<p>${L("The demand gate: a Modular or New Build started while occupancy is below 80% and you have no anchor is speculative, and half the time costs 2 Cr and 3 months more. With the gate met, 1 in 6 still runs 3 months late.", "Demand gate: Modular atau New Build yang dimulakan ketika penghunian bawah 80% dan anda tiada anchor dianggap spekulatif, dan dalam separuh kes kosnya 2 Cr dan 3 bulan lebih. Walaupun gate dipenuhi, 1 dalam 6 masih lewat 3 bulan.")}</p>
<h3>${L("Tenants", "Penyewa")}</h3><table class="tbl"><thead><tr><th>${L("Type", "Jenis")}</th><th class="r">Unit</th><th class="r">${L("Rent/yr", "Sewa/thn")}</th><th class="r">Impact/${L("yr", "thn")}</th><th>Linked</th></tr></thead><tbody>${["backoffice", "sme", "spinoff", "anchor", "bigAnchor", "agency", "agencyL"].map(k => `<tr><td>${esc(tenL(k))}</td><td class="r mono">${T[k].units}</td><td class="r mono">${n1(T[k].rent)}</td><td class="r mono">${n1(T[k].ip)}</td><td>${T[k].linked ? L("yes", "ya") : L("no", "tidak")}</td></tr>`).join("")}</tbody></table>
<p>${L(`Linked tenants in Zone C add +1 impact a year each. Back-office tenants pay 30% more in Zone D. Spin-offs leave 1 in 3 a year (1 in 6 with a Lab, an Incubator or a JV). Applicants wait ${C.WAIT} months, then go elsewhere.`, `Setiap penyewa linked di Zon C menambah +1 impact setahun. Penyewa back-office membayar 30% lebih di Zon D. Spin-off keluar 1 dalam 3 setahun (1 dalam 6 jika ada Lab, Incubator atau JV). Pemohon menunggu ${C.WAIT} bulan, kemudian beralih ke tempat lain.`)}</p>
<h3>${L("Phases", "Fasa")}</h3><ul>${phases}</ul>`;
  if (lv.downturn) h += `<h3>Downturn</h3><table class="tbl"><thead><tr><th>${L("Severity", "Tahap")}</th><th class="r">${L("Chance", "Kebarangkalian")}</th><th class="r">${L("Loan rate", "Kadar pinjaman")}</th><th class="r">${L("Loan limit", "Had pinjaman")}</th><th class="r">${L("Unlinked rent cut", "Potongan sewa unlinked")}</th><th class="r">${L("Back-office closing", "Back-office tutup")}</th></tr></thead><tbody>${lv.downturn.sevs.map(([k, w]) => { const s = C.SEV[k]; const tot = lv.downturn.sevs.reduce((a, x) => a + x[1], 0); return `<tr><td>${esc(L(s.label, sevL(k)))}</td><td class="r mono">${w} ${L("in", "dalam")} ${tot}</td><td class="r mono">${pc(s.rate)}</td><td class="r mono">${s.cap}</td><td class="r mono">${pc(s.cut)}</td><td class="r mono">${pc(s.bo)}</td></tr>`; }).join("")}</tbody></table>
<p>${L("Tenants close when the downturn starts and again 12 months later; linked tenants pay half the rent cut. Renegotiated rents halve back-office closures; Shared Services halves Tech SME closures.", "Penyewa menutup operasi apabila downturn bermula dan sekali lagi 12 bulan kemudian; penyewa linked hanya menanggung separuh potongan sewa. Sewa yang dirunding semula mengurangkan separuh penutupan back-office; Shared Services mengurangkan separuh penutupan Tech SME.")}</p>`;
  h += `<h3>${L("Scoring (100 marks)", "Pemarkahan (100 markah)")}</h3><table class="tbl"><tbody>${parts(lv).map(k => `<tr><td><b>${k}</b> ${esc(scoreRows[k])}</td><td class="r mono">${S[k]}</td></tr>`).join("")}</tbody></table>`;
  if (S.E > 0) h += `<h3>${L("ESG and the SDGs", "ESG dan SDG")}</h3><p>${L("Every environmental decision moves the park's ESG score. Deals carry the SDG they touch. The trade-off is real: the forest ridge is the cheapest land to build on, and the chemicals firm pays the highest rent.", "Setiap keputusan alam sekitar mengubah skor ESG park. Setiap deal menunjukkan SDG yang berkaitan. Trade-off ini nyata: rabung hutan ialah tanah paling murah untuk dibina, dan firma kimia membayar sewa paling tinggi.")}</p>
<table class="tbl"><thead><tr><th>${L("Decision", "Keputusan")}</th><th class="r">ESG</th></tr></thead><tbody>
<tr><td>${L("Declare Forest Ridge a green buffer", "Isytiharkan Forest Ridge sebagai green buffer")}</td><td class="r mono">+${C.ESG.buffer}</td></tr><tr><td>${L("Make the wetland a retention park", "Jadikan tanah lembap retention park")}</td><td class="r mono">+${C.ESG.park}</td></tr><tr><td>${L("Retention works finished", "Retention works siap")}</td><td class="r mono">+${C.ESG.retention}</td></tr><tr><td>${L("Emergency drainage (flood card)", "Saliran kecemasan (kad banjir)")}</td><td class="r mono">+${C.ESG.drainage}</td></tr>
<tr><td>${L("Solar canopies bought / power-purchase agreement", "Kanopi solar dibeli / power-purchase agreement")}</td><td class="r mono">+${C.ESG.solarT} / +${C.ESG.solarC}</td></tr><tr><td>${L("Green certification", "Pensijilan hijau")}</td><td class="r mono">+${C.ESG.cert}</td></tr><tr><td>${L("Rainwater storage", "Simpanan air hujan")}</td><td class="r mono">+${C.ESG.rain}</td></tr><tr><td>${L("Restoration after a failed audit", "Pemulihan selepas audit gagal")}</td><td class="r mono">+${C.ESG.restore}</td></tr>
<tr><td>${L("Forest clearance", "Pembukaan hutan")}</td><td class="r mono">${C.ESG.clear}</td></tr><tr><td>${L("Each building on the former wetland", "Setiap bangunan di bekas tanah lembap")}</td><td class="r mono">${C.ESG.buildWet}</td></tr><tr><td>${L("Data centre as offered (grid power, no conditions)", "Pusat data seperti ditawarkan (elektrik grid, tanpa syarat)")}</td><td class="r mono">${C.ESG.dcOffered}</td></tr><tr><td>${L("Lease sited on the ridge / the former wetland", "Lease di rabung / bekas tanah lembap")}</td><td class="r mono">${C.ESG.siteF} / ${C.ESG.siteG}</td></tr>
<tr><td>${L("Chemicals firm as offered / with a zero-discharge covenant", "Firma kimia seperti ditawarkan / dengan covenant zero-discharge")}</td><td class="r mono">${C.ESG.chemT} / ${C.ESG.chemC}</td></tr><tr><td>${L("Chemical spill (1 in 6 a year without the covenant)", "Tumpahan kimia (1 dalam 6 setahun tanpa covenant)")}</td><td class="r mono">${C.ESG.spill}</td></tr><tr><td>${L("Audit failure ignored", "Kegagalan audit diabaikan")}</td><td class="r mono">${C.ESG.auditFail}</td></tr></tbody></table>
<h3>${L("Choosing the plot", "Memilih plot")}</h3><p>${L(`When a deal lets you choose the plot (a data centre with conditions, the contractor's buildings, the anchor's New Build), the plot changes the value. Highway Frontage pays a ×${C.SITE.frontage} premium on ground leases; Campus Edge adds +${C.SITE.campusIP} impact a year to a linked use but the counterparty needs a higher roll; a plot without road and power pays nothing until you service it; the ridge and the former wetland cost ESG.`, `Apabila deal membenarkan anda memilih plot (pusat data dengan syarat, bangunan kontraktor, New Build untuk anchor), plot itu mengubah nilainya. Highway Frontage membayar premium ×${C.SITE.frontage} untuk ground lease; Campus Edge menambah +${C.SITE.campusIP} impact setahun bagi kegunaan linked tetapi pihak lawan memerlukan balingan dadu yang lebih tinggi; plot tanpa road dan power tidak membayar apa-apa sehingga anda menyediakan services; rabung hutan dan bekas tanah lembap menelan ESG.`)}</p>`;
  else h += `<p class="faint">${L("ESG is scored from Level 2 onward.", "ESG dinilai mulai Level 2.")}</p>`;
  const awardsL = [lv.key === "rintis" ? L("Best Operator (highest B3)", "Best Operator (B3 tertinggi)") : L("Best Survivor (highest B3)", "Best Survivor (B3 tertinggi)"), S.B2 ? L("Land Steward (highest B2)", "Land Steward (B2 tertinggi)") : "", L("Impact Champion (most verified impact)", "Impact Champion (impact disahkan paling banyak)"), L("Sound Judgement (highest C)", "Sound Judgement (C tertinggi)"), S.E ? L("Green Steward (highest ESG)", "Green Steward (ESG tertinggi)") : "", L("Boldest Sound Bet (highest Dare Index with at least 80% sound decisions)", "Boldest Sound Bet (Dare Index tertinggi dengan sekurang-kurangnya 80% keputusan wajar)")].filter(Boolean).join(", ");
  h += L(`<p><b>Medals.</b> Gold: ${M.gold} or more, never bailed out, FCR12 ≥ 1, drift ≤ 50%${lv.esgGate ? " and ESG ≥ 0" : ""} at the end. Silver: ${M.silver} or more, not in receivership, and a park score of at least half the target (${Math.round(S.parkTarget / 2)}); Gold needs that too. Bronze: ${M.bronze} or more. Several teams can take the same medal.</p>
<p><b>Special awards</b> (no marks): ${awardsL}.</p></div>`, `<p><b>Pingat.</b> Emas: ${M.gold} atau lebih, tiada bailout, FCR12 ≥ 1, drift ≤ 50%${lv.esgGate ? " dan ESG ≥ 0" : ""} di akhir. Perak: ${M.silver} atau lebih, tidak dalam receivership, dan skor park sekurang-kurangnya separuh sasaran (${Math.round(S.parkTarget / 2)}); Emas juga memerlukannya. Gangsa: ${M.bronze} atau lebih. Beberapa pasukan boleh memenangi pingat yang sama.</p>
<p><b>Anugerah khas</b> (tiada markah): ${awardsL}.</p></div>`);
  return (RULES_CACHE[ck] = h);
}

/* =============================================================== deal room */
function previewOpt(t, sc, ev, opt, m) {
  const c = JSON.parse(JSON.stringify(t)); const e2 = Object.assign({}, ev, { deal: 6 });
  PB.applyEvent(c, sc, e2, opt, m);
  const out = [];
  const d = (a, b) => Math.abs(b - a) > 0.049;
  if (d(t.cash, c.cash)) out.push(`${L("cash", "tunai")} ${n1(t.cash)} → ${n1(c.cash)}`);
  if (m <= t.fundEnd && d(t.fund, c.fund)) out.push(`fund ${n1(t.fund)} → ${n1(c.fund)}`);
  const ci0 = PB.committedIncome(t), ci1 = PB.committedIncome(c); if (d(ci0, ci1)) out.push(`${L("income/yr", "pendapatan/thn")} ${sg1(ci1 - ci0)}`);
  const u0 = PB.annualUpkeep(t, m), u1 = PB.annualUpkeep(c, m); if (d(u0, u1)) out.push(`upkeep/${L("yr", "thn")} ${sg1(u1 - u0)}`);
  const cu0 = t.buildings.filter(b => b.status === "building").reduce((a, b) => a + b.units, 0), cu1 = c.buildings.filter(b => b.status === "building").reduce((a, b) => a + b.units, 0);
  if (cu1 !== cu0) out.push(`${L("units under construction", "unit dalam pembinaan")} +${cu1 - cu0}`);
  const dr0 = PB.driftOf(t), dr1 = PB.driftOf(c); if (d(dr0 * 100, dr1 * 100)) out.push(`drift ${pc(dr0)} → ${pc(dr1)}`);
  if (d(t.ipv + t.ipu, c.ipv + c.ipu)) out.push(`impact ${sg1((c.ipv + 0.5 * c.ipu) - (t.ipv + 0.5 * t.ipu))}`);
  if (d(t.esg, c.esg)) out.push(`ESG ${sg1(c.esg - t.esg)}`);
  if (c.startups.length !== t.startups.length) out.push(`startup +${c.startups.length - t.startups.length}`);
  if (c.applicants.length !== t.applicants.length) out.push(`${L("applicants", "pemohon")} +${c.applicants.length - t.applicants.length}`);
  const wk0 = Object.values(t.zones).reduce((a, z) => a + z.works.length, 0), wk1 = Object.values(c.zones).reduce((a, z) => a + z.works.length, 0);
  if (wk1 > wk0) out.push(L(`fibre works in ${wk1 - wk0} zone${wk1 - wk0 > 1 ? "s" : ""}`, `kerja fibre di ${wk1 - wk0} zon`));
  if (c.leases.length !== t.leases.length) out.push(`ground lease ${c.leases.length - t.leases.length > 0 ? "+" : ""}${c.leases.length - t.leases.length}`);
  if (c.tenants.length !== t.tenants.length) out.push(`${L("tenants", "penyewa")} ${c.tenants.length - t.tenants.length > 0 ? "+" : ""}${c.tenants.length - t.tenants.length}`);
  return out.length ? out : [L("no immediate change", "tiada perubahan segera")];
}
function fmtTimer(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
function dieHTML(ev, sc, big) { const st = big ? ` style="width:96px;height:96px;font-size:62px"` : ""; return sc.lv.dice ? `<div class="die"${st} aria-label="${L("Die", "Dadu")}">${ev.deal}</div>` : `<div class="die ok"${st} aria-label="${L("Accepted", "Diterima")}">✓</div>`; }
function outcomeL(text, Cd) { const rest = text.slice(Cd.title.length + 2); const M = MSX(); const s = M ? M.mon(M.sayMS(rest)) : rest; return s.charAt(0).toUpperCase() + s.slice(1); }
function dealTeam(res, tm) {
  const g = res.g, ck = res.ck, st = store();
  if (g.fast && st.mode === "solo" && g.status !== "ended") return "";
  if (g.lastReveal && g.status === "paused" && APP.ui.seenReveal !== g.lastReveal) {
    const ev = res.sc.events.find(e => e.id === g.lastReveal); if (!ev) return "";
    const Cd = CARDS[ev.card], dl = tm.t.dlog.find(d => d.eid === ev.id);
    const outcome = tm.t.log.filter(l => l.kind === "event" && l.text.indexOf(Cd.title) === 0).slice(-1)[0];
    const solo = st.mode === "solo";
    return `<div class="overlay"><div class="deal"><div class="deal-top"><span class="chip ${Cd.tone === "threat" ? "tone-thr" : "tone-opp"}">${toneL(Cd.tone)}</span><span class="label">${L("Deal closed", "Deal ditutup")}</span></div>
<div class="deal-body"><div style="display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center">${dieHTML(ev, res.sc)}<h2>${esc(cardL(ev.card, "title"))}</h2></div>
<p class="txt">${dl && dl.eligible ? L(`You chose <b>${OPTL[dl.opt]}${dl.site ? " on Zone " + dl.site : ""}</b>.`, `Anda memilih <b>${OPTL[dl.opt]}${dl.site ? " di Zon " + dl.site : ""}</b>.`) : L("This deal did not apply to your park.", "Deal ini tidak terpakai untuk park anda.")} ${outcome ? esc(outcomeL(outcome.text, Cd)) : ""}</p>
${HOST.dealAdvice ? HOST.dealAdvice(res, tm, ev, "after") : ""}<div class="row">${solo ? `<button class="btn primary" data-act="solo-resume">${L("Continue", "Teruskan")}</button>` : `<button class="btn" data-act="seen-reveal">${L("Close", "Tutup")}</button><span class="muted">${L("The clock restarts when the Game Master resumes.", "Jam bermula semula apabila Game Master meneruskannya.")}</span>`}</div></div></div></div>`;
  }
  if (!ck.hold || ck.hold.kind !== "event") return "";
  const ev = ck.hold.ev, Cd = CARDS[ev.card], t = tm.t, m = res.mCur;
  const left = (g.window || 90) * 1000 - (now() - ck.openAt);
  const myD = st.decisionOf(ev.id, tm.id), my = decOpt(myD), myZ = decZone(myD);
  const elig = PB.eligible(ev.card, t, m) && !t.receiver;
  let opts = "", picker = "";
  if (elig) {
    for (const k of ["T", "C", "L"]) {
      if (!Cd[k]) continue;
      const hasSite = Cd.site && Cd.site[k]; const zs = hasSite ? siteZones(ev.card, t, m) : [];
      const pz = hasSite ? (my === k && myZ && zs.includes(myZ) ? myZ : defaultZone(ev.card, t, m, zs)) : null;
      const prev = previewOpt(t, res.sc, ev, pz ? { opt: k, zone: pz } : k, m);
      opts += `<button class="opt${my === k ? " on" : ""}" data-act="decide" data-eid="${ev.id}" data-opt="${k}"${pz ? ` data-zone="${pz}"` : ""}><span class="k">${OPTL[k]}</span><span>${esc(cardL(ev.card, k))}</span><span class="prev">${k === "C" && res.lv.dice ? `<span>${L("if accepted:", "jika diterima:")}</span>` : ""}${pz ? `<span>${L("on Zone ", "di Zon ")}${pz}:</span>` : ""}${prev.map(x => `<span>${esc(x)}</span>`).join("")}</span></button>`;
    }
    if (my && Cd.site && Cd.site[my]) {
      const zs = siteZones(ev.card, t, m);
      picker = `<div class="picker"><span class="label">${L("Which plot?", "Plot yang mana?")}</span><div class="zones">${zs.map(z => `<button class="zbtn${myZ === z ? " on" : ""}" data-act="decide" data-eid="${ev.id}" data-opt="${my}" data-zone="${z}"><b>${z} · ${esc(ZSHORT[z])}</b><span>${esc(siteNote(ev.card, t, z, m))}</span></button>`).join("") || `<span class="muted">${L("No plot available.", "Tiada plot tersedia.")}</span>`}</div></div>`;
    }
  }
  const d = dateParts(ck.T, res.months);
  const foot = (my ? L("Your choice is recorded. You can change it until the deal closes.", "Pilihan anda telah direkodkan. Anda boleh menukarnya sehingga deal ditutup.") : L("No decision counts as Leave.", "Tiada keputusan dikira sebagai Leave.")) + " " + (res.lv.dice ? L("Previews show the immediate effect; the die for Conditions is rolled when the deal closes.", "Pratonton menunjukkan kesan segera; dadu untuk Conditions dibaling apabila deal ditutup.") : L("In this level every counterparty accepts your conditions.", "Dalam level ini setiap pihak menerima syarat anda."));
  return `<div class="overlay" role="dialog" aria-label="Deal Room"><div class="deal"><div class="deal-top"><span class="chip ${Cd.tone === "threat" ? "tone-thr" : "tone-opp"}">${toneL(Cd.tone)}</span><span class="label">Deal Room · ${dmyL(d)}, ${yrL(d.year)}</span><span class="timer${left < 20000 ? " low" : ""}" data-live="dealtimer">${fmtTimer(left)}</span><button class="btn sm" data-act="home" title="${L("Leave this dashboard", "Tinggalkan papan ini")}">${L("Start page", "Halaman utama")}</button></div>
<div class="deal-body"><h2>${esc(cardL(ev.card, "title"))}</h2>${Cd.sdg ? `<div class="row">${sdgChips(Cd)}</div>` : ""}<p class="txt">${esc(cardL(ev.card, "text"))}</p>
${elig ? `<div class="opts">${opts}</div>${picker}${HOST.dealAdvice ? HOST.dealAdvice(res, tm, ev, "before") : ""}<p class="faint" style="margin:0;font-size:12.5px">${esc(foot)}</p>` : `<div class="note">${esc(t.receiver ? whyL("Your park is in receivership.") : ((HOST.lang === "ms" ? NOT_ELIG_MS : NOT_ELIG)[ev.card] || L("This deal does not apply to your park.", "Deal ini tidak terpakai untuk park anda.")))}</div>`}
${st.mode === "solo" ? `<div class="row"><button class="btn primary" data-act="solo-close"${!my && elig ? " disabled" : ""}>${res.lv.dice ? L("Close the deal and roll", "Tutup deal dan baling dadu") : L("Close the deal", "Tutup deal")}</button><span class="muted">${elig && !my ? L("Choose an option first.", "Pilih satu opsyen dahulu.") : ""}</span></div>` : ""}
</div></div></div>`;
}
function soloHoldOverlay(res, tm) {
  const ck = res.ck; if (store().mode !== "solo" || !ck.hold || res.g.fast) return "";
  const h = ck.hold, lv = res.lv;
  if (h.kind === "checkpoint" || h.kind === "downturn" || h.kind === "forecast") {
    let body = "";
    const k = res.sc.downturn.sev, S = C.SEV[k];
    if (h.kind === "downturn") body = `<h2>Downturn ${L(S.label, sevL(k))}</h2><p class="txt">${L(`Loan rate ${pc(S.rate)} and loan limit ${S.cap} Cr until the end. Unlinked rents fall ${pc(S.cut)}, linked ${pc(S.cut / 2)}. ${pc(S.bo)} of back-office tenants close now and again in 12 months; fewer applicants arrive.`, `Kadar pinjaman ${pc(S.rate)} dan had pinjaman ${S.cap} Cr sehingga tamat. Sewa unlinked jatuh ${pc(S.cut)}, linked ${pc(S.cut / 2)}. ${pc(S.bo)} penyewa back-office tutup sekarang dan sekali lagi dalam 12 bulan; pemohon berkurang.`)}</p>`;
    else if (h.kind === "forecast") body = `<h2>${L(`Forecast: ${S.label.toLowerCase()} downturn ahead`, `Ramalan: downturn ${sevL(k)} akan datang`)}</h2><p class="txt">${L(`Economists expect a ${S.label.toLowerCase()} downturn from ${mname(res.sc.downturn.start)}. Six months to prepare: rates will rise to ${pc(S.rate)} and the bank will cut the loan limit to ${S.cap} Cr.`, `Pakar ekonomi menjangka downturn ${sevL(k)} bermula ${mnameL(res.sc.downturn.start)}. Enam bulan untuk bersedia: kadar faedah akan naik ke ${pc(S.rate)} dan bank akan memotong had pinjaman ke ${S.cap} Cr.`)}</p>`;
    else if (h.phase === 1) body = `<h2>${L("End of Phase 1", "Tamat Fasa 1")}</h2><p class="txt">${L("The Development Fund has closed.", "Development Fund sudah ditutup.")} B1 = ${n1(tm.now.B1)} / ${lv.score.B1}. ${lv.key === "rintis" ? L("Year 3: run the park. Fill your units and keep income above costs.", "Tahun 3: operasikan park. Penuhkan unit dan kekalkan pendapatan melebihi kos.") : L("Zone H is released: sign a use for each plot by 31 December Year 3.", "Zon H dilepaskan: tandatangani penggunaan setiap plot sebelum 31 Disember Tahun 3.")}</p>`;
    else body = `<h2>${L("End of Phase 2", "Tamat Fasa 2")}</h2><p class="txt">B2 = ${n1(tm.now.B2)} / ${lv.score.B2}. ${lv.downturn && lv.downturn.forecast ? L("The survival phase begins; watch for the forecast.", "Fasa 3 bermula; perhatikan ramalan.") : L("The survival phase begins: a downturn will start between January and June of Year 4.", "Fasa 3 bermula: downturn akan bermula antara Januari dan Jun Tahun 4.")}</p>`;
    return `<div class="overlay"><div class="deal"><div class="deal-body">${body}<div class="row"><button class="btn primary" data-act="solo-cont">${L("Continue", "Teruskan")}</button></div></div></div></div>`;
  }
  return "";
}
function partBars(r, lv) {
  const ks = parts(lv), W = 300, rowH = 22, H = ks.length * rowH + 4;
  let s = `<svg class="pbars" viewBox="0 0 ${W} ${H}" role="img" aria-label="${L("Score by part", "Skor mengikut bahagian")}">`;
  ks.forEach((k, i) => {
    const max = lv.score[k], v = Math.max(0, r[k] || 0), f = max ? v / max : 0, y = i * rowH + 3, x0 = 88, bw = W - x0 - 74;
    s += `<text class="pl" x="${x0 - 6}" y="${y + 12}" text-anchor="end">${esc(partLabel(k, lv))}</text><rect class="pbg" x="${x0}" y="${y + 2}" width="${bw}" height="12" rx="3"/><rect class="pv ${f >= 0.8 ? "hi" : (f < 0.4 ? "lo" : "")}" x="${x0}" y="${y + 2}" width="${Math.max(2, bw * f)}" height="12" rx="3"/><text class="pn" x="${x0 + bw + 6}" y="${y + 12}">${n1(v)}<tspan class="pm"> / ${max}</tspan></text>`;
  });
  return s + `</svg>`;
}
function radarSVG(series, lv, size) {
  const ks = parts(lv), n = ks.length, S = size || 220, cx = S / 2, cy = S / 2 + 4, R = S / 2 - 30;
  const pt = (i, f) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + R * f * Math.cos(a), cy + R * f * Math.sin(a)]; };
  let s = `<svg class="radar" viewBox="0 0 ${S} ${S + 8}" role="img" aria-label="${L("Score profile", "Profil skor")}">`;
  for (const g of [0.25, 0.5, 0.75, 1]) s += `<polygon class="grid" points="${ks.map((k, i) => pt(i, g).map(v => v.toFixed(1)).join(",")).join(" ")}"/>`;
  ks.forEach((k, i) => { const [x, y] = pt(i, 1), [lx, ly] = pt(i, 1.17); s += `<line class="grid" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="ax" x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle">${k}</text>`; });
  series.forEach((sr, j) => {
    const pts = ks.map((k, i) => pt(i, Math.max(0, Math.min(1, lv.score[k] ? (sr.r[k] || 0) / lv.score[k] : 0))));
    s += `<polygon class="ser s${j}" points="${pts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" ")}"/>` + pts.map(p => `<circle class="ser s${j}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3"/>`).join("");
  });
  return s + `</svg><div class="rleg">${series.map((sr, j) => `<span><i class="s${j}"></i>${esc(sr.name)} · ${n1(sr.r.total)}</span>`).join("")}</div>`;
}
function compareTo(res, tm) {
  const others = res.teams.filter(x => x !== tm && x.rub);
  if (!others.length) return null;
  const bench = others.filter(x => x.bench).sort((a, b) => b.rub.total - a.rub.total)[0];
  const top = others.filter(x => !x.bench).sort((a, b) => b.rub.total - a.rub.total)[0];
  return top || bench;
}
function resultCharts(res, tm, small) {
  const cmp = compareTo(res, tm), lv = res.lv;
  const series = [{ name: tm.name, r: tm.rub }]; if (cmp) series.push({ name: cmp.name + (cmp.bench ? " (benchmark)" : ""), r: cmp.rub });
  return `<div class="rcharts${small ? " small" : ""}"><div><div class="label">${L("Marks by part", "Markah mengikut bahagian")}</div>${partBars(tm.rub, lv)}</div><div><div class="label">${L("Profile", "Profil")}${cmp ? L(" against ", " berbanding ") + esc(cmp.bench ? L("the best benchmark", "benchmark terbaik") : L("the leader", "pendahulu")) : ""}</div>${radarSVG(series, lv, small ? 190 : 220)}</div></div>`;
}
function breakdown(r, lv) { return `<div class="brk" style="grid-template-columns:repeat(${parts(lv).length},1fr)">${parts(lv).map(k => `<span title="${esc(partLabel(k, lv))}"><em>${k}</em>${n1(r[k])}<small>${esc(partLabel(k, lv))}</small></span>`).join("")}</div>`; }
function finalOverlay(res, tm) {
  const g = res.g; if (!res.final || !g.reveal || APP.ui.seenEnd || !tm.rub) return "";
  const r = tm.rub, so = PB.socio(tm.t), MED = { gold: L("Gold", "Emas"), silver: L("Silver", "Perak"), bronze: L("Bronze", "Gangsa"), none: L("Completed", "Tamat") };
  return `<div class="overlay"><div class="deal"><div class="deal-body"><span class="label">${L("Final result", "Keputusan akhir")} · ${esc(tm.name)} · ${esc(lvLabel(res.sc.level))}</span>
<div class="medal ${r.medal}" style="border-width:1px"><div class="m">${MED[r.medal]}</div><div class="tot">${n1(r.total)}</div>${g.endedEarly ? `<div class="chip warn" style="margin:4px auto 6px">${L("Ended early on ", "Ditamatkan awal pada ")}${mnameL(g.endedEarly)}${L(": the remaining months ran without new orders", ": baki bulan berjalan tanpa arahan baharu")}</div>` : ""}${breakdown(r, res.lv)}${resultCharts(res, tm)}
<div class="muted" style="font-size:12.5px">${L("Park score", "Skor park")} ${n1(r.park.score)} · impact ${n1(r.park.ip)} · FCR12 ${r.park.fcr > 8 ? "—" : r.park.fcr.toFixed(2)} · drift ${pc(r.park.drift)}${res.lv.score.E ? " · ESG " + n1(r.esg) : ""} · dare ${r.dare} · ${L("sound", "wajar")} ${pc(r.soundShare)}${tm.hasD ? "" : L(" · defence not yet marked", " · defence belum dinilai")}</div>
<div class="muted" style="font-size:12.5px">${L("Impact (not scored)", "Impak (tidak diberi markah)")}: ${so.jobs} ${L("jobs", "pekerjaan")} · ${so.interns} ${L("interns/yr", "intern/tahun")} · ${so.firms} ${L("firms", "syarikat")}, ${so.alumni} ${L("alumni-founded", "diasaskan alumni")} · ${pc(so.uniShare)} ${L("university-linked", "berkait universiti")} · ${L("economic impact", "impak ekonomi")} ${n1(so.econ)} Cr/${L("yr", "thn")}</div></div>
${HOST.finalExtra ? HOST.finalExtra(res, tm) : ""}
<div class="row"><button class="btn" data-act="seen-end">${L("Close", "Tutup")}</button>${store().mode === "solo" ? LEVEL_KEYS.map(k => `<button class="btn ${k === res.sc.level ? "" : "primary"}" data-act="solo-new" data-level="${k}">${L("New game", "Permainan baharu")} · ${esc(lvLabel(k))}</button>`).join("") : ""}</div></div></div></div>`;
}

/* =============================================================== front screen */
function newsFeed(res, n) {
  const items = [];
  for (const tm of res.teams) if (!tm.bench) for (const l of tm.t.log) if (l.kind === "good" || l.kind === "bad" || (l.kind === "warn" && /reclaimed|lapsed|withdrew|patience/.test(l.text))) items.push({ m: l.m, team: tm.name, text: noteL(l.text), kind: l.kind });
  items.sort((a, b) => b.m - a.m);
  return items.slice(0, n || 9);
}
function viewScreen(res) {
  const g = res.g, ck = res.ck, d = dateParts(ck.T, res.months), m = res.mCur, lv = res.lv, sc = res.sc;
  let ctx = "";
  const sevN = () => L(C.SEV[sc.downturn.sev].label, sevL(sc.downturn.sev));
  if (m <= lv.fundEnd) ctx = L(`Development Fund lapses in ${lv.fundEnd - m + 1} months`, `Development Fund luput dalam ${lv.fundEnd - m + 1} bulan`);
  else if (lv.key === "rintis") ctx = L(`Year 3: fill the park and keep income above costs`, `Tahun 3: penuhkan park dan kekalkan pendapatan melebihi kos`);
  else if (m <= 36) ctx = L(`Zone H: every plot needs a signed use by 31 Dec Year 3`, `Zon H: setiap plot perlu penggunaan yang ditandatangani sebelum 31 Dis Tahun 3`);
  else if (!PB.inDownturn(sc, m)) ctx = sc.downturn.forecastAt && m >= sc.downturn.forecastAt ? L(`${sevN()} downturn forecast from ${mname(sc.downturn.start)}`, `Ramalan downturn ${sevN()} bermula ${mnameL(sc.downturn.start)}`) : L(`A downturn will start before July of Year 4`, `Downturn akan bermula sebelum Julai Tahun 4`);
  else ctx = L(`${sevN()} downturn: survive to 31 Dec Year ${Math.round(res.months / 12)}`, `Downturn ${sevN()}: bertahan hingga 31 Dis Tahun ${Math.round(res.months / 12)}`);
  const head = `<div class="title" data-act="home" title="${L("Back to start", "Kembali ke halaman utama")}" style="cursor:pointer">${BRAND.name}<span>${esc(BRAND.tag)} · ${L("live standings", "kedudukan langsung")}</span></div>
<div class="bigdate">${dmyL(d)}<small>${yrL(d.year)}</small></div>
<div style="display:grid;gap:6px;justify-items:start">${levelChip(res)}${phaseChip(res)}${statusChip(g, ck)}</div><div class="spacer"></div><div class="muted" style="font-size:clamp(14px,1.2vw,19px);max-width:34ch">${esc(ctx)}</div>`;
  return { head: head + (g.notice && g.notice.text ? `<div class="scr-notice"><span class="label">Game Master</span> ${esc(g.notice.text)}</div>` : ""), stage: () => stageHTML(res) };
}
function stageHTML(res) {
  const g = res.g, ck = res.ck, lv = res.lv; let stage = "";
  const h = ck.hold, Y = Math.round(res.months / 12);
  if (g.status === "setup") stage = `<div class="bigcard"><span class="label">${esc(lvLabel(lv.key))} · ${esc(lvSub(lv))}</span><h2>${L(`${yearsWord(Y)} years. ${levelAcres(lv)} acres.`, `${yearsWord(Y)} tahun. ${levelAcres(lv)} ekar.`)}</h2><p class="txt">${L("Every team develops the same science and technology park. The clock starts soon.", "Setiap pasukan membangunkan park sains dan teknologi yang sama. Jam akan bermula sebentar lagi.")}</p>${HOST.joinCard ? HOST.joinCard(res) : ""}${leaderboard(res)}</div>`;
  else if (h && h.kind === "event") stage = screenDeal(res, h);
  else if (g.lastReveal && g.status === "paused") stage = screenReveal(res);
  else if (h && h.kind === "checkpoint") stage = screenCheckpoint(res, h);
  else if (h && h.kind === "forecast") { const k = res.sc.downturn.sev, S = C.SEV[k]; stage = `<div class="bigcard" style="border-color:var(--warn)"><span class="label" style="color:var(--warn)">${L("Economic forecast", "Ramalan ekonomi")}</span><h2>${L(`${S.label} downturn from ${mname(res.sc.downturn.start)}`, `Downturn ${sevL(k)} bermula ${mnameL(res.sc.downturn.start)}`)}</h2><p class="txt">${L(`Six months to prepare. Loan rates will rise to ${pc(S.rate)}, the bank will cut the loan limit to ${S.cap} Cr, and unlinked rents will fall ${pc(S.cut)}.`, `Enam bulan untuk bersedia. Kadar pinjaman akan naik ke ${pc(S.rate)}, bank akan memotong had pinjaman kepada ${S.cap} Cr, dan sewa unlinked akan jatuh ${pc(S.cut)}.`)}</p></div>${leaderboard(res)}`; }
  else if (h && h.kind === "downturn") { const k = res.sc.downturn.sev, S = C.SEV[k]; stage = `<div class="bigcard" style="border-color:var(--bad)"><span class="label" style="color:var(--bad)">${L("Phase 3 · Survive", "Fasa 3 · Bertahan")}</span><h2>Downturn ${L(S.label, sevL(k))}</h2><p class="txt">${L(`Loan rates rise to ${pc(S.rate)} and the loan limit falls to ${S.cap} Cr. Unlinked rents fall ${pc(S.cut)}. ${pc(S.bo)} of back-office tenants close now and again in twelve months. Fewer applicants arrive.`, `Kadar pinjaman naik ke ${pc(S.rate)} dan had pinjaman turun ke ${S.cap} Cr. Sewa unlinked jatuh ${pc(S.cut)}. ${pc(S.bo)} penyewa back-office tutup sekarang dan sekali lagi dalam dua belas bulan. Pemohon berkurang.`)}</p></div>${leaderboard(res)}`; }
  else if (res.final) stage = g.reveal ? ceremony(res) : `<div class="bigcard"><h2>${L("Final bell", "Loceng akhir")}</h2><p class="txt">${L(`${yearsWord(Y)} years are done. `, `${yearsWord(Y)} tahun telah berlalu. `)}${lv.score.D > 0 ? L("Medals follow the defence round.", "Pingat diumumkan selepas pusingan defence.") : L("Medals are revealed next.", "Pingat akan didedahkan seterusnya.")}</p></div>${leaderboard(res)}`;
  else stage = `<div class="scr-grid"><div class="panel" style="padding:6px 12px">${leaderboard(res)}</div><div class="panel" style="padding:12px 16px"><div class="label">${L("Latest", "Terkini")}</div><div class="feed">${newsFeed(res, 9).map(x => `<div><span class="m">${mnameL(x.m)}</span><b>${esc(x.team)}</b> · <span class="${x.kind === "bad" ? "muted" : ""}">${esc(x.text)}</span></div>`).join("") || `<div class="muted">${L("News from the parks appears here.", "Berita daripada park dipaparkan di sini.")}</div>`}</div></div></div>`;
  return stage + `<div class="foot">${esc(BRAND.copyright)}</div>`;
}
function leaderboard(res) {
  const rows = sortedTeams(res); const T = res.lv.score.parkTarget, E = res.lv.score.E > 0;
  return `<div class="scroll-x"><table class="lb"><thead><tr><th>#</th><th>Park</th><th>${L("Park score · target ", "Skor park · sasaran ")}${T}</th><th>Impact</th>${E ? "<th>ESG</th>" : ""}<th>${L("Income/yr", "Pendapatan/thn")}</th><th>${L("Occupancy", "Penghunian")}</th><th>${L("Net cash", "Tunai bersih")}</th><th>FCR12</th></tr></thead><tbody>${rows.map((x, i) => {
    const t = x.t, net = t.cash - t.debt - t.emerg;
    const st = t.receiver ? `<span class="chip bad">receivership</span>` : (t.bailouts ? `<span class="chip warn">bailout</span>` : "");
    return `<tr class="${x.bench ? "bench" : ""}${t.receiver ? " bust" : ""}"><td class="rk">${i + 1}</td><td class="tm">${esc(x.name)} ${st}</td><td class="sc"><span class="scv">${n0(x.ps.score)}</span><div class="bar"><i style="width:${clamp(x.ps.score / T, 0, 1) * 100}%"></i></div></td><td>${n0(x.ps.ip)}</td>${E ? `<td style="color:${t.esg < 0 ? "var(--bad)" : "inherit"}">${t.esg >= 0 ? "+" : ""}${n1(t.esg)}</td>` : ""}<td>${n1(x.ci)}</td><td>${pc(x.occ)}</td><td>${n1(net)}</td><td>${x.ps.fcr > 8 ? "—" : x.ps.fcr.toFixed(2)}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function screenDeal(res, h) {
  const g = res.g, ev = h.ev, Cd = CARDS[ev.card], st = store();
  const left = (g.window || 90) * 1000 - (now() - res.ck.openAt);
  const humans = res.teams.filter(x => !x.bench);
  const chips = humans.map(x => { const dd = st.decisionOf(ev.id, x.id); const el = PB.eligible(ev.card, x.t, res.mCur) && !x.t.receiver; return `<span class="${dd ? "y" : ""}">${esc(x.name)}${!el ? L(" · n/a", " · t/b") : (dd ? " ✓" : "")}</span>`; }).join("");
  return `<div class="bigcard"><div class="row" style="justify-content:space-between;align-items:flex-start"><span class="chip ${Cd.tone === "threat" ? "tone-thr" : "tone-opp"}" style="font-size:15px;padding:4px 12px">${toneL(Cd.tone)} · Deal Room</span><span class="bigtimer" data-live="dealtimer">${fmtTimer(left)}</span></div>
<h2>${esc(cardL(ev.card, "title"))}</h2>${Cd.sdg ? `<div class="row">${sdgChips(Cd)}</div>` : ""}<p class="txt">${esc(cardL(ev.card, "text"))}</p>
<div class="bigopts">${["T", "C", "L"].filter(k => Cd[k]).map(k => `<div><b>${OPTL[k]}</b>${esc(cardL(ev.card, k))}</div>`).join("")}</div>
<div class="label">${L("Decided", "Sudah memutuskan")}</div><div class="decided">${chips}</div></div>`;
}
function screenReveal(res) {
  const g = res.g, ev = res.sc.events.find(e => e.id === g.lastReveal); if (!ev) return leaderboard(res);
  const Cd = CARDS[ev.card];
  const rows = res.teams.filter(x => !x.bench).map(x => {
    const dl = x.t.dlog.find(d => d.eid === ev.id); const out = x.t.log.filter(l => l.kind === "event" && l.text.indexOf(Cd.title) === 0).slice(-1)[0];
    return `<tr><td class="tm">${esc(x.name)}</td><td style="text-align:left">${dl && dl.eligible ? OPTL[dl.opt] + (dl.site ? " · " + dl.site : "") : L("n/a", "t/b")}</td><td style="text-align:left;font-family:var(--f-ui);white-space:normal">${out ? esc(outcomeL(out.text, Cd)) : (dl && dl.eligible ? L("declined", "ditolak") : "")}</td></tr>`;
  }).join("");
  return `<div class="bigcard"><div class="row" style="gap:18px;align-items:center">${dieHTML(ev, res.sc, true)}<div><span class="label">${res.lv.dice ? L("Deal closed · the die", "Deal ditutup · dadu") : L("Deal closed", "Deal ditutup")}</span><h2>${esc(cardL(ev.card, "title"))}</h2></div></div>
<div class="scroll-x"><table class="lb"><thead><tr><th>Park</th><th style="text-align:left">${L("Choice", "Pilihan")}</th><th style="text-align:left">${L("Outcome", "Hasil")}</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function screenCheckpoint(res, h) {
  const humans = res.teams.filter(x => !x.bench).slice(), lv = res.lv;
  if (h.phase === 1) {
    humans.sort((a, b) => b.now.B1 - a.now.B1);
    return `<div class="bigcard"><span class="label">${L("Checkpoint · end of Phase 1", "Checkpoint · tamat Fasa 1")}</span><h2>${L("The fund has closed", "Development Fund sudah ditutup")}</h2><div class="scroll-x"><table class="lb"><thead><tr><th>Park</th><th>${L("Fund used", "Fund digunakan")}</th><th>${L("Income added/yr", "Pendapatan ditambah/thn")}</th><th>B1 / ${lv.score.B1}</th></tr></thead><tbody>${humans.map(x => `<tr><td class="tm">${esc(x.name)}</td><td>${n1(x.t.snap.fundUsed || 0)} ${L("of", "daripada")} ${x.t.fund0}</td><td>${sg1((x.t.snap.ci24 || 0) - x.t.snap.ci0)}</td><td><span class="scv" style="font-family:var(--f-display);font-weight:800">${n1(x.now.B1)}</span></td></tr>`).join("")}</tbody></table></div><p class="txt">${lv.key === "rintis" ? L("Year 3 begins: run the park, fill the units, keep income above costs.", "Tahun 3 bermula: operasikan park, penuhkan unit, kekalkan pendapatan melebihi kos.") : L("Zone H is released today. Every plot needs a signed use by 31 December Year 3.", "Zon H dilepaskan hari ini. Setiap plot perlu penggunaan yang ditandatangani sebelum 31 Disember Tahun 3.")}</p></div>`;
  }
  humans.sort((a, b) => b.now.B2 - a.now.B2);
  const use = p => ({ build: L("building", "bangunan"), lease: "lease", leaseC: "lease + covenant", reserve: L("reserved", "dirizab"), natlab: L("national lab", "makmal kebangsaan"), reclaimed: L("reclaimed", "diambil semula") }[p] || "—");
  return `<div class="bigcard"><span class="label">${L("Checkpoint · end of Phase 2", "Checkpoint · tamat Fasa 2")}</span><h2>${L("The Land Grant is settled", "Land Grant telah selesai")}</h2><div class="scroll-x"><table class="lb"><thead><tr><th>Park</th><th style="text-align:left">${L("Zone H plots", "Plot Zon H")}</th><th>B2 / ${lv.score.B2}</th></tr></thead><tbody>${humans.map(x => `<tr><td class="tm">${esc(x.name)}</td><td style="text-align:left;font-family:var(--f-ui);white-space:normal">${(x.t.snap.hplots || x.t.hplots).map(use).join(" · ")}</td><td><span class="scv" style="font-family:var(--f-display);font-weight:800">${n1(x.now.B2)}</span></td></tr>`).join("")}</tbody></table></div><p class="txt">${lv.downturn && lv.downturn.forecast ? L("Phase 3 begins. Economists will warn before the downturn comes.", "Fasa 3 bermula. Pakar ekonomi akan memberi amaran sebelum downturn tiba.") : L("Phase 3 begins. A downturn will start in a secret month between January and June of Year 4.", "Fasa 3 bermula. Downturn akan bermula pada bulan rahsia antara Januari dan Jun Tahun 4.")}</p></div>`;
}
function awards(res) {
  const H = res.teams.filter(x => !x.bench && x.rub); if (!H.length) return [];
  const S = res.lv.score;
  const top = (f, filt) => { const LL = H.filter(filt || (() => true)); if (!LL.length) return null; const mx = Math.max(...LL.map(f)); if (!(mx > 0)) return null; return LL.filter(x => Math.abs(f(x) - mx) < 1e-9).map(x => x.name).join(" & "); };
  return [[res.lv.key === "rintis" ? "Best Operator" : "Best Survivor", top(x => x.rub.B3)], [S.B2 ? "Land Steward" : "", S.B2 ? top(x => x.rub.B2) : null], ["Impact Champion", top(x => x.t.ipv)], ["Sound Judgement", top(x => x.rub.C)], [S.E ? "Green Steward" : "", S.E ? top(x => x.t.esg) : null], ["Boldest Sound Bet", top(x => x.rub.dare, x => x.rub.soundShare >= 0.8)]].filter(a => a[0] && a[1]);
}
const MEDALN = m => ({ gold: L("Gold", "Emas"), silver: L("Silver", "Perak"), bronze: L("Bronze", "Gangsa"), none: L("Completed", "Tamat") }[m] || m);
function ceremony(res) {
  const H = res.teams.filter(x => !x.bench && x.rub).sort((a, b) => b.rub.total - a.rub.total);
  const aw = awards(res), Y = Math.round(res.months / 12);
  return `<div class="bigcard"><span class="label">${L(`${yearsWord(Y)} years complete`, `${yearsWord(Y)} tahun selesai`)} · ${esc(lvLabel(res.sc.level))}</span><h2>${L("Medals", "Pingat")}</h2><div class="medals">${H.map(x => `<div class="medal ${x.rub.medal}"><span class="m">${MEDALN(x.rub.medal)}</span><b style="font-size:20px">${esc(x.name)}</b><div class="tot">${n1(x.rub.total)}</div>${breakdown(x.rub, res.lv)}${partBars(x.rub, res.lv)}<div class="faint" style="font-size:12.5px">${x.rub.medal !== "gold" && x.rub.total >= res.lv.medals.gold ? L("Gold gates not met: ", "Syarat Emas tidak dipenuhi: ") + goldMiss(x, res.lv) : (x.rub.medal === "bronze" && x.rub.total >= res.lv.medals.silver ? L("Silver needs a park score of at least ", "Perak memerlukan skor park sekurang-kurangnya ") + Math.round(res.lv.score.parkTarget / 2) : "")}</div></div>`).join("")}</div>
${H.length > 1 ? `<div class="rcharts cer"><div><div class="label">${L("Score profiles", "Profil skor")}</div>${radarSVG(H.slice(0, 4).map(x => ({ name: x.name, r: x.rub })), res.lv, 260)}${H.length > 4 ? `<div class="faint">${L("The top four parks are drawn.", "Empat park teratas dilukis.")}</div>` : ""}</div></div>` : ""}
${aw.length ? `<div class="label">${L("Special awards", "Anugerah khas")}</div><div class="decided">${aw.map(a => `<span class="y">${esc(a[0])}: ${esc(a[1])}</span>`).join("")}</div>` : ""}</div>`;
}
function goldMiss(x, lv) { const r = x.rub, t = x.t, o = []; if (r.park.score < 0.5 * lv.score.parkTarget) o.push(L("park score below half the target", "skor park bawah separuh sasaran")); if (t.bailouts) o.push(L("bailed out", "pernah bailout")); if (!(r.park.fcr >= 1)) o.push(L("FCR12 below 1", "FCR12 bawah 1")); if (r.park.drift > 0.5) o.push(L("drift above 50%", "drift melebihi 50%")); if (lv.esgGate && t.esg < 0) o.push(L("ESG below 0", "ESG bawah 0")); return o.join(", "); }

/* =============================================================== GM console */
function gmSetupHTML() {
  const s = APP.ui.setup || (APP.ui.setup = { seed: newSeed(), n: 6, names: [], bench: ["garden", "rocket", "caretaker"], pace: LEVEL_TEXT.rintis.pace, window: 90, auto: true, level: "rintis", site: HOST.site || "corridor", benchView: "lag" });
  for (let i = 0; i < s.n; i++) if (!s.names[i]) s.names[i] = "Team " + (i + 1);
  if (s.cash == null) s.cash = lvl(s.level).startCash;
  const key = JSON.stringify([s.n, s.bench, s.pace, s.window, s.auto, s.level, s.site, s.cash, s.benchView, APP.ui.setupNonce || 0, !!game(), HOST.lang]);
  const LV = lvl(s.level), sc = scen("preview", s.level);
  const clockMin = Math.round(LV.months * s.pace / 60000), dealMin = Math.round(sc.events.length * (s.window + 20) / 60);
  const html = `<div class="setup panel card"><h2>${L("Set up a live game", "Sediakan permainan langsung")}</h2>
<p class="muted" style="margin:0">${L("Every team plays the same seed: the same applicants, deals and shocks. Teams join on their own laptops and pick their name.", "Setiap pasukan bermain dengan seed yang sama: pemohon, deal dan kejutan yang sama. Pasukan menyertai melalui komputer riba sendiri dan memilih nama mereka.")}</p>
<div class="field"><span class="label">Level</span><div class="lvlcards">${LEVEL_KEYS.map(k => { const X = lvl(k); return `<button class="lvlcard${s.level === k ? " on" : ""}" data-act="su-level" data-level="${k}"><b>Level ${X.n} · ${esc(X.name)}</b><span class="sub">${esc(lvSub(X))}</span><span>${esc(LEVEL_TEXT[k].blurb)}</span></button>`; }).join("")}</div></div>
<div class="row"><span class="label">${L("Site plan", "Pelan tapak")}</span>${[["corridor", L("Campus corridor", "Koridor kampus")], ["valley", L("Green valley", "Lembah hijau")]].map(([k, l]) => `<button class="btn sm${(s.site || "corridor") === k ? " primary" : ""}" data-act="su-site" data-site="${k}">${l}</button>`).join("")}<span class="muted">${L("Same rules on both; only the map changes.", "Peraturan sama untuk kedua-duanya; hanya peta yang berbeza.")}</span></div>
<div class="row"><label class="field" style="flex:1;min-width:200px"><span class="label">Seed</span><input type="text" id="su-seed" value="${esc(s.seed)}" data-in="seed"></label><button class="btn" data-act="su-seed" style="align-self:end">${L("New seed", "Seed baharu")}</button></div>
<div class="row"><span class="label">${L("Teams", "Pasukan")}</span>${stepper("su-n", s.n)}<span class="label" style="margin-left:14px">${L("Starting cash (Cr)", "Tunai permulaan (Cr)")}</span>${stepper("su-cash", s.cash)}<span class="muted">${L(`default ${lvl(s.level).startCash} Cr; every team and benchmark park starts with the same amount`, `lalai ${lvl(s.level).startCash} Cr; setiap pasukan dan park benchmark bermula dengan jumlah yang sama`)}</span></div>
<div class="teamnames">${s.names.slice(0, s.n).map((nm, i) => `<label class="field"><span class="label">${L("Team", "Pasukan")} ${i + 1}</span><input type="text" id="su-name-${i}" value="${esc(nm)}" data-in="name" data-i="${i}" maxlength="24"></label>`).join("")}</div>
<div class="field"><span class="label">${L("Benchmark parks on the leaderboard", "Park benchmark pada papan kedudukan")}</span><div class="checks">${AI.ORDER.slice().reverse().map(k => `<label><input type="checkbox" data-act="su-bench" data-k="${k}"${s.bench.includes(k) ? " checked" : ""}> ${esc(AI.S[k].label)}</label>`).join("")}</div></div>
<label class="row" style="flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" data-act="su-benchview"${s.benchView !== "end" ? " checked" : ""} style="margin-top:3px"><span>${L("Teams can follow the benchmark parks' moves and deal choices, one quarter late. If unticked, they are revealed at the final bell.", "Pasukan boleh mengikuti langkah dan pilihan deal park benchmark, lewat satu suku tahun. Jika tidak ditanda, semuanya didedahkan pada loceng akhir.")}</span></label>
<div class="row"><span class="label">${L("One month every", "Satu bulan setiap")}</span>${[30000, 45000, 60000, 90000].map(v => `<button class="btn sm${s.pace === v ? " primary" : ""}" data-act="su-pace" data-v="${v}">${v / 1000} s</button>`).join("")}<span class="muted">${L(`about ${clockMin} minutes of clock and ${dealMin} minutes of deals`, `kira-kira ${clockMin} minit jam dan ${dealMin} minit deal`)}</span></div>
<div class="row"><span class="label">${L("Deal window", "Tempoh deal")}</span>${[60, 90, 120].map(v => `<button class="btn sm${s.window === v ? " primary" : ""}" data-act="su-win" data-v="${v}">${v} s</button>`).join("")}</div>
<label class="row"><input type="checkbox" data-act="su-auto"${s.auto ? " checked" : ""}> ${L("Close each deal when its time runs out, and restart the clock 15 seconds after the reveal", "Tutup setiap deal apabila masanya tamat, dan mulakan semula jam 15 saat selepas keputusan didedahkan")}</label>
<div class="row"><button class="btn primary" data-act="gm-create">${L("Create game", "Cipta permainan")}</button>${game() ? `<button class="btn" data-act="gm-cancel-new">${L("Back to the current game", "Kembali ke permainan semasa")}</button>` : ""}</div></div>`;
  return { html, key };
}
function viewGM(res) {
  const g = res.g, ck = res.ck, d = dateParts(ck.T, res.months), mpm = g.msPerMonth, st = store();
  let Lh = "", R = "";
  let ctl = "";
  if (g.status === "setup") ctl = `<button class="btn primary" data-act="gm-start">${L("Start the clock", "Mulakan jam")}</button>`;
  else if (g.status === "running" && !ck.hold) ctl = `<button class="btn" data-act="gm-pause">${L("Pause", "Jeda")}</button>`;
  else if (g.status === "paused" && !ck.hold && !g.lastReveal) ctl = `<button class="btn primary" data-act="gm-resume">${L("Resume", "Sambung")}</button>`;
  if (g.status !== "setup" && g.status !== "ended") ctl += APP.ui.confirmEnd
    ? `<span class="row" style="gap:6px;padding:4px 8px;border:1px solid var(--c-crit);border-radius:8px"><b>${L("End the game now?", "Tamatkan permainan sekarang?")}</b><span class="muted">${L("The remaining months play out with no further orders; then results are computed.", "Baki bulan akan berjalan tanpa arahan baharu; kemudian keputusan dikira.")}</span><button class="btn danger sm" data-act="gm-end-yes">${L("End now", "Tamatkan sekarang")}</button><button class="btn sm" data-act="gm-end-no">${L("Cancel", "Batal")}</button></span>`
    : `<button class="btn danger" data-act="gm-end-ask">${L("End the game…", "Tamatkan permainan…")}</button>`;
  const nx = ck.next; let nxt = "";
  const kindName = x => x.kind === "event" ? "Deal Room · " + esc(cardL(x.ev.card, "title")) : (x.kind === "checkpoint" ? L("Phase " + x.phase + " checkpoint", "Checkpoint Fasa " + x.phase) : (x.kind === "downturn" ? "downturn (" + L(C.SEV[res.sc.downturn.sev].label, sevL(res.sc.downturn.sev)) + ")" : (x.kind === "forecast" ? L("downturn forecast", "ramalan downturn") : L("final bell", "loceng akhir"))));
  if (nx && !ck.hold) nxt = L(`Next stop in ${(nx.t - ck.T).toFixed(1)} months: ${kindName(nx)}.`, `Hentian seterusnya dalam ${(nx.t - ck.T).toFixed(1)} bulan: ${kindName(nx)}.`);
  Lh += `<div class="panel card"><div class="row"><span class="label">${L("Game clock", "Jam permainan")}</span>${levelChip(res)}${statusChip(g, ck)}${phaseChip(res)}</div>
<div class="bigdate" style="font-size:64px">${dmyL(d)}<small>${yrL(d.year)}</small></div>
<div class="row">${ctl}<span class="label" style="margin-left:6px">${L("One month every", "Satu bulan setiap")}</span>${[30000, 45000, 60000, 90000].map(v => `<button class="btn sm${mpm === v ? " primary" : ""}" data-act="gm-pace" data-v="${v}">${v / 1000} s</button>`).join("")}</div>
<div class="muted">${nxt || "&nbsp;"}</div>
<div class="faint" style="font-size:12px">Seed ${esc(g.seed)} · ${g.teams.length} ${L("teams", "pasukan")} · ${L("start cash", "tunai permulaan")} ${g.startCash != null ? g.startCash : res.lv.startCash} Cr</div><div class="row" style="font-size:13px"><span class="chip ${g.auto ? "acc" : "amb"}">${g.auto ? L("Deals: automatic", "Deal: automatik") : L("Deals: manual", "Deal: manual")}</span><span class="muted">${g.auto ? L("Each deal closes when its " + (g.window || 90) + " s run out and the clock restarts 15 s after the reveal. The month clock always runs until you pause it.", "Setiap deal ditutup apabila " + (g.window || 90) + " s tamat dan jam bermula semula 15 s selepas keputusan didedahkan. Jam bulanan sentiasa berjalan sehingga anda menjedanya.") : L("Deals stay open until you press Close the deal and reveal, and the clock waits until you press Resume. The month clock still runs between deals; use Pause to stop it.", "Deal kekal dibuka sehingga anda menekan Tutup deal dan dedahkan, dan jam menunggu sehingga anda menekan Sambung. Jam bulanan masih berjalan antara deal; gunakan Jeda untuk menghentikannya.")}</span><button class="btn sm" data-act="gm-auto">${g.auto ? L("Switch to manual", "Tukar ke manual") : L("Switch to automatic", "Tukar ke automatik")}</button></div>${(g.bench || []).length ? `<div class="row" style="font-size:13px"><span class="chip ${g.benchView === "end" ? "amb" : "acc"}">${g.benchView === "end" ? L("Benchmark moves: at the final bell", "Langkah benchmark: pada loceng akhir") : L("Benchmark moves: one quarter late", "Langkah benchmark: lewat satu suku tahun")}</span><span class="muted">${g.benchView === "end" ? L("Teams see the benchmark parks' scores but not their moves or deal choices until the game ends.", "Pasukan melihat skor park benchmark tetapi tidak langkah atau pilihan deal-nya sehingga permainan tamat.") : L("Teams can follow each benchmark park's moves and deal choices in News and Standings, one quarter late.", "Pasukan boleh mengikuti langkah dan pilihan deal setiap park benchmark dalam Berita dan Kedudukan, lewat satu suku tahun.")}</span><button class="btn sm" data-act="gm-benchview">${g.benchView === "end" ? L("Show them one quarter late", "Paparkan lewat satu suku tahun") : L("Hide until the final bell", "Sembunyikan hingga loceng akhir")}</button></div>` : ""}</div>`;
  Lh += `<div class="panel card"><h2>${L("Message to every screen", "Mesej ke semua skrin")}</h2><div class="row"><input type="text" id="gm-notice" data-in="notice" data-enter="gm-notice" maxlength="160" value="${esc(APP.ui.notice || "")}" placeholder="${L("e.g. Ten minutes to the checkpoint. Check your applicants.", "cth. Sepuluh minit lagi ke checkpoint. Semak pemohon anda.")}" style="flex:1;min-width:220px;font:inherit;padding:7px 9px;border:1px solid var(--rule);border-radius:6px;background:var(--panel);color:var(--ink)"><button class="btn primary" data-act="gm-notice">${L("Send", "Hantar")}</button>${g.notice ? `<button class="btn" data-act="gm-notice-clear">${L("Clear", "Kosongkan")}</button>` : ""}</div>${g.notice ? `<div class="muted">${L("Showing now", "Dipaparkan sekarang")}: “${esc(g.notice.text)}”</div>` : `<div class="faint" style="font-size:12px">${L("Shows as a banner on every team dashboard and on the front screen until you clear it.", "Dipaparkan sebagai banner pada papan setiap pasukan dan skrin hadapan sehingga anda mengosongkannya.")}</div>`}</div>`;
  Lh += gmHold(res);
  if (res.final) Lh += gmEnd(res);
  Lh += HOST.gmExtra ? HOST.gmExtra(res) : "";
  Lh += `<div class="panel card"><h2>${L("Game data", "Data permainan")}</h2><div class="row"><button class="btn" data-act="gm-export"${res.final ? "" : " disabled"}>${L("Download results (CSV)", "Muat turun keputusan (CSV)")}</button><button class="btn" data-act="gm-log">${L("Download order log (JSON)", "Muat turun log arahan (JSON)")}</button></div>
<div class="row">${APP.ui.confirmNew ? `<span>${L("Start a new game? The current game stops for every team.", "Mulakan permainan baharu? Permainan semasa akan berhenti untuk semua pasukan.")}</span><button class="btn danger" data-act="gm-new-yes">${L("Yes, set up a new game", "Ya, sediakan permainan baharu")}</button><button class="btn" data-act="gm-new-no">${L("Keep this game", "Kekalkan permainan ini")}</button>` : `<button class="btn danger" data-act="gm-new">${L("Set up a new game…", "Sediakan permainan baharu…")}</button>`}
${st.purgeOld ? `<button class="btn" data-act="gm-purge">${L("Delete orders from earlier games", "Padam arahan daripada permainan terdahulu")}</button>` : ""}${APP.ui.purge ? `<span class="muted">${esc(APP.ui.purge)}</span>` : ""}</div>
${st.purgeOld ? `<div class="faint" style="font-size:12px">${L("The page holds at most 5,000 records. One game of 8 teams uses about 700; delete earlier games between cohorts.", "Halaman ini memuatkan paling banyak 5,000 rekod. Satu permainan 8 pasukan menggunakan kira-kira 700; padam permainan terdahulu antara kohort.")}</div>` : ""}</div>`;
  const hold = ck.hold && ck.hold.kind === "event" ? ck.hold : null, E = res.lv.score.E > 0;
  R += `<div class="panel card"><h2>Park</h2><div class="scroll-x"><table class="tbl"><thead><tr><th>Park</th><th class="r">${L("Score", "Skor")}</th>${E ? `<th class="r">ESG</th>` : ""}<th class="r">${L("Cash", "Tunai")}</th><th class="r">${L("Loans", "Pinjaman")}</th><th class="r">${L("Occ.", "Penghunian")}</th><th class="r">FCR12</th><th class="r">AP</th><th class="r">${L("Orders", "Arahan")}</th>${hold ? "<th>Deal</th>" : ""}</tr></thead><tbody>${sortedTeams(res).map(x => {
    const t = x.t, orders = x.bench ? "—" : st.ordersFor(x.id).length;
    const dd = hold && !x.bench ? (decLabel(st.decisionOf(hold.id, x.id)) || (PB.eligible(hold.ev.card, t, res.mCur) ? "…" : L("n/a", "t/b"))) : "";
    return `<tr${x.bench ? ` style="opacity:.6"` : ""}><td><b>${esc(x.name)}</b>${x.bench ? ` <span class="chip">benchmark</span>` : ""}${t.receiver ? ` <span class="chip bad">receivership</span>` : (t.bailouts ? ` <span class="chip warn">bailout</span>` : "")}</td><td class="r mono">${n0(x.ps.score)}</td>${E ? `<td class="r mono">${t.esg >= 0 ? "+" : ""}${n1(t.esg)}</td>` : ""}<td class="r mono">${n1(t.cash)}</td><td class="r mono">${n1(t.debt + t.emerg)}</td><td class="r mono">${pc(x.occ)}</td><td class="r mono">${x.ps.fcr > 8 ? "—" : x.ps.fcr.toFixed(2)}</td><td class="r mono">${t.ap}</td><td class="r mono">${orders}</td>${hold ? `<td class="mono">${x.bench ? "" : esc(dd)}</td>` : ""}</tr>`;
  }).join("")}</tbody></table></div>
<div class="faint" style="font-size:12px">${HOST.kind === "server" ? L("You can open any team's dashboard from the join page with its PIN and act for a team that has no laptop.", "Anda boleh membuka papan mana-mana pasukan dari halaman sertai dengan PIN pasukan itu dan bertindak bagi pasukan yang tiada komputer riba.") : L("Teams open this page, choose \"Join as a team\" and pick their name. You can also open a team's dashboard from the start page and act for a team that has no laptop. For the projector, open this page in a second browser tab and choose \"Front screen\"; deals keep closing on time while either tab is open.", "Pasukan membuka halaman ini, memilih \"Sertai sesi langsung\" dan memilih nama mereka. Anda juga boleh membuka papan pasukan dari halaman utama dan bertindak bagi pasukan yang tiada komputer riba. Untuk projektor, buka halaman ini dalam tab pelayar kedua dan pilih \"Skrin hadapan\"; deal terus ditutup tepat pada masanya selagi salah satu tab dibuka.")}</div></div>`;
  if (HOST.gmSide) R += HOST.gmSide(res);
  return `<div class="gm"><div style="display:grid;gap:16px">${Lh}</div><div style="display:grid;gap:16px">${R}</div></div>`;
}
function gmHold(res) {
  const g = res.g, ck = res.ck, st = store();
  const cont = `<div class="row"><button class="btn primary" data-act="gm-cont">${L("Continue the clock", "Teruskan jam")}</button></div>`;
  if (g.lastReveal && g.status === "paused" && !ck.hold) {
    const left = 15000 - (now() - (g.revealAt || now()));
    const ev = res.sc.events.find(e => e.id === g.lastReveal) || {};
    return `<div class="panel card" style="border-color:var(--amber)"><div class="row"><span class="label">${L("Deal closed", "Deal ditutup")}</span>${res.lv.dice ? `<span class="chip amb">${L("die", "dadu")} ${ev.deal}</span>` : ""}</div>
<div class="row"><button class="btn primary" data-act="gm-resume">${L("Resume the clock", "Sambung jam")}</button>${g.auto ? `<span class="muted" data-live="resumetimer">${liveText("resume", left)}</span>` : ""}</div></div>`;
  }
  if (!ck.hold) return "";
  const h = ck.hold;
  if (h.kind === "event") {
    const Cd = CARDS[h.ev.card], left = (g.window || 90) * 1000 - (now() - ck.openAt);
    const humans = res.teams.filter(x => !x.bench); const nd = humans.filter(x => st.decisionOf(h.id, x.id)).length;
    return `<div class="panel card" style="border-color:var(--amber)"><div class="row"><span class="label">Deal Room</span><span class="chip ${Cd.tone === "threat" ? "tone-thr" : "tone-opp"}">${toneL(Cd.tone)}</span><span class="spacer"></span><span class="bigtimer" style="font-size:40px" data-live="dealtimer">${fmtTimer(left)}</span></div>
<h2 style="font-size:22px">${esc(cardL(h.ev.card, "title"))}</h2><p class="muted" style="margin:0">${esc(cardL(h.ev.card, "text"))}</p>
<div class="muted">${L(`${nd} of ${humans.length} parks have decided.`, `${nd} daripada ${humans.length} park sudah memutuskan.`)}${res.lv.dice ? L(` The die will show <b>${h.ev.deal}</b> (hidden from teams until the reveal).`, ` Dadu akan menunjukkan <b>${h.ev.deal}</b> (disembunyikan daripada pasukan sehingga didedahkan).`) : L(" In this level every counterparty accepts conditions.", " Dalam level ini setiap pihak menerima syarat.")}</div>
<div class="row"><button class="btn warnb" data-act="gm-close">${L("Close the deal and reveal", "Tutup deal dan dedahkan")}</button><button class="btn" data-act="gm-extend">+30 s</button></div></div>`;
  }
  if (h.kind === "checkpoint") return `<div class="panel card" style="border-color:var(--accent)"><span class="label">Checkpoint</span><h2 style="font-size:22px">${L("End of Phase ", "Tamat Fasa ")}${h.phase}</h2><p class="muted" style="margin:0">${L(`The front screen shows each park's ${h.phase === 1 ? "B1 (fund use and income added)" : "B2 (Zone H uses)"}. Announce it, then continue.`, `Skrin hadapan menunjukkan ${h.phase === 1 ? "B1 (penggunaan fund dan pendapatan ditambah)" : "B2 (penggunaan Zon H)"} setiap park. Umumkan, kemudian teruskan.`)}</p>${cont}</div>`;
  if (h.kind === "forecast") return `<div class="panel card" style="border-color:var(--warn)"><span class="label">${L("Forecast", "Ramalan")}</span><h2 style="font-size:22px">${L(`${C.SEV[res.sc.downturn.sev].label} downturn from ${mname(res.sc.downturn.start)}`, `Downturn ${sevL(res.sc.downturn.sev)} bermula ${mnameL(res.sc.downturn.start)}`)}</h2><p class="muted" style="margin:0">${L("Teams have six months to prepare. Announce it, then continue.", "Pasukan ada enam bulan untuk bersedia. Umumkan, kemudian teruskan.")}</p>${cont}</div>`;
  if (h.kind === "downturn") return `<div class="panel card" style="border-color:var(--bad)"><span class="label">Downturn</span><h2 style="font-size:22px">${L(`${C.SEV[res.sc.downturn.sev].label} downturn starts`, `Downturn ${sevL(res.sc.downturn.sev)} bermula`)}</h2><p class="muted" style="margin:0">${L("Announce it; the front screen shows the effects.", "Umumkan; skrin hadapan menunjukkan kesannya.")}</p>${cont}</div>`;
  if (h.kind === "end") return `<div class="panel card" style="border-color:var(--accent)"><span class="label">${L("Final bell", "Loceng akhir")}</span><h2 style="font-size:22px">${L("31 December, Year ", "31 Disember, Tahun ")}${Math.round(res.months / 12)}</h2><div class="row"><button class="btn primary" data-act="gm-finish">${L("End the game", "Tamatkan permainan")}</button></div></div>`;
  return "";
}
function gmEnd(res) {
  const g = res.g; const H = res.teams.filter(x => !x.bench), D = res.lv.score.D;
  return `<div class="panel card"><h2>${D ? L("Defence marks and medals", "Markah defence dan pingat") : L("Medals", "Pingat")}</h2>${D ? `<p class="muted" style="margin:0">${L(`Mark each team's defence out of ${D} after its presentation. Totals update as you mark.`, `Nilai defence setiap pasukan daripada ${D} selepas pembentangannya. Jumlah dikemas kini semasa anda menilai.`)}</p>` : `<p class="muted" style="margin:0">${L("This level has no defence round. Reveal the medals when you are ready.", "Level ini tiada pusingan defence. Dedahkan pingat apabila anda bersedia.")}</p>`}
<div class="scroll-x"><table class="tbl"><thead><tr><th>Park</th>${D ? "<th>Defence</th>" : ""}<th class="r">${L("Total", "Jumlah")}</th><th>${L("Medal", "Pingat")}</th><th></th></tr></thead><tbody>${H.map(x => { const dv = (g.defence || {})[x.id]; return `<tr><td><b>${esc(x.name)}</b></td>${D ? `<td>${stepper("def-" + x.id, dv == null ? "—" : dv)}</td>` : ""}<td class="r mono">${x.rub ? n1(x.rub.total) : ""}</td><td>${x.rub ? (x.rub.medal === "none" ? "—" : MEDALN(x.rub.medal)) : ""}</td><td>${x.rub && HOST.finalExtra ? `<button class="btn sm" data-act="transcript" data-team="${esc(x.id)}">${L("Transcript", "Transkrip")}</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>
<div class="row"><button class="btn ${g.reveal ? "" : "primary"}" data-act="gm-reveal">${g.reveal ? L("Hide medals", "Sembunyikan pingat") : L("Show medals on the front screen", "Paparkan pingat di skrin hadapan")}</button></div></div>`;
}

/* =============================================================== frames: what each role sees, as regions with change keys */
const MOUNT = {
  team: `<div id="r-bar" class="bar"></div><div class="wrap"><div id="r-banner"></div><div class="tv"><div><div class="panel planbox"><div id="r-map"></div><div id="r-leg"></div></div><div class="panel zp" id="r-zone"></div></div><div class="panel side"><div class="tabs" id="r-tabs" role="tablist"></div><div class="tabbody" id="r-tab"></div></div></div><div class="foot" id="r-foot"></div></div><div id="r-over"></div>`,
  screen: `<div class="scr"><div id="r-head" class="scr-head"></div><div id="r-stage" class="stage"></div></div>`,
  gm: `<div id="r-bar" class="bar"></div><div class="wrap"><div id="r-gm"></div><div class="foot" id="r-foot"></div></div>`,
};
function gmBar() {
  return `<div class="bar-in">${brandHTML("Game Master")}<div class="spacer"></div>${HOST.kind === "server" ? (HOST.gmBarExtra ? HOST.gmBarExtra() : "") : `<button class="btn sm" data-act="role-screen">${L("Switch this tab to the front screen", "Tukar tab ini ke skrin hadapan")}</button>`}</div>`;
}
function liveData(res) {
  if (!res) return null; const g = res.g, ck = res.ck;
  return {
    dealEnd: ck.hold && ck.hold.kind === "event" ? ck.openAt + (g.window || 90) * 1000 : null,
    resumeEnd: g.lastReveal && g.status === "paused" && !ck.hold ? (g.revealAt || 0) + 15000 : null,
  };
}
function buildFrame() {
  const foot = { id: "r-foot", html: `<span>${esc(BRAND.copyright)}</span>${HOST.footer() || ""}` };
  if (!APP.role) return { kind: "landing", mount: `<div id="r-land"></div>`, regions: [{ id: "r-land", html: HOST.landing() }], live: null };
  const st = store();
  if (!st || !st.game) {
    if (APP.role === "gm") { const s = gmSetupHTML(); return { kind: "gm", mount: MOUNT.gm, regions: [{ id: "r-bar", html: gmBar() }, { id: "r-gm", key: s.key, html: s.html }, foot], live: null }; }
    return { kind: "wait", mount: `<div class="wrap"><div class="banner info" style="margin-top:24px"><b>${L("No game yet.", "Belum ada permainan.")}</b><span class="muted">${L("Waiting for the Game Master.", "Menunggu Game Master.")}</span><button class="btn" data-act="home">${L("Back", "Kembali")}</button></div></div>`, regions: [], live: null };
  }
  const res = compute(); if (!res) return { kind: "wait", mount: "", regions: [], live: null };
  const g = res.g, ck = res.ck;
  if (APP.role === "team" || APP.role === "solo") {
    const tm = teamOf(res, APP.teamId);
    if (!tm) return { kind: "wait", mount: `<div class="wrap"><div class="banner info" style="margin-top:24px"><b>${L("This team is not in the current game.", "Pasukan ini tiada dalam permainan semasa.")}</b><button class="btn" data-act="home">${L("Pick again", "Pilih semula")}</button></div></div>`, regions: [], live: null };
    const ca = JSON.stringify(canAct(res));
    /* the plan only moves within a month while something is being built (progress bars) */
    const MS = HOST.mapSteps || 20, mapT = tm.t.buildings.some(b => b.status === "building") ? Math.floor(res.T * MS) / MS : "";
    const overKey = [res.key, ck.hold && ck.hold.id, g.status, g.lastReveal, g.reveal, APP.ui.seenReveal, APP.ui.seenEnd, ck.hold && ck.hold.kind === "event" ? JSON.stringify(store().decisionOf(ck.hold.id, tm.id)) : ""].join("|");
    return { kind: "team", mount: MOUNT.team, live: liveData(res), regions: [
      { id: "r-bar", html: barTeam(res, tm) },
      { id: "r-banner", html: bannerTeam(res, tm) },
      { id: "r-map", key: HOST.lang + "|" + res.key + "|" + APP.ui.zone + "|" + mapT, fn: () => planSVG(tm.t, res.mCur, mapT === "" ? res.T : mapT, APP.ui.zone, "m") },
      { id: "r-leg", key: "leg", fn: planLegend },
      { id: "r-zone", key: res.key + "|" + APP.ui.zone + "|" + ca, fn: () => zonePanel(res, tm) },
      { id: "r-tabs", html: tabsTeam(res, tm) },
      { id: "r-tab", key: res.key + "|" + APP.ui.tab + "|" + APP.ui.loan + "|" + APP.ui.repay + "|" + ca + (APP.ui.tab === "stand" ? "|" + Math.floor(res.T * 4) : ""), fn: () => tabBody(res, tm) },
      { id: "r-over", key: overKey, fn: () => dealTeam(res, tm) || soloHoldOverlay(res, tm) || finalOverlay(res, tm) },
      foot,
    ] };
  }
  if (APP.role === "screen") {
    const v = viewScreen(res), st2 = store();
    const sig = ck.hold && ck.hold.kind === "event" ? g.teams.map(x => JSON.stringify(st2.decisionOf(ck.hold.id, x.id) || "-")).join("") : "";
    return { kind: "screen", mount: MOUNT.screen, live: liveData(res), regions: [
      { id: "r-head", html: v.head },
      { id: "r-stage", key: [HOST.lang, res.key, ck.hold && ck.hold.id, g.status, g.lastReveal, g.reveal, sig, Math.floor(res.T * 4)].join("|"), fn: v.stage },
    ] };
  }
  if (APP.role === "gm") {
    if (APP.ui.gmNew) { const s = gmSetupHTML(); return { kind: "gm", mount: MOUNT.gm, live: null, regions: [{ id: "r-bar", html: gmBar() }, { id: "r-gm", key: s.key, html: s.html }, foot] }; }
    const html = viewGM(res);
    return { kind: "gm", mount: MOUNT.gm, live: liveData(res), regions: [{ id: "r-bar", html: gmBar() }, { id: "r-gm", key: html.replace(/data-live="(dealtimer|resumetimer)">[^<]*</g, ""), html }, foot] };
  }
  return { kind: "wait", mount: "", regions: [], live: null };
}
function liveText(kind, left) { return kind === "resume" ? L("Restarts by itself in ", "Bermula semula sendiri dalam ") + fmtTimer(left) : fmtTimer(left); }

/* =============================================================== automation (Game Master side and solo) */
function closeHold(res, h) {
  const st = store(), g = res.g, t = now(), mpm = g.msPerMonth;
  const p = { closed: { [h.id]: true }, accMs: h.t * mpm, startedAt: t };
  if (h.kind === "event") {
    const dec = {}; for (const tm of g.teams) dec[tm.id] = st.decisionOf(h.id, tm.id) || "L";
    Object.assign(p, { dec: { [h.id]: dec }, status: "paused", lastReveal: h.id, revealAt: t });
  } else if (h.kind === "end") Object.assign(p, { status: "ended", lastReveal: null });
  else Object.assign(p, { status: "running", lastReveal: null });
  return st.gmUpdate(p);
}
function autoTick(res, serverSide) {
  const st = store(); if (!st || !res) return; const g = res.g, ck = res.ck;
  const A = st._auto || (st._auto = { opened: {}, busy: false, lastHB: 0 });
  let isGM, isSolo;
  if (serverSide) { isGM = st.mode === "live"; isSolo = st.mode === "solo"; }
  else { isGM = (APP.role === "gm" || APP.role === "screen") && st.mode === "live" && APP.canEdit; isSolo = st.mode === "solo" && APP.role === "solo"; }
  if (!isGM && !isSolo) return;
  if (A.busy) return;
  const run = p => { A.busy = true; Promise.resolve(p).catch(e => toast(L("Could not update the game: ", "Permainan tidak dapat dikemas kini: ") + (e && e.message || e), "bad")).finally(() => { A.busy = false; }); };
  if (!serverSide && isGM && st.db && g.status === "running" && Date.now() - A.lastHB > 15000) { A.lastHB = Date.now(); run(st.gmUpdate({ hb: Date.now() })); return; }
  if (isSolo && g.fast && g.status !== "ended") {                      // ending early: every stop closes at once, deals as Leave
    if (ck.hold && ck.hold.kind !== "end") { run(closeHold(res, ck.hold)); return; }
    if (g.status === "paused" && !ck.hold) { run(st.gmUpdate({ status: "running", startedAt: now(), lastReveal: null })); return; }
  }
  if (ck.hold && ck.hold.kind === "event" && g.status === "running") {
    const h = ck.hold;
    if (!(g.openAt && g.openAt[h.id]) && !A.opened[h.id]) { A.opened[h.id] = true; run(st.gmUpdate({ openAt: { [h.id]: now() } })); return; }
    const left = (g.window || 90) * 1000 - (now() - ck.openAt);
    if (left <= 0 && (g.auto || isSolo)) { run(closeHold(res, h)); return; }
  }
  if (isGM && g.auto && g.lastReveal && g.status === "paused" && !ck.hold && now() - (g.revealAt || 0) > 15000) { run(st.gmUpdate({ status: "running", startedAt: now(), lastReveal: null })); return; }
  if (isSolo && ck.hold && ck.hold.kind === "end" && g.status !== "ended") { run(closeHold(res, ck.hold)); }
}

/* =============================================================== actions */
function currentRes() { return (store() && store().game) ? compute() : null; }
function newSolo(pace, level) {
  if (!APP.solo) APP.solo = MemStore("solo");
  APP.store = APP.solo; APP.ui.soloLevel = level || APP.ui.soloLevel || "rintis";
  const seed = newSeed();
  return APP.solo.gmSet({ gid: "solo-" + seed, seed, level: APP.ui.soloLevel, site: HOST.site || "corridor", teams: [{ id: "you", name: L("Your park", "Park anda") }], bench: ["garden", "bold", "rocket", "caretaker"], status: "setup", startedAt: 0, accMs: 0, msPerMonth: pace || 10000, window: 60, auto: true, closed: {}, dec: {}, openAt: {}, defence: { you: 11 }, reveal: true, lastReveal: null, created: Date.now() });
}
const ACT = {
  transcript(d) { const res = currentRes(); if (!res || !window.IMPAKDebrief) return; const tm = teamOf(res, d.team || APP.teamId || (res.teams.find(x => !x.bench) || {}).id); if (tm && tm.rub) window.IMPAKDebrief.open(res, tm, HOST.transcriptMeta ? HOST.transcriptMeta(tm) : {}); },
  home() { APP.role = null; APP.teamId = null; APP.store = APP.live; HOST.hash(""); },
  zone(d) { APP.ui.zone = d.z; },
  tab(d) { APP.ui.tab = d.k; if (HOST.remember) HOST.remember("tab", d.k); },
  step(d) {
    const k = d.k, v = +d.d;
    if (k === "loan") APP.ui.loan += v; else if (k === "repay") APP.ui.repay += v;
    else if (k === "su-n") { const s = APP.ui.setup; s.n = clamp(s.n + v, 1, 12); }
    else if (k === "su-cash") { const s = APP.ui.setup; s.cash = clamp((s.cash == null ? lvl(s.level).startCash : s.cash) + v, 0, 30); }
    else if (k.indexOf("def-") === 0) { const id = k.slice(4), g = game(); const res = currentRes(); const Dmax = res ? res.lv.score.D : 15; const cur = (g.defence || {})[id]; const nv = clamp((cur == null ? 10 : cur) + (cur == null ? 0 : v), 0, Dmax); store().gmUpdate({ defence: { [id]: nv } }); }
  },
  order(d) {
    const res = currentRes(); if (!res) return; const o = JSON.parse(d.o); const tm = teamOf(res, APP.teamId);
    const a = canAct(res); if (!a.ok) return toast(a.why, "bad");
    const v = PB.validate(tm.t, res.sc, o, res.mCur); if (!v.ok) return toast(whyL(v.why), "bad");
    Promise.resolve(store().placeOrder(APP.teamId, o, res.ck.T)).catch(e => toast(L("The order was not saved: ", "Arahan tidak disimpan: ") + (e && e.message || e) + L(". Try again.", ". Cuba lagi."), "bad"));
    toast(orderText(o));
  },
  decide(d) {
    const res = currentRes(); if (!res || !res.ck.hold || res.ck.hold.id !== d.eid) return;
    const val = d.zone ? { opt: d.opt, zone: d.zone } : d.opt;
    Promise.resolve(store().decide(APP.teamId, d.eid, val)).catch(e => toast(L("Your choice was not saved: ", "Pilihan anda tidak disimpan: ") + (e && e.message || e), "bad"));
  },
  "seen-reveal"() { APP.ui.seenReveal = game().lastReveal; },
  "seen-end"() { APP.ui.seenEnd = true; },
  "role-team"(d) { APP.store = APP.live; APP.role = "team"; APP.teamId = d.id; HOST.hash("team-" + d.id); },
  "role-screen"() { APP.store = APP.live; APP.role = "screen"; HOST.hash("screen"); },
  "role-gm"() { if (!APP.canEdit) return; APP.store = APP.live; APP.role = "gm"; HOST.hash("gm"); },
  "role-solo"(d) { APP.role = "solo"; APP.teamId = "you"; if (!APP.solo || !APP.solo.game || (d && d.level)) newSolo(10000, d && d.level); APP.store = APP.solo; HOST.hash("solo"); },
  "solo-start"() { store().gmUpdate({ status: "running", startedAt: now(), accMs: 0 }); },
  "solo-pause"() { const res = currentRes(); store().gmUpdate({ status: "paused", accMs: res.ck.T * res.g.msPerMonth }); },
  "solo-resume"() { store().gmUpdate({ status: "running", startedAt: now(), lastReveal: null }); },
  "solo-pace"(d) { const res = currentRes(), v = +d.v; store().gmUpdate({ msPerMonth: v, accMs: res.ck.T * v, startedAt: now() }); },
  "solo-close"() { const res = currentRes(); if (res && res.ck.hold && res.ck.hold.kind === "event") closeHold(res, res.ck.hold); },
  "solo-cont"() { const res = currentRes(); if (res && res.ck.hold) closeHold(res, res.ck.hold); },
  "solo-new"(d) { newSolo(game() ? game().msPerMonth : 10000, (d && d.level) || APP.ui.soloLevel); APP.ui.seenEnd = false; APP.ui.seenReveal = null; },
  /* leaving a practice game early (v0.6): fast-forward to the end, end at once, or delete */
  "solo-end-fast"() {
    const res = currentRes(); if (!res || res.g.status === "ended" || res.g.status === "setup") return;
    const left = Math.max(1, res.sc.months - res.ck.T), mpm = clamp(Math.round(30000 / left), 250, 800);
    APP.ui.seenEnd = false; APP.ui.seenReveal = null;
    store().gmUpdate({ fast: true, endedEarly: res.g.endedEarly || res.mCur, msPerMonth: mpm, accMs: res.ck.T * mpm, startedAt: now(), status: "running", lastReveal: null });
  },
  "solo-end-now"() {
    const res = currentRes(); if (!res || res.g.status === "ended") return;
    const closed = {}; for (const p of pausePoints(res.sc)) closed[p.id] = true;
    APP.ui.seenEnd = false; APP.ui.seenReveal = null;
    store().gmUpdate({ status: "ended", closed, lastReveal: null, accMs: res.sc.months * res.g.msPerMonth, endedEarly: res.g.endedEarly || (res.g.status === "setup" ? 1 : res.mCur), fast: false });
  },
  "solo-delete"() { if (APP.solo) APP.solo.gmSet(null); },
  "su-level"(d) { const s = APP.ui.setup; s.level = d.level; s.pace = LEVEL_TEXT[d.level].pace; s.cash = lvl(d.level).startCash; },
  "su-site"(d) { if (d.site === "corridor" || d.site === "valley") APP.ui.setup.site = d.site; },
  "su-seed"() { APP.ui.setup.seed = newSeed(); APP.ui.setupNonce = (APP.ui.setupNonce || 0) + 1; },
  "su-bench"(d, el) { const s = APP.ui.setup; const on = !!(el && el.checked); s.bench = s.bench.filter(k => k !== d.k); if (on) s.bench.push(d.k); },
  "su-pace"(d) { APP.ui.setup.pace = +d.v; },
  "su-win"(d) { APP.ui.setup.window = +d.v; },
  "su-auto"(d, el) { APP.ui.setup.auto = !!(el && el.checked); },
  "su-benchview"(d, el) { APP.ui.setup.benchView = el && el.checked ? "lag" : "end"; },
  "gm-create"() {
    const s = APP.ui.setup; const seed = (s.seed || "").trim().replace(/[^A-Za-z0-9_.~:@+-]/g, "-") || newSeed();
    const teams = []; for (let i = 0; i < s.n; i++) teams.push({ id: "t" + (i + 1), name: (s.names[i] || "Team " + (i + 1)).trim().slice(0, 24) || "Team " + (i + 1) });
    const g = { gid: seed + "-" + rid(4), seed, startCash: s.cash != null ? s.cash : lvl(s.level || "lestari").startCash, level: s.level || "lestari", site: s.site || HOST.site || "corridor", teams, bench: s.bench.slice(), benchView: s.benchView === "end" ? "end" : "lag", status: "setup", startedAt: 0, accMs: 0, msPerMonth: s.pace, window: s.window, auto: s.auto,
      closed: {}, dec: {}, openAt: {}, defence: {}, reveal: false, lastReveal: null, revealAt: 0, hb: Date.now(), createdAt: Date.now() };
    APP.ui.gmNew = false; APP.ui.confirmNew = false;
    Promise.resolve(store().gmSet(g)).then(() => toast(L("Game created. Start the clock when the teams are ready.", "Permainan dicipta. Mulakan jam apabila pasukan sudah bersedia.")), e => toast(L("Could not create the game: ", "Permainan tidak dapat dicipta: ") + (e && e.message || e), "bad"));
  },
  "gm-cancel-new"() { APP.ui.gmNew = false; },
  "gm-start"() { store().gmUpdate({ status: "running", startedAt: now(), accMs: 0, hb: Date.now() }); },
  "gm-pause"() { const res = currentRes(); store().gmUpdate({ status: "paused", accMs: res.ck.T * res.g.msPerMonth }); },
  "gm-resume"() { store().gmUpdate({ status: "running", startedAt: now(), lastReveal: null, hb: Date.now() }); },
  "gm-pace"(d) { const res = currentRes(), v = +d.v; store().gmUpdate({ msPerMonth: v, accMs: res.ck.T * v, startedAt: now() }); },
  "gm-auto"() { store().gmUpdate({ auto: !game().auto }); },
  "gm-benchview"() { store().gmUpdate({ benchView: game().benchView === "end" ? "lag" : "end" }); },
  "gm-end-ask"() { APP.ui.confirmEnd = true; },
  "gm-end-no"() { APP.ui.confirmEnd = false; },
  "gm-end-yes"() { APP.ui.confirmEnd = false; const res = currentRes(); if (!res) return; const closed = {}; for (const p of pausePoints(res.sc)) closed[p.id] = true; store().gmUpdate({ status: "ended", closed, lastReveal: null, accMs: res.sc.months * res.g.msPerMonth }); },
  "gm-close"() { const res = currentRes(); if (res.ck.hold && res.ck.hold.kind === "event") closeHold(res, res.ck.hold); },
  "gm-extend"() { const res = currentRes(); const h = res.ck.hold; if (h) store().gmUpdate({ openAt: { [h.id]: res.ck.openAt + 30000 } }); },
  "gm-cont"() { const res = currentRes(); if (res.ck.hold) closeHold(res, res.ck.hold); },
  "gm-finish"() { const res = currentRes(); if (res.ck.hold && res.ck.hold.kind === "end") closeHold(res, res.ck.hold); },
  "gm-notice"() { const txt = String(APP.ui.notice || "").trim().slice(0, 160); store().gmUpdate({ notice: txt ? { text: txt, at: Date.now() } : null }); APP.ui.notice = ""; APP.ui.noticeNonce = (APP.ui.noticeNonce || 0) + 1; },
  "gm-notice-clear"() { store().gmUpdate({ notice: null }); },
  "gm-reveal"() { store().gmUpdate({ reveal: !game().reveal }); },
  "gm-new"() { APP.ui.confirmNew = true; },
  "gm-new-no"() { APP.ui.confirmNew = false; },
  "gm-new-yes"() { APP.ui.confirmNew = false; APP.ui.gmNew = true; APP.ui.setup = null; },
  "gm-purge"() {
    const st = store(); if (!st.purgeOld) return; APP.ui.purge = L("Deleting…", "Memadam…");
    st.purgeOld(n => { APP.ui.purge = L("Deleted ", "Dipadam ") + n + "…"; }).then(n => { APP.ui.purge = n ? L("Deleted " + n + " records from earlier games.", n + " rekod daripada permainan terdahulu dipadam.") : L("Nothing to delete.", "Tiada apa-apa untuk dipadam."); }, e => { APP.ui.purge = L("Stopped: ", "Dihentikan: ") + (e && e.message || e); });
  },
  "gm-export"() { const res = currentRes(); HOST.save("impak-" + res.g.gid + ".csv", resultsCSV(res)); },
  "gm-log"() { const res = currentRes(); const g = res.g; const out = { game: g, orders: {}, decisions: {} }; for (const t of g.teams) out.orders[t.id] = store().ordersFor(t.id); HOST.save("impak-" + g.gid + "-log.json", JSON.stringify(out, null, 1)); },
};
function dispatch(name, data, el) { const f = HOST.act[name] || ACT[name]; if (!f) return false; f(data || {}, el); return true; }
function onInput(field, i, value) {
  if (field === "notice") { APP.ui.notice = value; return; }
  if (!APP.ui.setup) return;
  if (field === "seed") APP.ui.setup.seed = value;
  if (field === "name") APP.ui.setup.names[+i] = value;
}
function resultsCSV(res) {
  const q = v => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const L = [["Park", "Level", "A", "B1", "B2", "B3", "C", "D", "E", "Total", "Medal", "Park score", "Impact", "Verified impact", "ESG", "FCR12", "Drift", "Bailouts", "Receivership", "Dare index", "Sound share", "Jobs", "Interns/yr", "Firms", "Alumni-founded", "University-linked share", "Economic impact Cr/yr"].join(",")];
  for (const x of res.teams) { if (x.bench || !x.rub) continue; const r = x.rub, so = PB.socio(x.t); L.push([x.name, res.sc.level, r.A, r.B1, r.B2, r.B3, r.C, r.D, r.E, r.total, r.medal, r.park.score, r.park.ip, x.t.ipv, x.t.esg, r.park.fcr, r.park.drift, x.t.bailouts, x.t.receiver ? "yes" : "no", r.dare, r.soundShare, so.jobs, so.interns, so.firms, so.alumni, so.uniShare, so.econ].map(v => typeof v === "number" ? Math.round(v * 100) / 100 : v).map(q).join(",")); }
  L.push(""); const evs = res.sc.events;
  L.push(["Park"].concat(evs.map(e => e.id + " " + CARDS[e.card].title + (res.lv.dice ? " (die " + e.deal + ")" : ""))).map(q).join(","));
  for (const x of res.teams) { if (x.bench) continue; L.push([x.name].concat(evs.map(e => { const d = x.t.dlog.find(y => y.eid === e.id); return d ? (d.eligible ? d.opt + (d.site ? "/" + d.site : "") + (d.sound ? "" : " (unsound)") : "n/a") : ""; })).map(q).join(",")); }
  return L.join("\n");
}

const CORE = { BRAND, HOST, PB, AI, C, CARDS, esc, n1, n0, sg1, pc, clamp, mname, planSVG, planLegend, SITES, brandHTML, lvl, lvLabel, LEVEL_KEYS, LEVEL_TEXT, levelAcres, yearsWord,
  /* v0.6 shell pieces */ aiRec, L, whyL, cardL, noteL, tenL, workL, esgWhyL, MEDALN, mnameL, barTeam, bannerTeam, coachTips, coachHTML, zonePanel, tabsTeam, tabBody, tabApps, tabPark, tabImpact, tabMoney, tabFac, tabNews, tabStand, RULES_HTML, dealTeam, soloHoldOverlay, finalOverlay,
  apDots, nextAPMonth, levelChip, phaseChip, statusChip, phaseName, partLabel, parts, partBars, radarSVG, resultCharts, breakdown, compareTo, leaderboard, ceremony, viewScreen, viewGM, gmSetupHTML, closeHold, newSolo, currentRes, store, game, now, toast, ZSHORT, ztext, orderText, dateParts, MOUNT,
  MemStore, newCtx, withCtx, scenG, compute, buildFrame, resultsCSV, teamOf, canAct, sortedTeams, liveData, liveText, autoTick, dispatch, onInput, ACT, scen, clockOf, pausePoints, newSeed, rid, deepMerge, dateParts, fmtTimer,
  get APP() { return APP; }, set APP(v) { APP = v; } };
if (IS_NODE) { module.exports = CORE; return; }
root.IMPAK = CORE;
})(typeof window !== "undefined" ? window : globalThis);
