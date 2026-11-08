// SPDX-License-Identifier: MIT
/* IMPAK v0.6 — learning from the benchmark parks.
   Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia.

   The benchmark parks are scripted strategies (src/strategies.js) playing the same seed as the teams. This module
   shows what they did and why it scores; it reads their recorded orders (game.js aiRec) and replayed states and
   never changes the engine.
   - News tab: follow a benchmark. Its moves by quarter, one quarter late, with the principle behind each kind of
     move (content/moves.js) the first time it makes one, and its Deal Room choices with the verdict.
   - Standings tab, "Learn from the benchmarks": impact over time (you against one benchmark, its key moves marked),
     where each park's impact comes from now, the benchmark's plan, and year-end milestones.
   - After each deal: the benchmarks' choices. After the game: how the leading benchmark built its park (also in
     the transcript).
   In a live game the Game Master may keep the benchmarks' moves hidden until the final bell (g.benchView = 'end'). */
(function (root) {
'use strict';
const PB = root.PB, C = PB.CFG;
const G = () => root.IMPAK;
const lang = () => (G() && G().HOST.lang === 'ms' ? 'ms' : 'en');
const L = (en, ms) => (lang() === 'ms' ? ms : en);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = (v) => Math.round((+v || 0) * 10) / 10;
const n1 = (v) => r1(v).toFixed(1).replace(/^-(?=\d*[1-9])/, '−').replace(/^-/, '');
const sg1 = (v) => (r1(v) > 0 ? '+' : '') + n1(v);
const MV = () => root.IMPAK_MOVES || { PROFILES: {}, PRINCIPLES: {} };
const OPT = { T: 'Take', C: 'Conditions', L: 'Leave' };
const mname = (m) => G().mnameL(m);
const keyOf = (x) => String(x.id).replace(/^ai-/, '');
const profile = (key) => { const P = MV().PROFILES[key]; return P ? P[lang()] : null; };
const principle = (k) => { const P = MV().PRINCIPLES[k]; return P ? P[lang()] : ''; };
const zoneW = (z) => L('Zone ', 'Zon ') + z;
const youName = (tm) => (tm.id === 'you' ? L('Your park', 'Park anda') : tm.name);

/* ------------------------------------------------------------------ what may be shown, and when */
/* 'all' after the final bell; 'end' in a live game whose Game Master hides the benchmarks until then; otherwise 'lag' */
function view(res) {
  if (res.final) return 'all';
  const st = G().store();
  return st && st.mode === 'live' && res.g.benchView === 'end' ? 'end' : 'lag';
}
/* the last month whose moves may be shown: the end of the quarter before the current one */
function cutoff(res) { const v = view(res); return v === 'all' ? res.months : (v === 'end' ? 0 : 3 * Math.floor((res.mCur - 1) / 3)); }
function lagLine(res, upTo) {
  if (view(res) === 'all') return L('The game is over: every move is shown.', 'Permainan sudah tamat: semua langkah dipaparkan.');
  if (upTo < 3) return L('Benchmark news arrives one quarter late. The first report comes in ' + mname(4) + '.', 'Berita benchmark tiba lewat satu suku tahun. Laporan pertama tiba pada ' + mname(4) + '.');
  return L('Benchmark news arrives one quarter late: shown up to the end of ' + mname(upTo) + '.', 'Berita benchmark tiba lewat satu suku tahun: dipaparkan sehingga hujung ' + mname(upTo) + '.');
}
const HIDDEN = () => L('The Game Master will reveal the benchmark parks\' moves and deal choices at the final bell. Until then, learn from your own news and the Deal Room lessons.',
  'Game Master akan mendedahkan langkah dan pilihan deal park benchmark pada loceng akhir. Sementara itu, belajar daripada berita park anda sendiri dan pelajaran dalam Deal Room.');

/* ------------------------------------------------------------------ the benchmarks' records */
function benches(res) { return res.teams.filter((x) => x.bench); }
function chosen(res) {
  const B = benches(res); if (!B.length) return null;
  const want = G().APP.ui.benchSel;
  return B.find((x) => x.id === want) || B.slice().sort((a, b) => (a.rub && b.rub ? b.rub.total - a.rub.total : b.ps.score - a.ps.score))[0];
}
const rec = (res, key) => G().aiRec(res.g.seed, res.g.level || 'lestari', key, res.sc);
/* a benchmark's state at the end of month upTo (cached per scenario; the final state comes from compute()) */
const AT = new WeakMap();
function stateAt(res, key, upTo) {
  if (res.final && upTo >= res.months) { const x = res.teams.find((y) => y.id === 'ai-' + key); if (x) return x.t; }
  let c = AT.get(res.sc); if (!c) { c = new Map(); AT.set(res.sc, c); }
  const k = key + '|' + upTo; if (c.has(k)) return c.get(k);
  const r = rec(res, key), t = PB.replay(res.sc, r.label, r.policy, r.log, r.dec, null, upTo);
  c.set(k, t); return t;
}
/* its orders as applied, month by month, up to month upTo */
function movesOf(res, key, upTo) {
  const out = [];
  for (const o of rec(res, key).log) { const m = Math.floor(o.t) + 1; if (m > upTo) break; out.push(Object.assign({ m }, o)); }
  return out;
}
const TEN_KEY = (ten) => (ten === 'anchor' || ten === 'bigAnchor' ? 'anchor' : (ten === 'startup' ? 'startup' : (C.TEN[ten] && !C.TEN[ten].linked ? 'unlinked' : 'linked')));
/* what an order was: category, principle key, words, and whether it is a key move (marked on the chart) */
function info(o) {
  const I = G();
  switch (o.type) {
    case 'work': return { cat: 'build', key: o.kind === 'fibre' ? 'fibre' : (/^(road|roadHalf|water|power|powerShared)$/.test(o.kind) ? 'svc' : o.kind), text: I.workL(o.kind) + ' · ' + zoneW(o.zone), big: true };
    case 'build': return o.kind === 'retrofit' ? { cat: 'build', key: 'retrofit', text: 'Retrofit ' + o.bid, big: true }
      : { cat: 'build', key: o.kind, text: (C.BUILD[o.kind] ? C.BUILD[o.kind].label : o.kind) + ' · ' + zoneW(o.zone), big: true };
    case 'facility': return { cat: 'fac', key: 'f_' + o.kind, text: C.FAC[o.kind].label, big: true };
    case 'cancel': return { cat: 'fac', key: 'cancel', text: C.FAC[o.kind].label + L(' closed', ' ditutup'), big: true };
    case 'admit': return { cat: 'ten', key: TEN_KEY(o.ten) };
    case 'loan': return { cat: 'money', key: 'loan' };
    case 'repay': return { cat: 'money', key: 'repay' };
    case 'programme': return { cat: 'money', key: 'programme', text: L('Innovation programmes set to ' + o.level + ' Cr a year', 'Innovation programmes ditetapkan pada ' + o.level + ' Cr setahun') };
    case 'reserve': return { cat: 'land', key: 'reserve', text: L('A Zone H plot reserved for a named future user', 'Satu plot Zon H dirizabkan untuk pengguna masa depan yang dinamakan'), big: true };
    case 'declare': return o.zone === 'F' ? { cat: 'land', key: 'buffer', text: L('Forest Ridge declared a green buffer', 'Forest Ridge diisytiharkan green buffer'), big: true }
      : { cat: 'land', key: 'park', text: L('The Wetland made a retention park', 'Wetland dijadikan retention park'), big: true };
    case 'reneg': return { cat: 'money', key: 'reneg', text: L('Back-office rents renegotiated to 70% for 12 months', 'Sewa back-office dirunding semula kepada 70% selama 12 bulan') };
    case 'leaseback': return { cat: 'money', key: 'leaseback', text: o.bid + L(' sold and leased back', ' dijual dan disewa semula'), big: true };
    case 'policy': return { cat: 'money', key: 'policy', text: L('Admission policy changed to ', 'Polisi kemasukan ditukar kepada ') + o.policy };
    case 'moth': return { cat: 'build', key: 'moth', text: L(o.bid + ' mothballed', o.bid + ' di-mothball') };
    case 'unmoth': return { cat: 'build', key: 'moth', text: L(o.bid + ' reopened', o.bid + ' dibuka semula') };
  }
  return { cat: 'money', key: o.type, text: o.type };
}
const CAT = () => ({ build: L('Build', 'Bina'), fac: L('Facility', 'Kemudahan'), ten: L('Tenants', 'Penyewa'), money: L('Money', 'Kewangan'), land: L('Land', 'Tanah'), deal: 'Deal' });
/* its Deal Room decisions up to month upTo, from the replayed state */
function dealsOf(res, st, upTo) {
  const out = [];
  for (const d of st.dlog) { if (!d.eligible) continue; const ev = res.sc.events.find((e) => e.id === d.eid); if (ev && ev.month <= upTo) out.push(Object.assign({ m: ev.month }, d)); }
  return out;
}
const vMark = (d) => (d.sound ? (d.credit < 1 ? '½' : '✓') : '✗');
const vWord = (d) => (d.sound ? (d.credit < 1 ? L('sound, but an opportunity was left', 'wajar, tetapi peluang dilepaskan') : L('sound', 'wajar')) : L('not sound', 'kurang wajar'));
const lessonOf = (card) => { const Ls = (root.LESSONS || {})[card]; return Ls ? Ls[lang()].principle : ''; };
const titleOf = (card) => G().cardL(card, 'title');

/* ------------------------------------------------------------------ where impact comes from (the engine's own sum, read-only) */
function engine(t) {
  const lin = PB.linkedCount(t); let ten = 0, zc = 0;
  for (const x of t.tenants) {
    const T = C.TEN[x.type]; if (!T) continue; ten += T.ip;
    const b = t.buildings.find((y) => y.id === x.bid); if (T.linked && b && b.zone === 'C') zc += C.ZONES.C.linkedBonus || 0;
  }
  const lease = t.leases.reduce((a, l) => a + (l.ip || 0), 0), su = C.STARTUP.ip * t.startups.length;
  let fac = 0;
  if (t.fac.lab) fac += lin >= 3 ? 2 : (lin >= 1 ? 1 : 0);
  if (t.fac.labaccess && lin >= 2) fac += 1;
  if (t.fac.liaison && lin >= 2) fac += 1;
  if (t.fac.covenant) fac += Math.floor(0.5 * lin);
  if (t.flags.donor && lin >= 2) fac += 1;
  const land = (t.zones.F && t.zones.F.mode === 'buffer' ? 1 : 0) + (t.zones.G && t.zones.G.mode === 'park' ? 1 : 0);
  const prog = C.PROG.ipPerCr * (t.prog || 0);
  const rows = { ten, zc, lease, su, fac, land, prog };
  const gross = t.receiver ? 0 : ten + zc + lease + su + fac + land + prog;
  return { rows, gross, kpi: !!t.fac.kpi, counted: t.fac.kpi ? gross : gross / 2, receiver: !!t.receiver };
}
const SRC = () => [['ten', L('Tenants', 'Penyewa')], ['zc', L('Linked tenants in Zone C (+1 each)', 'Penyewa linked di Zon C (+1 setiap satu)')], ['lease', 'Ground lease'], ['su', 'Startup'],
  ['fac', L('Facilities', 'Kemudahan')], ['land', L('Green buffer and retention park', 'Green buffer dan retention park')], ['prog', 'Innovation programmes']];
function diffLine(a, b) {
  const d = SRC().map(([k, lab]) => ({ lab, d: b.rows[k] - a.rows[k] })).filter((z) => z.d > 0.05).sort((p, q) => q.d - p.d).slice(0, 2);
  const out = [];
  if (d.length) out.push(L('The biggest differences: ', 'Beza terbesar: ') + d.map((z) => z.lab + ' (' + sg1(z.d) + L(' a year', ' setahun') + ')').join(L(' and ', ' dan ')) + '.');
  if (b.kpi && !a.kpi && !a.receiver) out.push(L('Your impact counts half until KPI & Impact Reporting runs.', 'Impact anda hanya dikira separuh selagi KPI & Impact Reporting belum berjalan.'));
  return out.join(' ');
}
function insight(a, b, name) {
  if (b.counted > a.counted + 0.05) return L(name + ' adds ' + n1(b.counted - a.counted) + ' more impact a year than you. ', name + ' menambah ' + n1(b.counted - a.counted) + ' impact setahun lebih banyak daripada anda. ') + diffLine(a, b);
  return L('Your park adds at least as much impact a year as ' + name + '. Keep it growing.', 'Park anda menambah impact setahun sekurang-kurangnya sama banyak dengan ' + name + '. Teruskan.');
}
function engineHTML(res, tm, x, upTo) {
  const a = engine(tm.t), b = engine(stateAt(res, keyOf(x), upTo));
  const rows = SRC().filter(([k]) => a.rows[k] > 0.001 || b.rows[k] > 0.001);
  const cnt = (e) => (e.receiver ? 'receivership' : (e.kpi ? '× 1' : '× ½')) + ' = ' + n1(e.counted);
  const when = view(res) === 'lag' ? '<br><small>' + esc(L('end of ', 'hujung ') + mname(upTo)) + '</small>' : '';
  let h = '<div class="scroll-x"><table class="tbl bl-eng"><thead><tr><th>' + esc(L('Impact a year, by source', 'Impact setahun, mengikut sumber')) + '</th><th class="r">' + esc(youName(tm)) + '<br><small>' + esc(L('now', 'sekarang')) + '</small></th><th class="r">' + esc(x.name) + when + '</th></tr></thead><tbody>';
  for (const [k, lab] of rows) h += '<tr><td>' + esc(lab) + '</td><td class="r mono">' + n1(a.rows[k]) + '</td><td class="r mono">' + n1(b.rows[k]) + '</td></tr>';
  h += '<tr class="tot"><td>' + esc(L('Total a year', 'Jumlah setahun')) + '</td><td class="r mono">' + n1(a.gross) + '</td><td class="r mono">' + n1(b.gross) + '</td></tr>';
  h += '<tr><td>' + esc(L('Counted: in full with KPI & Impact Reporting, half without it', 'Dikira: penuh dengan KPI & Impact Reporting, separuh tanpanya')) + '</td><td class="r mono">' + cnt(a) + '</td><td class="r mono">' + cnt(b) + '</td></tr></tbody></table></div>';
  return h + '<p class="bl-ins">' + esc(insight(a, b, x.name)) + '</p>';
}

/* ------------------------------------------------------------------ year-end milestones */
function unitsAt(t, m) { let u = 0; for (const b of t.buildings) if (b.status !== 'shed' && b.units && b.readyAt <= m) u += b.units; return u; }
function firmsAt(res, t, m) { const s = (t.socioLog || []).find((z) => z.m === m); if (s) return s.firms; return res.final && m === res.months ? PB.socio(t).firms : null; }
function mileRows(res, t) {
  const Y = Math.round(res.months / 12), have = t.ipHist.length, out = [];
  for (let y = 1; y <= Y; y++) { const m = 12 * y; out.push(m > have ? null : { ip: t.ipHist[m - 1], units: unitsAt(t, m), firms: firmsAt(res, t, m), cash: t.cashHist[m - 1] }); }
  return out;
}
function mileTable(a, b, nameA, nameB, cls) {
  const Y = a.length, dash = '—';
  const R = [[L('Impact counted', 'Impact dikira'), (r) => n1(r.ip)], [L('Units ready', 'Unit siap'), (r) => String(r.units)], [L('Firms', 'Syarikat'), (r) => (r.firms == null ? dash : String(r.firms))], [L('Net cash, Cr', 'Tunai bersih, Cr'), (r) => n1(r.cash)]];
  let h = '<div class="scroll-x"><table class="' + (cls || 'tbl bl-mile') + '"><caption>' + esc(L('At the end of each year: ', 'Pada hujung setiap tahun: ') + nameA + ' / ' + nameB) + '</caption><thead><tr><th></th>';
  for (let y = 1; y <= Y; y++) h += '<th class="r">' + esc(L('Year ', 'Tahun ') + y) + '</th>';
  h += '</tr></thead><tbody>';
  for (const [lab, f] of R) {
    h += '<tr><td>' + esc(lab) + '</td>';
    for (let y = 0; y < Y; y++) h += '<td class="r mono">' + (a[y] ? f(a[y]) : dash) + ' <span class="bm">/ ' + (b[y] ? f(b[y]) : dash) + '</span></td>';
    h += '</tr>';
  }
  return h + '</tbody></table></div>';
}

/* ------------------------------------------------------------------ News tab: follow a benchmark */
function digest(res, key, upTo) {
  const st = stateAt(res, key, upTo), seen = new Set(), by = new Map();
  const Qof = (m) => { const q = Math.floor((m - 1) / 3); if (!by.has(q)) by.set(q, { q, items: [], ten: {}, tenNew: [], loan: 0, repay: 0, loanNew: false, repayNew: false }); return by.get(q); };
  for (let q = 0; 3 * q + 3 <= upTo; q++) Qof(3 * q + 1);           // every quarter appears, quiet ones too
  for (const o of movesOf(res, key, upTo)) {
    const I = info(o), Q = Qof(o.m), first = !seen.has(I.key); seen.add(I.key);
    if (I.cat === 'ten') { const k = o.ten || 'sme'; Q.ten[k] = (Q.ten[k] || 0) + 1; if (first) Q.tenNew.push(I.key); }
    else if (I.key === 'loan') { Q.loan += o.amount; Q.loanNew = Q.loanNew || first; }
    else if (I.key === 'repay') { Q.repay += o.amount; Q.repayNew = Q.repayNew || first; }
    else Q.items.push({ m: o.m, cat: I.cat, text: I.text, why: first ? principle(I.key) : '' });
  }
  for (const d of dealsOf(res, st, upTo)) Qof(d.m).items.push({ m: d.m, cat: 'deal', deal: d });
  const out = Array.from(by.values()).sort((a, b) => b.q - a.q);
  for (const Q of out) { const i = 3 * Q.q + 2; Q.ip = st.ipHist[i]; Q.cash = st.cashHist[i]; Q.items.sort((a, b) => a.m - b.m); }
  return out;
}
const whyLine = (txt, lab) => (txt ? '<div class="bn-why"><b>' + esc(lab || L('Why', 'Kenapa')) + ':</b> ' + esc(txt) + '</div>' : '');
function quarterHTML(Q) {
  let li = '';
  for (const it of Q.items) {
    if (it.cat === 'deal') {
      const d = it.deal;
      li += '<li class="bn-deal ' + (d.sound ? 'ok' : 'no') + '"><span class="bn-k">Deal</span>' + esc(titleOf(d.card)) + ' → <b>' + OPT[d.opt] + '</b>' + (d.site ? ' · ' + esc(zoneW(d.site)) : '') +
        ' <span class="bn-v">' + vMark(d) + ' ' + esc(vWord(d)) + '</span>' + whyLine(lessonOf(d.card), L('Principle', 'Prinsip')) + '</li>';
      continue;
    }
    li += '<li><span class="bn-k">' + esc(CAT()[it.cat]) + '</span>' + esc(it.text) + whyLine(it.why) + '</li>';
  }
  const tk = Object.keys(Q.ten);
  if (tk.length) li += '<li><span class="bn-k">' + esc(CAT().ten) + '</span>' + esc(L('Admitted ', 'Diterima ') + tk.map((k) => Q.ten[k] + ' ' + G().tenL(k) + (Q.ten[k] > 1 ? L('s', '') : '')).join(', ')) + Q.tenNew.map((k) => whyLine(principle(k))).join('') + '</li>';
  if (Q.loan || Q.repay) li += '<li><span class="bn-k">' + esc(CAT().money) + '</span>' + esc([Q.loan ? L('Borrowed ' + Q.loan + ' Cr', 'Meminjam ' + Q.loan + ' Cr') : '', Q.repay ? L('Repaid ' + Q.repay + ' Cr', 'Membayar balik ' + Q.repay + ' Cr') : ''].filter(Boolean).join(' · ')) +
    (Q.loanNew ? whyLine(principle('loan')) : '') + (Q.repayNew ? whyLine(principle('repay')) : '') + '</li>';
  if (!li) li = '<li class="quiet">' + esc(L('No new moves: what it had built kept working.', 'Tiada langkah baharu: apa yang telah dibina terus berfungsi.')) + '</li>';
  const y = Math.floor(Q.q / 4) + 1, k = Q.q % 4 + 1;
  return '<section class="bn-q"><div class="bn-qh"><b>' + esc(L('Quarter ' + k + ', Year ' + y, 'Suku ' + k + ', Tahun ' + y)) + '</b><span class="muted">' + esc(mname(3 * Q.q + 1).split(' ')[0] + '–' + mname(3 * Q.q + 3)) + '</span>' +
    '<span class="bn-fig mono">impact ' + n1(Q.ip) + ' · ' + esc(L('net cash ', 'tunai bersih ')) + n1(Q.cash) + ' Cr</span></div><ul class="bn-l">' + li + '</ul></section>';
}
function digestHTML(res, x) {
  const P = profile(keyOf(x));
  let h = '<div class="bn-head"><b>' + esc(x.name) + '</b>' + (P ? ' · ' + esc(P.tag) : '') + '</div>';
  if (view(res) === 'end') return h + '<div class="note">' + esc(HIDDEN()) + '</div>';
  const upTo = cutoff(res);
  h += '<div class="faint bn-lag">' + esc(lagLine(res, upTo)) + '</div>';
  if (upTo < 3) return h + (P ? '<p class="muted bn-plan">' + esc(P.plan) + '</p>' : '');
  const Q = digest(res, keyOf(x), upTo);
  h += Q.slice(0, 4).map(quarterHTML).join('');
  if (Q.length > 4) h += '<details class="bn-more"><summary>' + esc(L('Earlier quarters', 'Suku tahun terdahulu')) + ' (' + (Q.length - 4) + ')</summary>' + Q.slice(4).map(quarterHTML).join('') + '</details>';
  return h;
}
function newsTab(res, tm) {
  const B = benches(res), own = G().tabNews(res, tm);
  if (!B.length) return own;
  const x = B.find((y) => y.id === G().APP.ui.newsSrc) || null;
  const chip = (k, lab, on) => '<button class="btn sm' + (on ? ' primary' : '') + '" data-act="news-src" data-k="' + esc(k) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + esc(lab) + '</button>';
  return '<div class="row bn-src" role="group" aria-label="' + esc(L('Whose news', 'Berita siapa')) + '">' + chip('you', youName(tm), !x) + B.map((y) => chip(y.id, y.name, x === y)).join('') + '</div>' + (x ? digestHTML(res, x) : own);
}

/* ------------------------------------------------------------------ impact over time: you against one benchmark */
function niceMax(v) { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : (f <= 2 ? 2 : (f <= 2.5 ? 2.5 : (f <= 5 ? 5 : 10)))) * p; }
const HOV = { k: '', i: 0, focus: false };
function chartData(res, tm, x, upTo) {
  const M = res.months, key = keyOf(x), sb = stateAt(res, key, upTo);
  const s = [{ n: youName(tm), c: 'you', v: [0].concat(tm.t.ipHist.slice(0, M)) }, { n: x.name, c: 'bench', v: [0].concat(sb.ipHist.slice(0, upTo)) }];
  for (const y of benches(res)) if (y !== x) s.push({ n: y.name, c: 'other', v: [0].concat(stateAt(res, keyOf(y), upTo).ipHist.slice(0, upTo)) });
  const mv = {};
  for (const o of movesOf(res, key, upTo)) { const I = info(o); if (I.big) (mv[o.m] = mv[o.m] || []).push(I.text); }
  for (const d of dealsOf(res, sb, upTo)) (mv[d.m] = mv[d.m] || []).push('Deal · ' + titleOf(d.card) + ' → ' + OPT[d.opt] + ' ' + vMark(d));
  const ml = [L('Start', 'Mula')]; for (let m = 1; m <= M; m++) ml.push(mname(m));
  for (const S of s) S.v = S.v.map(r1);
  return { M, s, mv, ml, mvh: L('Moves by ', 'Langkah ') + x.name };
}
function chartHTML(res, tm, x, upTo) {
  const d = chartData(res, tm, x, upTo);
  /* the x axis runs to the end of the year after the data (at least Year 1), so early months are not squeezed to one side */
  const lastData = Math.max(...d.s.map((S) => S.v.length - 1)), M = Math.min(d.M, Math.max(12, Math.ceil((lastData + 1) / 12) * 12));
  d.M = M;
  const narrow = typeof root.innerWidth === 'number' && root.innerWidth < 640;          // a phone: fewer units across, so the text stays legible
  const W = narrow ? 380 : 640, H = narrow ? 230 : 236, pl = 34, pr = narrow ? 8 : 14, pt = 12, pb = 26;
  const all = [].concat(...d.s.map((S) => S.v));
  const lo = Math.min(0, ...all), top = niceMax(Math.max(5, ...all));
  Object.assign(d, { W, H, pl, pr, pt, pb, lo, top });
  const X = (i) => pl + (i / M) * (W - pl - pr), Y = (v) => pt + (1 - (v - lo) / (top - lo)) * (H - pt - pb);
  const f1 = (v) => v.toFixed(1);
  let g = '';
  const ticks = (top / 4) % 1 === 0 ? [0, top / 4, top / 2, 3 * top / 4, top] : [0, top / 2, top];
  if (lo < 0) ticks.unshift(lo);
  for (const v of ticks) g += '<line class="' + (v === 0 ? 'zl' : 'gl') + '" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + f1(Y(v)) + '" y2="' + f1(Y(v)) + '"/><text class="ax" x="' + (pl - 6) + '" y="' + f1(Y(v) + 4) + '" text-anchor="end">' + esc(n1(v).replace(/\.0$/, '')) + '</text>';
  for (let y = 1; 12 * y <= M; y++) {
    if (12 * y < M) g += '<line class="gl" x1="' + f1(X(12 * y)) + '" x2="' + f1(X(12 * y)) + '" y1="' + pt + '" y2="' + (H - pb) + '"/>';
    g += '<text class="ax" x="' + f1(X(12 * y - 6)) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(narrow && M > 36 ? L('Y', 'T') + y : L('Year ', 'Tahun ') + y) + '</text>';
  }
  const path = (v) => v.map((val, i) => (i ? 'L' : 'M') + f1(X(i)) + ' ' + f1(Y(val))).join('');
  for (const S of d.s.slice(2)) if (S.v.length > 1) g += '<path class="ln other" d="' + path(S.v) + '"/>';
  const B = d.s[1], Yo = d.s[0];
  if (B.v.length > 1) g += '<path class="ln bench" d="' + path(B.v) + '"/>';
  if (Yo.v.length > 1) g += '<path class="ln you" d="' + path(Yo.v) + '"/>';
  for (const m in d.mv) if (+m < B.v.length) g += '<circle class="mk" cx="' + f1(X(+m)) + '" cy="' + f1(Y(B.v[+m])) + '" r="4.5"/>';
  /* direct labels at the line ends, only when they do not collide */
  const ends = [Yo, B].filter((S) => S.v.length > 1).map((S) => ({ S, x: X(S.v.length - 1), y: Y(S.v[S.v.length - 1]) }));
  const clash = ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 15 && Math.abs(ends[0].x - ends[1].x) < 110;
  if (!clash) for (const e of ends) { const right = e.x + 8 + 7 * e.S.n.length < W; g += '<text class="el ' + e.S.c + '" x="' + f1(right ? e.x + 7 : e.x - 6) + '" y="' + f1(right ? e.y + 4 : e.y - 9) + '" text-anchor="' + (right ? 'start' : 'end') + '">' + esc(e.S.n) + '</text>'; }
  g += '<line class="bch-x" x1="0" x2="0" y1="' + pt + '" y2="' + (H - pb) + '" visibility="hidden"/><g class="bch-dots"></g>';
  const ck = res.g.gid + '|' + keyOf(x);
  const leg = '<div class="bch-leg"><span><i class="you"></i>' + esc(Yo.n) + '</span><span><i class="bench"></i>' + esc(B.n) + '</span><span><i class="dot"></i>' + esc(L('key move or deal', 'langkah penting atau deal')) + '</span>' + (d.s.length > 2 ? '<span><i class="other"></i>' + esc(L('Other benchmarks', 'Benchmark lain')) + '</span>' : '') + '</div>';
  const aria = L('Impact counted over time, ' + Yo.n + ' against ' + B.n + '. Use the left and right arrow keys to step through the months.', 'Impact dikira mengikut masa, ' + Yo.n + ' berbanding ' + B.n + '. Gunakan kekunci anak panah kiri dan kanan untuk melangkah bulan demi bulan.');
  /* the same figures as a table, one row a quarter */
  const last = Math.max(Yo.v.length, B.v.length) - 1; let rows = '';
  for (let i = 3; i <= last; i += 3) {
    const mv = []; for (let m = i - 2; m <= i; m++) if (d.mv[m]) mv.push(...d.mv[m]);
    rows += '<tr><td>' + esc(d.ml[i]) + '</td><td class="r mono">' + (i < Yo.v.length ? n1(Yo.v[i]) : '—') + '</td><td class="r mono">' + (i < B.v.length ? n1(B.v[i]) : '—') + '</td><td>' + esc(mv.join('; ')) + '</td></tr>';
  }
  const tbl = rows ? '<details class="bch-tbl"><summary>' + esc(L('Table of the figures', 'Jadual angka')) + '</summary><div class="scroll-x"><table class="tbl"><thead><tr><th>' + esc(L('End of', 'Hujung')) + '</th><th class="r">' + esc(Yo.n) + '</th><th class="r">' + esc(B.n) + '</th><th>' + esc(d.mvh) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div></details>' : '';
  if (HOV.k === ck) setTimeout(() => restore(ck), 0);
  return '<figure class="bch" data-k="' + esc(ck) + '" tabindex="0" role="group" aria-label="' + esc(aria) + '" data-d="' + esc(JSON.stringify(d)) + '">' + leg +
    '<div class="bch-box"><svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + g + '</svg><div class="bch-tip" hidden aria-live="polite"></div></div>' +
    '<figcaption>' + esc(L('Impact counted, cumulative: the main driver of the park score. Point at the chart, or focus it and use the arrow keys, to read each month.', 'Impact dikira, kumulatif: pemacu utama skor park. Halakan penunjuk pada graf, atau fokus padanya dan guna kekunci anak panah, untuk membaca setiap bulan.')) + '</figcaption>' + tbl + '</figure>';
}
/* crosshair and tooltip: one tooltip for every series, values first; text set with textContent */
function dataOf(fig) { if (!fig._d) fig._d = JSON.parse(fig.getAttribute('data-d')); return fig._d; }
function lastIdx(d) { return Math.max(...d.s.map((S) => S.v.length - 1)); }
function show(fig, i) {
  const d = dataOf(fig); i = Math.max(0, Math.min(lastIdx(d), i)); fig._i = i;
  HOV.k = fig.getAttribute('data-k'); HOV.i = i;
  const X = (k) => d.pl + (k / d.M) * (d.W - d.pl - d.pr), Y = (v) => d.pt + (1 - (v - d.lo) / (d.top - d.lo)) * (d.H - d.pt - d.pb);
  const svg = fig.querySelector('svg'), ln = svg.querySelector('.bch-x'), dots = svg.querySelector('.bch-dots'), tip = fig.querySelector('.bch-tip');
  ln.setAttribute('x1', X(i)); ln.setAttribute('x2', X(i)); ln.removeAttribute('visibility');
  while (dots.firstChild) dots.removeChild(dots.firstChild);
  while (tip.firstChild) tip.removeChild(tip.firstChild);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  tip.appendChild(el('div', 't-h', d.ml[i]));
  for (const S of d.s) {
    if (i >= S.v.length) continue;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', X(i)); c.setAttribute('cy', Y(S.v[i])); c.setAttribute('r', 4); c.setAttribute('class', 'bch-dot ' + S.c); dots.appendChild(c);
    const r = el('div', 't-r ' + S.c); r.appendChild(el('i', 'sw ' + S.c)); r.appendChild(el('b', null, n1(S.v[i]))); r.appendChild(el('span', null, S.n)); tip.appendChild(r);
  }
  const mv = d.mv[i];
  if (mv && mv.length) { const box = el('div', 't-m'); box.appendChild(el('b', null, d.mvh)); const ul = el('ul'); for (const tx of mv) ul.appendChild(el('li', null, tx)); box.appendChild(ul); tip.appendChild(box); }
  tip.hidden = false;
  const bw = fig.querySelector('.bch-box').clientWidth || d.W, px = X(i) / d.W * bw;
  tip.style.left = ''; tip.style.right = '';
  if (px > bw * 0.55) tip.style.right = Math.max(0, bw - px + 12) + 'px'; else tip.style.left = (px + 12) + 'px';
}
function hide(fig) {
  const svg = fig.querySelector('svg'); if (!svg) return;
  svg.querySelector('.bch-x').setAttribute('visibility', 'hidden');
  const dots = svg.querySelector('.bch-dots'); while (dots.firstChild) dots.removeChild(dots.firstChild);
  fig.querySelector('.bch-tip').hidden = true;
}
function restore(ck) {
  if (typeof document === 'undefined') return;
  const fig = Array.from(document.querySelectorAll('.bch')).find((f) => f.getAttribute('data-k') === ck); if (!fig) return;
  if (HOV.focus && document.activeElement !== fig) { try { fig.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  show(fig, HOV.i);
}
function idxAt(fig, e) { const d = dataOf(fig), r = fig.querySelector('svg').getBoundingClientRect(); if (!r.width) return 0; const vx = (e.clientX - r.left) * d.W / r.width; return Math.round((vx - d.pl) / ((d.W - d.pl - d.pr) / d.M)); }
if (typeof document !== 'undefined') {
  const onPoint = (e) => { const s = e.target.closest && e.target.closest('.bch svg'); if (!s) return; const fig = s.closest('.bch'); show(fig, idxAt(fig, e)); };
  document.addEventListener('pointermove', onPoint);
  document.addEventListener('pointerdown', onPoint);
  document.addEventListener('pointerout', (e) => {
    const s = e.target.closest && e.target.closest('.bch svg'); if (!s || (e.relatedTarget && s.contains(e.relatedTarget))) return;
    const fig = s.closest('.bch'); if (document.activeElement === fig) return;
    hide(fig); HOV.k = '';
  });
  document.addEventListener('keydown', (e) => {
    const fig = e.target, onChart = !!(fig.classList && fig.classList.contains('bch'));
    if (e.key === 'Escape') {
      const tip = onChart && fig.querySelector('.bch-tip');
      if (tip && !tip.hidden) { hide(fig); fig._i = null; return; }                 // first Escape hides the tooltip
      const c = G() && G().APP.ui.benchOpen && document.querySelector('.bstudy [data-act="bench-close"]'); if (c) c.click();   // then closes the study
      return;
    }
    if (!onChart) return;
    const d = dataOf(fig), cur = fig._i == null ? lastIdx(d) : fig._i;
    const to = { ArrowLeft: cur - 1, ArrowRight: cur + 1, Home: 0, End: lastIdx(d), PageUp: cur - 12, PageDown: cur + 12 }[e.key];
    if (to == null) return;
    e.preventDefault(); show(fig, to);
  });
  document.addEventListener('focusin', (e) => { const fig = e.target; if (!fig.classList || !fig.classList.contains('bch')) return; HOV.focus = true; show(fig, HOV.k === fig.getAttribute('data-k') ? HOV.i : lastIdx(dataOf(fig))); });
  document.addEventListener('focusout', (e) => { const fig = e.target; if (!fig.classList || !fig.classList.contains('bch') || !fig.isConnected) return; HOV.focus = false; HOV.k = ''; hide(fig); });
}

/* ------------------------------------------------------------------ Standings tab: learn from the benchmarks */
/* the profiles describe the full site; a smaller level has fewer zones, and the scripts skip what cannot be built */
function zoneNote(res) { const z = res.lv.zones || []; return z.length >= 8 ? '' : L('This level has Zones ' + z.join(', ') + ' only, so the benchmark skips the steps it plans for other zones.', 'Level ini hanya ada Zon ' + z.join(', ') + ', jadi benchmark melangkau langkah yang dirancang untuk zon lain.'); }
function profileHTML(res, x) {
  const P = profile(keyOf(x)); if (!P) return '';
  const zn = zoneNote(res);
  return '<div class="bl-prof"><div><b>' + esc(x.name) + '</b> · ' + esc(P.tag) + '</div><p>' + esc(P.plan) + (zn ? ' <i>' + esc(zn) + '</i>' : '') + '</p><p><b>' + esc(L('Why it scores', 'Kenapa ia berkesan')) + ':</b> ' + esc(P.why) + '</p>' +
    '<p><b>' + esc(L('Where it is weak', 'Kelemahannya')) + ':</b> ' + esc(P.weak) + '</p><p class="bl-les"><b>' + esc(L('For a real park', 'Untuk park sebenar')) + ':</b> ' + esc(P.lesson) + '</p></div>';
}
const pickRow = (B, x) => '<div class="row bn-src" role="group" aria-label="' + esc(L('Benchmark to study', 'Benchmark untuk dikaji')) + '">' + B.map((y) => '<button class="btn sm' + (y === x ? ' primary' : '') + '" data-act="bench-pick" data-k="' + esc(y.id) + '" aria-pressed="' + (y === x ? 'true' : 'false') + '">' + esc(y.name) + '</button>').join('') + '</div>';
/* the Standings tab is a short panel: a summary and the way into the full study */
function learnHTML(res, tm) {
  const B = benches(res); if (!B.length) return '';
  let h = '<section class="bl"><h3 class="bl-h">' + esc(L('Learn from the benchmarks', 'Belajar daripada benchmark')) + '</h3>';
  if (view(res) === 'end') return h + '<div class="note">' + esc(HIDDEN()) + '</div></section>';
  const x = chosen(res), upTo = cutoff(res), P = profile(keyOf(x));
  h += pickRow(B, x) + '<div class="faint bn-lag">' + esc(lagLine(res, upTo)) + '</div>';
  if (P) h += '<p class="bl-sub"><b>' + esc(x.name) + '</b> · ' + esc(P.tag) + '. ' + esc(P.why) + '</p>';
  h += '<p class="bl-ins">' + esc(insight(engine(tm.t), engine(stateAt(res, keyOf(x), upTo)), x.name)) + '</p>';
  return h + '<div class="row"><button class="btn primary sm" data-act="bench-open">' + esc(L('Open the full study: chart, impact sources, plan', 'Buka kajian penuh: graf, sumber impact, rancangan')) + '</button></div></section>';
}
/* the full study, in a dialog over the dashboard */
function studyHTML(res, tm) {
  const ui = G().APP.ui; if (!ui.benchOpen) return '';
  const B = benches(res); if (!B.length) return '';
  const x = chosen(res), upTo = cutoff(res), st = G().store();
  const pause = st && st.mode === 'solo' && res.g.status === 'running' ? '<button class="btn sm" data-act="solo-pause">' + esc(L('Pause the clock', 'Jeda jam')) + '</button>' : '';
  let h = '<div class="overlay" role="dialog" aria-modal="true" aria-label="' + esc(L('Learn from the benchmarks', 'Belajar daripada benchmark')) + '"><div class="deal bstudy"><div class="deal-top"><span class="label">' + esc(L('Learn from the benchmarks', 'Belajar daripada benchmark')) + '</span><span class="bs-tools">' + pause +
    '<button class="btn sm" data-act="bench-close">' + esc(L('Close', 'Tutup')) + '</button></span></div><div class="deal-body">';
  if (view(res) === 'end') return h + '<div class="note">' + esc(HIDDEN()) + '</div></div></div></div>';
  h += pickRow(B, x) + '<div class="faint bn-lag">' + esc(lagLine(res, upTo)) + '</div>';
  h += chartHTML(res, tm, x, upTo);
  h += engineHTML(res, tm, x, upTo);
  h += profileHTML(res, x);
  h += mileTable(mileRows(res, tm.t), mileRows(res, stateAt(res, keyOf(x), upTo)), youName(tm), x.name);
  h += '<div class="row"><button class="btn sm" data-act="bench-news" data-k="' + esc(x.id) + '">' + esc(L('Read ' + x.name + '\'s news quarter by quarter', 'Baca berita ' + x.name + ' suku demi suku')) + '</button><button class="btn sm" data-act="bench-close">' + esc(L('Close', 'Tutup')) + '</button></div>';
  return h + '</div></div></div>';
}

/* ------------------------------------------------------------------ after a deal closes: the benchmarks' choices */
function dealHTML(res, tm, ev) {
  if (view(res) === 'end') return '';
  const B = benches(res); if (!B.length) return '';
  const Cd = PB.CARDS[ev.card], M = lang() === 'ms' ? root.IMPAK_MS : null;
  const rows = B.map((x) => {
    const d = x.t.dlog.find((y) => y.eid === ev.id); if (!d) return '';
    if (!d.eligible) return '<li class="na"><b>' + esc(x.name) + '</b> <span class="muted">' + esc(L('did not apply', 'tidak terpakai')) + '</span></li>';
    const out = x.t.log.filter((l) => l.kind === 'event' && l.text.indexOf(Cd.title + ': ') === 0).slice(-1)[0];
    let rest = out ? out.text.slice(Cd.title.length + 2) : '';
    if (rest) { rest = M ? M.mon(M.sayMS(rest)) : rest; rest = rest.charAt(0).toUpperCase() + rest.slice(1); }
    return '<li><b>' + esc(x.name) + '</b> <span class="bd-o">' + OPT[d.opt] + (d.site ? ' · ' + esc(zoneW(d.site)) : '') + '</span> <span class="bd-v ' + (d.sound ? 'ok' : 'no') + '">' + vMark(d) + ' ' + esc(vWord(d)) + '</span>' +
      (rest ? '<div class="bd-out">' + esc(rest) + '</div>' : '') + '</li>';
  }).join('');
  return rows ? '<div class="bdeal"><div class="label">' + esc(L('What the benchmark parks chose', 'Pilihan park benchmark')) + '</div><ul>' + rows + '</ul></div>' : '';
}

/* ------------------------------------------------------------------ after the game: how the leading benchmark built its park */
function topBench(res) { return benches(res).filter((x) => x.rub).sort((a, b) => b.rub.total - a.rub.total)[0] || null; }
function leader(res, tm) {
  const x = topBench(res); if (!x || !tm.rub) return null;
  const key = keyOf(x), mv = movesOf(res, key, res.months), first = {};
  for (const o of mv) if (o.type === 'facility' && !first[o.kind]) first[o.kind] = o.m;
  const facs = Object.keys(C.FAC).filter((k) => first[k] || tm.t.fac[k]).map((k) => ({ label: C.FAC[k].label, them: first[k] || null, you: tm.t.fac[k] ? tm.t.fac[k].since : null }));
  const y1 = mv.filter((o) => o.m <= 12).map((o) => ({ m: o.m, I: info(o) })).filter((z) => z.I.big);
  return { x, P: profile(key), zn: zoneNote(res), facs, y1, a: engine(tm.t), b: engine(x.t), mile: [mileRows(res, tm.t), mileRows(res, x.t)], ahead: tm.rub.total >= x.rub.total };
}
function leaderText(R, tm) {
  const { x, P, a, b } = R, you = tm.id === 'you' ? L('your park', 'park anda') : tm.name;
  return {
    lead: (R.ahead ? L('You finished ahead of every benchmark. The best of them was ', 'Anda mendahului semua benchmark. Yang terbaik antaranya ialah ') : '') + x.name + ' (' + n1(x.rub.total) + L(' marks', ' markah') + ')' + (P ? ': ' + P.tag.toLowerCase() + '. ' + P.plan : '.') + (R.zn ? ' ' + R.zn : ''),
    eng: L('At the final bell ' + x.name + ' was adding ' + n1(b.counted) + ' impact a year against ' + n1(a.counted) + ' for ' + you + '.', 'Pada loceng akhir ' + x.name + ' menambah ' + n1(b.counted) + ' impact setahun berbanding ' + n1(a.counted) + ' bagi ' + you + '.') + (b.counted > a.counted + 0.05 ? ' ' + diffLine(a, b) : ''),
    facs: R.facs.map((f) => f.label + ' (' + x.name + ' ' + (f.them ? mname(f.them) : '—') + ' · ' + L('you ', 'anda ') + (f.you ? mname(f.you) : '—') + ')').join('; '),
    y1: R.y1.map((z) => z.I.text + ' (' + mname(z.m) + ')').join('; '),
  };
}
function debriefHTML(res, tm) {
  const R = leader(res, tm); if (!R) return '';
  const T = leaderText(R, tm), x = R.x;
  let h = '<div class="db-lead"><div class="db-sub">' + esc(L('How the leading benchmark built its park', 'Cara pendahulu membina park')) + '</div><p class="db-d">' + esc(T.lead) + '</p><p class="db-d">' + esc(T.eng) + '</p>';
  h += mileTable(R.mile[0], R.mile[1], youName(tm), x.name);
  if (T.facs) h += '<p class="db-d"><b>' + esc(L('Facilities, month launched', 'Kemudahan, bulan dilancarkan')) + ':</b> ' + esc(T.facs) + '.</p>';
  if (T.y1) h += '<p class="db-d"><b>' + esc(L('Its first year', 'Tahun pertamanya')) + ':</b> ' + esc(T.y1) + '.</p>';
  if (R.P) h += '<p class="db-d"><b>' + esc(L('For a real park', 'Untuk park sebenar')) + ':</b> ' + esc(R.P.lesson) + '</p>';
  return h + '<p class="faint" style="font-size:12px;margin:4px 0 0">' + esc(L('Every move by quarter: the News tab, choose ' + x.name + '. Impact over time: the Standings tab.', 'Setiap langkah mengikut suku tahun: tab Berita, pilih ' + x.name + '. Impact mengikut masa: tab Kedudukan.')) + '</p></div>';
}
/* the printable version: a two-line chart with fixed print colours, the milestones and the first year */
function printChart(a, b, na, nb) {
  const w = 680, h = 150, pl = 36, pr = 8, pt = 8, pb = 22, n = Math.max(a.length, b.length);
  if (n < 2) return '';
  const all = a.concat(b), lo = Math.min(0, ...all), hi = niceMax(Math.max(1, ...all));
  const sx = (i) => pl + (i / (n - 1)) * (w - pl - pr), sy = (v) => pt + (1 - (v - lo) / (hi - lo)) * (h - pt - pb);
  let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(na + ' / ' + nb) + '">';
  for (const v of [0, hi / 2, hi]) s += '<line x1="' + pl + '" x2="' + (w - pr) + '" y1="' + sy(v).toFixed(1) + '" y2="' + sy(v).toFixed(1) + '" class="gr"/><text x="' + (pl - 4) + '" y="' + (sy(v) + 3).toFixed(1) + '" class="ax" text-anchor="end">' + Math.round(v) + '</text>';
  for (let y = 1; 12 * y <= n; y++) s += '<text x="' + sx(Math.min(n - 1, 12 * y - 6)).toFixed(1) + '" y="' + (h - 6) + '" class="ax" text-anchor="middle">' + esc(L('Y', 'T') + y) + '</text>';
  const pts = (v) => v.map((val, i) => sx(i).toFixed(1) + ',' + sy(val).toFixed(1)).join(' ');
  s += '<polyline fill="none" stroke="#eb6834" stroke-width="2" stroke-linejoin="round" points="' + pts(b) + '"/><polyline fill="none" stroke="#2a78d6" stroke-width="2" stroke-linejoin="round" points="' + pts(a) + '"/></svg>';
  const sw = (c) => '<span style="display:inline-block;width:14px;border-top:2px solid ' + c + ';vertical-align:middle;margin:0 5px 0 10px"></span>';
  return '<figure class="ch"><figcaption>' + esc(L('Impact counted over time', 'Impact dikira mengikut masa')) + sw('#2a78d6') + esc(na) + sw('#eb6834') + esc(nb) + '</figcaption>' + s + '</figure>';
}
function transcriptHTML(res, tm, sec) {
  const R = leader(res, tm); if (!R) return '';
  const T = leaderText(R, tm), x = R.x;
  let b = '<p>' + esc(T.lead) + '</p><p>' + esc(T.eng) + '</p>' + printChart([0].concat(tm.t.ipHist), [0].concat(x.t.ipHist), youName(tm), x.name);
  b += mileTable(R.mile[0], R.mile[1], youName(tm), x.name, 'dj mile');
  if (T.facs) b += '<p><b>' + esc(L('Facilities, month launched', 'Kemudahan, bulan dilancarkan')) + ':</b> ' + esc(T.facs) + '.</p>';
  if (T.y1) b += '<p><b>' + esc(L('Its first year', 'Tahun pertamanya')) + ':</b> ' + esc(T.y1) + '.</p>';
  if (R.P) b += '<p><b>' + esc(L('For a real park', 'Untuk park sebenar')) + ':</b> ' + esc(R.P.lesson) + '</p>';
  return sec(L('How the leading benchmark built its park', 'Cara pendahulu membina park'), b);
}

root.IMPAKBench = { view, cutoff, newsTab, learnHTML, studyHTML, dealHTML, debriefHTML, transcriptHTML, engine, digest, movesOf, stateAt, mileRows, chosen };
})(typeof window !== 'undefined' ? window : globalThis);
