/* SPDX-License-Identifier: MIT
   Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia */
/* IMPAK v0.6 — decision advice in the Deal Room and the decision journal.
   Texts come from content/LESSONS (CC BY-NC-ND); this file computes the figures each lesson refers to.
   Before a decision: what to check and the risk of each option (Rintis and Bina show the current figures and
   whether they meet the rule of thumb; Lestari shows the questions only). After the deal closes: sound or not,
   the principle, and what to watch next. Nothing here changes the engine or the score. */
(function (root) {
'use strict';
const PB = root.PB, C = PB.CFG;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pc = (v) => Math.round((v || 0) * 100) + '%';
const n1 = (v) => (Math.round((+v || 0) * 10) / 10).toFixed(1);

/* each check: label (en, ms), the value now, the target, and whether the value meets it */
const CHECKS = {
  occ: { en: 'Occupancy now', ms: 'Penghunian sekarang', target: '≥ 80%', v: (t) => PB.occupancy(t), f: pc, ok: (x) => x >= C.SPEC.gateOcc },
  fund: { en: 'Development Fund left', ms: 'Baki Development Fund', target: '≥ 9.6 Cr', v: (t) => t.fund, f: (x) => n1(x) + ' Cr', ok: (x) => x >= 9.6 },
  drift2: { en: 'Drift with 2 more unlinked units', ms: 'Drift jika tambah 2 unit unlinked', target: '≤ 50%', v: (t) => PB.driftOf(t, 2, 2), f: pc, ok: (x) => x <= 0.5 },
  drift3: { en: 'Drift with 3 more unlinked units', ms: 'Drift jika tambah 3 unit unlinked', target: '≤ 50%', v: (t) => PB.driftOf(t, 3, 3), f: pc, ok: (x) => x <= 0.5 },
  drift4: { en: 'Drift with 4 more unlinked units', ms: 'Drift jika tambah 4 unit unlinked', target: '≤ 50%', v: (t) => PB.driftOf(t, 4, 4), f: pc, ok: (x) => x <= 0.5 },
  esg2: { en: 'ESG after −2', ms: 'ESG selepas −2', target: '≥ 0', v: (t) => t.esg + C.ESG.dcOffered, f: (x) => (x >= 0 ? '+' : '') + n1(x), ok: (x) => x >= 0 },
  esg1: { en: 'ESG after −1', ms: 'ESG selepas −1', target: '≥ 0', v: (t) => t.esg + C.ESG.chemC, f: (x) => (x >= 0 ? '+' : '') + n1(x), ok: (x) => x >= 0 },
  esgRecord: { en: 'ESG now', ms: 'ESG sekarang', target: '≥ 2', v: (t) => t.esg, f: (x) => (x >= 0 ? '+' : '') + n1(x), ok: (x) => x >= 2 },
  plotD: { en: 'Free plots in Zone D', ms: 'Plot kosong di Zon D', target: '≥ 1', v: (t, m) => PB.plotsFree(t, 'D', m), f: String, ok: (x) => x >= 1 },
  linked: { en: 'Linked tenants', ms: 'Penyewa linked', target: '≥ 2 (Take) · ≥ 1 (Conditions)', v: (t) => PB.linkedCount(t), f: String, ok: (x) => x >= 2 },
  lowground: { en: 'Buildings in Zones E and G', ms: 'Bangunan di Zon E dan G', target: '0 → Leave is safe', v: (t) => t.buildings.filter((b) => (b.zone === 'E' || b.zone === 'G') && b.status !== 'shed').length, f: String, ok: (x) => x === 0 },
  fibre: { en: 'Zones with fibre', ms: 'Zon yang ada fibre', target: '—', v: (t) => Object.keys(t.zones).filter((z) => t.zones[z].svc.fibre >= 1).length, f: String, ok: () => null },
  lab: { en: 'Lab or Lab Access (for Conditions)', ms: 'Lab atau Lab Access (untuk Conditions)', target: 'yes', v: (t) => !!(t.fac.lab || t.fac.labaccess), f: (x) => (x ? '✓' : '✗'), ok: (x) => x },
  cash: { en: 'Cash', ms: 'Tunai', target: '—', v: (t) => t.cash, f: (x) => n1(x) + ' Cr', ok: () => null },
  conc: { en: 'Share of your units in the new building', ms: 'Bahagian unit anda dalam bangunan baharu', target: '≤ 40%', v: (t) => 6 / (t.buildings.filter((b) => b.status === 'ready' || b.status === 'building').reduce((a, b) => a + b.units, 0) + 6), f: pc, ok: (x) => x <= 0.4 },
  anchorShare: { en: 'Anchors\' share of committed income', ms: 'Bahagian anchor dalam committed income', target: '≤ 30% → you can refuse', v: (t) => t.tenants.filter((x) => x.type === 'anchor' || x.type === 'bigAnchor').reduce((a, x) => a + C.TEN[x.type].rent, 0) / Math.max(0.1, PB.committedIncome(t)), f: pc, ok: (x) => x <= 0.3 },
  debt: { en: 'Debt (loans + emergency)', ms: 'Hutang (pinjaman + kecemasan)', target: '≥ 5 Cr → fix the rate', v: (t) => t.debt + t.emerg, f: (x) => n1(x) + ' Cr', ok: (x) => x >= 5 },
  cash2: { en: 'Cash', ms: 'Tunai', target: '≥ 2 Cr', v: (t) => t.cash, f: (x) => n1(x) + ' Cr', ok: (x) => x >= 2 },
  gpark: { en: 'Zone G is a retention park', ms: 'Zon G ialah retention park', target: 'yes → Leave is safe', v: (t) => t.zones.G.mode === 'park', f: (x) => (x ? '✓' : '✗'), ok: (x) => x },
  incub: { en: 'Incubator set up', ms: 'Incubator disediakan', target: 'yes', v: (t) => !!t.fac.incubator, f: (x) => (x ? '✓' : '✗'), ok: (x) => x },
  freeTech: { en: 'Free units with fibre', ms: 'Unit kosong dengan fibre', target: '≥ 2', v: (t) => t.buildings.filter((b) => b.status === 'ready' && t.zones[b.zone] && t.zones[b.zone].svc.fibre >= 1).reduce((a, b) => a + PB.freeUnits(t, b), 0), f: String, ok: (x) => x >= 2 },
};
const OPT = { en: { T: 'Take', C: 'Conditions', L: 'Leave' }, ms: { T: 'Take', C: 'Conditions', L: 'Leave' } };
const TXT = {
  en: { before: 'Think it through', checks: 'What this decision depends on', now: 'now', target: 'rule of thumb', risks: 'Risk of each option', noDice: 'In Rintis every counterparty accepts your conditions; the die notes apply from Bina on.', lestari: 'Lestari shows the questions, not the answers: read your figures in the tiles and the Money group.',
    after: 'Lesson', sound: 'Sound decision', unsound: 'Not a sound decision', principle: 'Principle', watch: 'Watch next', journal: 'Decision journal', journalEmpty: 'Your Deal Room decisions and their lessons appear here.', soundCount: '{s} of {n} sound', na: 'did not apply' },
  ms: { before: 'Fikir dahulu', checks: 'Keputusan ini bergantung pada', now: 'sekarang', target: 'panduan', risks: 'Risiko setiap pilihan', noDice: 'Dalam Rintis setiap pihak menerima syarat anda; nota dadu terpakai mulai Bina.', lestari: 'Lestari hanya memaparkan soalan, bukan jawapan: baca angka anda pada tiles dan kumpulan Kewangan.',
    after: 'Pelajaran', sound: 'Keputusan wajar', unsound: 'Keputusan kurang wajar', principle: 'Prinsip', watch: 'Perhatikan seterusnya', journal: 'Jurnal keputusan', journalEmpty: 'Keputusan Deal Room anda dan pelajarannya akan dipaparkan di sini.', soundCount: '{s} daripada {n} wajar', na: 'tidak terpakai' },
};
const lang = () => (root.IMPAK && root.IMPAK.HOST.lang === 'ms' ? 'ms' : 'en');
const tx = (k, p) => { let s = TXT[lang()][k]; if (p) for (const x in p) s = s.split('{' + x + '}').join(p[x]); return s; };
const lessonOf = (card) => (root.LESSONS || {})[card];

function checksHTML(L, t, m, showValues) {
  if (!L.checks.length) return '';
  const rows = L.checks.map((id) => {
    const c = CHECKS[id]; if (!c) return '';
    let val = '', mark = '';
    if (showValues) { const x = c.v(t, m), ok = c.ok(x); val = '<b>' + esc(c.f(x)) + '</b>'; mark = ok === null ? '' : (ok ? '<i class="ok">✓</i>' : '<i class="no">!</i>'); }
    return '<li>' + mark + '<span>' + esc(c[lang()]) + (val ? ': ' + val : '') + ' <small>· ' + esc(tx('target')) + ' ' + esc(c.target) + '</small></span></li>';
  }).join('');
  return '<div class="adv-sub">' + esc(tx('checks')) + '</div><ul class="adv-checks">' + rows + '</ul>';
}
/* before the decision, inside the Deal Room card */
function before(res, tm, ev) {
  const L = lessonOf(ev.card); if (!L) return '';
  const T = L[lang()], t = tm.t, m = res.mCur, lv = res.lv;
  const show = lv.key !== 'lestari';
  const Cd = PB.CARDS[ev.card];
  const risks = ['T', 'C', 'L'].filter((k) => Cd[k] && T.risk[k]).map((k) => '<li><b>' + OPT[lang()][k] + '</b> — ' + esc(T.risk[k]) + '</li>').join('');
  return '<details class="advice"><summary>' + esc(tx('before')) + '</summary>' + checksHTML(L, t, m, show) +
    '<div class="adv-sub">' + esc(tx('risks')) + '</div><ul class="adv-risks">' + risks + '</ul>' +
    (!lv.dice ? '<p class="adv-note">' + esc(tx('noDice')) + '</p>' : '') + (!show ? '<p class="adv-note">' + esc(tx('lestari')) + '</p>' : '') + '</details>';
}
/* after the deal closes, on the outcome card */
function after(res, tm, ev) {
  const L = lessonOf(ev.card); if (!L) return '';
  const T = L[lang()], d = tm.t.dlog.find((x) => x.eid === ev.id);
  if (!d || !d.eligible) return '';
  return '<div class="advice after ' + (d.sound ? 'is-sound' : 'is-unsound') + '"><div class="adv-verdict">' + (d.sound ? '✓ ' : '✗ ') + esc(tx(d.sound ? 'sound' : 'unsound')) + ' · ' + esc(OPT[lang()][d.opt]) + '</div>' +
    '<p><b>' + esc(tx('principle')) + ':</b> ' + esc(T.principle) + '</p><p><b>' + esc(tx('watch')) + ':</b> ' + esc(T.watch) + '</p></div>';
}
/* the journal in the Guide panel */
function journal(res, tm) {
  const list = tm.t.dlog.filter((d) => d.eligible || d.opt === null);
  if (!list.length) return '<p class="faint">' + esc(tx('journalEmpty')) + '</p>';
  const el = list.filter((d) => d.eligible), s = el.filter((d) => d.sound).length;
  return '<p class="adv-sum">' + esc(tx('soundCount', { s, n: el.length })) + '</p><ol class="journal">' + list.map((d) => {
    const Cd = PB.CARDS[d.card], L = lessonOf(d.card), T = L ? L[lang()] : null, ev = res.sc.events.find((e) => e.id === d.eid);
    const when = ev && root.IMPAK ? root.IMPAK.mnameL(ev.month) : '';
    if (!d.eligible) return '<li class="na"><b>' + esc(Cd.title) + '</b> <small>' + esc(when) + ' · ' + esc(tx('na')) + '</small></li>';
    return '<li class="' + (d.sound ? 'ok' : 'no') + '"><b>' + esc(Cd.title) + '</b> <small>' + esc(when) + ' · ' + esc(OPT[lang()][d.opt]) + (d.site ? ' · Zone ' + esc(d.site) : '') + '</small>' +
      '<div class="jv">' + (d.sound ? '✓ ' : '✗ ') + esc(tx(d.sound ? 'sound' : 'unsound')) + '</div>' + (T ? '<div class="jp">' + esc(T.principle) + '</div><div class="jw"><b>' + esc(tx('watch')) + ':</b> ' + esc(T.watch) + '</div>' : '') + '</li>';
  }).join('') + '</ol>';
}
root.IMPAKAdvice = { before, after, journal, CHECKS, title: () => tx('journal') };
})(typeof window !== 'undefined' ? window : globalThis);
