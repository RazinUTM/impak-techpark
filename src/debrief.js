// SPDX-License-Identifier: MIT
/* IMPAK v0.6 — end-of-game debrief and the team achievement transcript.
   Reads only the finished game state (team state t, rubric r, level, scenario); the engine stays untouched.
   analyse() works out where marks were lost and what was left on the table; html() shows it on the final card
   and in the Guide; transcript() writes a print-ready A4 page that the browser saves as PDF. */
(function (root) {
'use strict';
const PB = root.PB, C = PB.CFG;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n1 = (v) => (Math.round((+v || 0) * 10) / 10).toFixed(1).replace(/^-(?=\d*[1-9])/, '−').replace(/^-/, '');
const pc = (v) => Math.round((v || 0) * 100) + '%';
const cl = (x) => Math.max(0, Math.min(1, x));
const lang = () => (root.IMPAK && root.IMPAK.HOST.lang === 'ms' ? 'ms' : 'en');
const L = (en, ms) => (lang() === 'ms' ? ms : en);
const sgn = (v) => (v >= 0 ? '+' : '−') + n1(Math.abs(v));

/* ------------------------------------------------------------------ the parts of the score */
function partInfo(k, lv) {
  const W = lv.score, ops = lv.key === 'rintis';
  const P = {
    A: [L('Park score', 'Skor park'), L('Impact plus the FCR12 bonus, minus the drift and debt penalties, against a target of ' + W.parkTarget + '.',
      'Impact ditambah bonus FCR12, ditolak penalti drift dan hutang, berbanding sasaran ' + W.parkTarget + '.')],
    B1: [L('Phase 1 · Development Fund', 'Fasa 1 · Development Fund'), L('Share of the Development Fund used by month 24 (40%) and growth in committed income by month 24 against a target of ' + W.fundIncomeTarget + ' Cr a year (60%).',
      'Bahagian Development Fund yang digunakan sebelum bulan 24 (40%) dan pertumbuhan committed income hingga bulan 24 berbanding sasaran ' + W.fundIncomeTarget + ' Cr setahun (60%).')],
    B2: [L('Zone H plots', 'Plot Zon H'), L('The four University Reserve plots signed by month 36: build, covenant lease, reserve or national lab 2.5 each; plain lease 1.5; reclaimed 0.',
      'Empat plot University Reserve yang ditandatangani sebelum bulan 36: bangunan, lease dengan covenant, rizab atau makmal kebangsaan 2.5 setiap satu; lease biasa 1.5; diambil semula 0.')],
    B3: ops ? [L('Operations', 'Operasi'), L('Three equal thirds: never bailed out, FCR12 of at least 1 at the end, and occupancy from 50% (none) to 90% (full).',
      'Tiga bahagian sama rata: tiada bailout, FCR12 sekurang-kurangnya 1 di akhir, dan penghunian dari 50% (kosong) hingga 90% (penuh).')]
      : [L('Survival', 'Survival'), L('Three equal thirds: no bailout in Phase 3, FCR12 of at least 1 at the end, and the share of let units kept through the downturn from 50% (none) to 90% (full).',
        'Tiga bahagian sama rata: tiada bailout dalam Fasa 3, FCR12 sekurang-kurangnya 1 di akhir, dan bahagian unit yang kekal disewa sepanjang downturn dari 50% (kosong) hingga 90% (penuh).')],
    C: [L('Decisions', 'Keputusan'), L('Share of Deal Room decisions that were sound. Leaving an opportunity that had a sound way in earns half.',
      'Bahagian keputusan Deal Room yang wajar. Leave pada peluang yang sebenarnya ada cara wajar untuk diambil hanya dapat separuh.')],
    D: [L('Defence', 'Defence'), L('Marked by the facilitator for the team\'s explanation of its strategy.', 'Dinilai oleh fasilitator berdasarkan penerangan strategi pasukan.')],
    E: [L('ESG', 'ESG'), L('ESG record from −2 (none) to +6 (full).', 'Rekod ESG dari −2 (kosong) hingga +6 (penuh).')],
  }[k];
  return { k, label: P[0], what: P[1], max: W[k] };
}
const partKeys = (lv) => ['A', 'B1', 'B2', 'B3', 'C', 'D', 'E'].filter((k) => lv.score[k] > 0);
const FACN = () => ({
  lab: 'Shared Prototyping Lab', labaccess: 'University Lab Access', incubator: 'Incubator', liaison: 'Industry Liaison Office',
  covenant: 'Engagement Covenant', kpi: 'KPI & Impact Reporting', mgmt: 'Park Management Team', services: 'Shared Services',
});
const OPT = { T: 'Take', C: 'Conditions', L: 'Leave' };
const MEDAL = (m) => ({ gold: L('Gold', 'Emas'), silver: L('Silver', 'Perak'), bronze: L('Bronze', 'Gangsa'), none: L('Completed', 'Tamat') }[m]);
const ctitle = (c) => (root.IMPAK && root.IMPAK.cardL ? root.IMPAK.cardL(c, 'title') : PB.CARDS[c].title);
const ewhy = (w) => (root.IMPAK && root.IMPAK.esgWhyL ? root.IMPAK.esgWhyL(w) : w);
const mname = (m) => (root.IMPAK ? root.IMPAK.mnameL(m) : 'M' + m);

/* the best other park to compare with: the leading team if there is one, otherwise the best benchmark */
function rival(res, tm) {
  const o = res.teams.filter((x) => x !== tm && x.rub).sort((a, b) => b.rub.total - a.rub.total);
  return o.filter((x) => !x.bench)[0] || o[0] || null;
}

/* ------------------------------------------------------------------ analysis */
function analyse(res, tm) {
  const r = tm.rub, t = tm.t, lv = res.lv, W = lv.score, p = r.park;
  const parts = partKeys(lv).map((k) => Object.assign(partInfo(k, lv), { got: r[k] }));
  const gaps = [], missed = [], strengths = [];
  const Aof = (s) => W.A * cl(s / W.parkTarget);
  const gainA = (d) => Math.max(0, Aof(p.score + d) - r.A);
  const add = (part, lost, title, detail, tip) => { if (lost > 0.05) gaps.push({ part, lost, title, detail, tip }); };

  /* A: park score */
  if (t.receiver) add('A', W.A - r.A, L('The park went into receivership', 'Park masuk receivership'), L('After a second bankruptcy only half of the impact counts and no FCR12 bonus is paid.', 'Selepas bankrap kali kedua, hanya separuh impact dikira dan tiada bonus FCR12.'),
    L('Watch cash every quarter. Borrow before cash runs out, not after, and do not build faster than tenants arrive.', 'Pantau tunai setiap suku tahun. Pinjam sebelum tunai habis, bukan selepas, dan jangan bina lebih laju daripada kemasukan penyewa.'));
  let explained = 0;
  if (!t.receiver && t.ipu > 0.05) {
    const g = gainA(0.5 * t.ipu); explained += g;
    add('A', g, L('Impact not verified', 'Impact tidak disahkan'),
      L(n1(t.ipu) + ' impact points were earned while KPI & Impact Reporting was not running, so they count at half (' + n1(0.5 * t.ipu) + ' points lost).',
        n1(t.ipu) + ' mata impact diperoleh ketika KPI & Impact Reporting belum berjalan, jadi hanya dikira separuh (' + n1(0.5 * t.ipu) + ' mata hilang).'),
      L('Set up KPI & Impact Reporting in the first months (0.5 Cr, 0.2 Cr a year). From then on every impact point counts in full.', 'Sediakan KPI & Impact Reporting pada bulan-bulan awal (0.5 Cr, 0.2 Cr setahun). Selepas itu setiap mata impact dikira penuh.'));
  }
  if (!t.receiver && p.fcrBonus < 8) {
    const g = gainA(8 - p.fcrBonus); explained += g;
    add('A', g, L('FCR12 below 1.3', 'FCR12 bawah 1.3'),
      L('FCR12 ended at ' + (p.fcr > 8 ? '—' : p.fcr.toFixed(2)) + ', worth ' + sgn(p.fcrBonus) + '. At 1.3 or more it is worth +8; below 0.8 it costs −5.',
        'FCR12 berakhir pada ' + (p.fcr > 8 ? '—' : p.fcr.toFixed(2)) + ', bernilai ' + sgn(p.fcrBonus) + '. Pada 1.3 ke atas nilainya +8; bawah 0.8 ditolak −5.'),
      L('Committed income should cover at least 1.3 times the yearly upkeep and interest: let empty units, add ground leases, close facilities that do not pay their way, and repay loans.',
        'Committed income perlu menampung sekurang-kurangnya 1.3 kali upkeep dan faedah setahun: sewakan unit kosong, tambah ground lease, tutup kemudahan yang tidak berbaloi, dan bayar balik pinjaman.'));
  }
  if (!t.receiver && p.driftPen > 0) {
    const g = gainA(p.driftPen); explained += g;
    add('A', g, L('Mission drift', 'Mission drift'),
      L('Drift ended at ' + pc(p.drift) + ': unlinked tenants took too large a share of the park (−' + p.driftPen + ').', 'Drift berakhir pada ' + pc(p.drift) + ': penyewa unlinked mengambil bahagian park yang terlalu besar (−' + p.driftPen + ').'),
      L('Keep unlinked tenants (back offices, agencies, plain leases) to half the park or less. Fill space with tech SMEs, spin-offs and R&D anchors.',
        'Hadkan penyewa unlinked (back-office, agensi, lease biasa) kepada separuh park atau kurang. Isi ruang dengan Tech SME, spin-off dan R&D anchor.'));
  }
  if (!t.receiver && p.debtPen > 0) {
    const g = gainA(p.debtPen); explained += g;
    add('A', g, L('Debt above cash at the end', 'Hutang melebihi tunai di akhir'),
      L('Loans not covered by cash at the end cost ' + n1(p.debtPen) + ' points.', 'Pinjaman yang tidak ditampung tunai di akhir menyebabkan tolakan ' + n1(p.debtPen) + ' mata.'),
      L('Plan the last year so that cash is at least equal to debt at the final bell, or repay early.', 'Rancang tahun terakhir supaya tunai sekurang-kurangnya sama dengan hutang pada loceng akhir, atau bayar balik lebih awal.'));
  }
  const restA = W.A - r.A - explained;
  if (!t.receiver && restA > 1) {
    const lev = [];
    if (!t.fac.lab) lev.push(L('a Shared Prototyping Lab (+1 to +2 impact a year with linked tenants, and startups graduate more often)', 'Shared Prototyping Lab (+1 hingga +2 impact setahun dengan penyewa linked, dan startup lebih kerap bergraduat)'));
    if (!t.fac.incubator) lev.push(L('an Incubator (each startup adds +1 impact a year; graduates add +3)', 'Incubator (setiap startup tambah +1 impact setahun; yang bergraduat tambah +3)'));
    if (!(t.prog > 0)) lev.push(L('Innovation programmes (+' + C.PROG.ipPerCr + ' impact for each Cr a year)', 'Innovation programmes (+' + C.PROG.ipPerCr + ' impact bagi setiap Cr setahun)'));
    if (!t.fac.liaison) lev.push(L('an Industry Liaison Office (+1 impact a year with two linked tenants, and more applicants)', 'Industry Liaison Office (+1 impact setahun dengan dua penyewa linked, dan lebih ramai pemohon)'));
    if (!t.fac.covenant) lev.push(L('an Engagement Covenant (+1 impact a year for every two linked tenants)', 'Engagement Covenant (+1 impact setahun bagi setiap dua penyewa linked)'));
    lev.push(L('linked tenants in Zone C, which earn a bonus there', 'penyewa linked di Zon C, yang mendapat bonus di situ'));
    add('A', restA, L('Impact below the target', 'Impact bawah sasaran'),
      L('Total impact was ' + n1(p.ip) + ' against a park-score target of ' + W.parkTarget + '.', 'Jumlah impact ' + n1(p.ip) + ' berbanding sasaran skor park ' + W.parkTarget + '.'),
      L('Impact grows each month from what the park holds. Levers you did not use: ', 'Impact bertambah setiap bulan berdasarkan apa yang ada dalam park. Tuas yang belum digunakan: ') + lev.slice(0, 3).join('; ') + '.');
  }

  /* B1: Phase 1 */
  if (W.B1) {
    const fu = t.snap.fundUsed != null ? t.snap.fundUsed : t.fundUsed, f0 = t.fund0 || C.FUND;
    const lost1 = 0.4 * W.B1 * (1 - Math.min(1, fu / f0));
    add('B1', lost1, L('Development Fund left unused', 'Development Fund tidak digunakan sepenuhnya'),
      L(n1(f0 - fu) + ' Cr of the ' + n1(f0) + ' Cr fund lapsed at month 24.', n1(f0 - fu) + ' Cr daripada dana ' + n1(f0) + ' Cr luput pada bulan 24.'),
      L('Spend the fund on capital works before month 24: buildings, services and facilities. Whatever is left lapses and earns nothing.', 'Belanjakan dana untuk kerja modal sebelum bulan 24: bangunan, services dan kemudahan. Baki yang tinggal akan luput tanpa sebarang pulangan.'));
    const grow = (t.snap.ci24 != null ? t.snap.ci24 : PB.committedIncome(t)) - t.snap.ci0;
    const lost2 = 0.6 * W.B1 * (1 - cl(grow / W.fundIncomeTarget));
    add('B1', lost2, L('Income grew slowly in Phase 1', 'Pendapatan lambat meningkat dalam Fasa 1'),
      L('Committed income grew by ' + n1(grow) + ' Cr a year by month 24 (target ' + W.fundIncomeTarget + ').', 'Committed income meningkat ' + n1(grow) + ' Cr setahun hingga bulan 24 (sasaran ' + W.fundIncomeTarget + ').'),
      L('Build early so units are ready well before month 24, put road, water and power in first, and admit applicants before they give up after ' + C.WAIT + ' months.',
        'Bina awal supaya unit siap jauh sebelum bulan 24, sediakan road, water dan power dahulu, dan terima pemohon sebelum mereka berputus asa selepas ' + C.WAIT + ' bulan.'));
  }
  /* B2: Zone H */
  if (W.B2) {
    const hp = t.snap.hplots || t.hplots, lost = W.B2 - r.B2;
    const rec = hp.filter((x) => x === 'reclaimed' || x == null).length, plain = hp.filter((x) => x === 'lease').length;
    add('B2', lost, L('Zone H not fully used', 'Zon H tidak digunakan sepenuhnya'),
      L(rec + ' plot(s) went back to the university and ' + plain + ' carried a plain lease.', rec + ' plot dipulangkan kepada universiti dan ' + plain + ' plot hanya lease biasa.'),
      L('Zone H opens at month 25 and unsigned plots are reclaimed at month 36. Sign all four, and prefer build, a covenant lease, a reserve or the national lab (2.5 each) over a plain lease (1.5).',
        'Zon H dibuka pada bulan 25 dan plot yang belum ditandatangani diambil semula pada bulan 36. Tandatangani keempat-empat plot, dan utamakan bangunan, lease dengan covenant, rizab atau makmal kebangsaan (2.5 setiap satu) berbanding lease biasa (1.5).'));
  }
  /* B3: operations or survival */
  if (W.B3) {
    const third = W.B3 / 3, ops = lv.key === 'rintis';
    const bail = ops ? (t.bailouts || t.receiver) : (t.bailP3 || t.receiver);
    if (bail) add('B3', third, L('Bailout', 'Bailout'), L('The university had to rescue the park' + (ops ? '' : ' in Phase 3') + ' (−5 impact and one action point fewer).', 'Universiti terpaksa menyelamatkan park' + (ops ? '' : ' dalam Fasa 3') + ' (−5 impact dan kurang satu action point).'),
      L('Keep a cash buffer of at least one quarter of upkeep, and borrow while the bank still lends.', 'Simpan penampan tunai sekurang-kurangnya satu suku tahun upkeep, dan pinjam ketika bank masih memberi pinjaman.'));
    if (!(p.fcr >= 1) || t.receiver) add('B3', third, L('FCR12 below 1 at the end', 'FCR12 bawah 1 di akhir'), L('Committed income did not cover the yearly running costs.', 'Committed income tidak menampung kos operasi tahunan.'),
      L('Before each new facility or building, check that committed income still covers upkeep and interest.', 'Sebelum setiap kemudahan atau bangunan baharu, pastikan committed income masih menampung upkeep dan faedah.'));
    const share = ops ? cl((r.retention - 0.5) / 0.4) : cl((r.retention - C.RET[0]) / (C.RET[1] - C.RET[0]));
    add('B3', third * (1 - share), ops ? L('Empty units', 'Unit kosong') : L('Tenants lost in the downturn', 'Penyewa hilang semasa downturn'),
      ops ? L('Occupancy ended at ' + pc(r.retention) + '; full marks need 90%.', 'Penghunian berakhir pada ' + pc(r.retention) + '; markah penuh memerlukan 90%.')
        : L(pc(r.retention) + ' of let units were kept through the downturn; full marks need 90%.', pc(r.retention) + ' unit yang disewa kekal sepanjang downturn; markah penuh memerlukan 90%.'),
      ops ? L('Match building to demand: let what is ready before building more, and keep services in place so tenants can move in.', 'Padankan pembinaan dengan permintaan: sewakan unit yang siap sebelum bina lagi, dan pastikan services tersedia supaya penyewa boleh masuk.')
        : L('Before the downturn, favour tenants that stay (agencies, R&D anchors, supported spin-offs) and keep a cash buffer for the slow years.', 'Sebelum downturn, utamakan penyewa yang kekal (agensi, R&D anchor, spin-off yang disokong) dan simpan penampan tunai untuk tahun yang perlahan.'));
  }
  /* C: decisions */
  const dl = t.dlog.filter((d) => d.eligible);
  const unsound = dl.filter((d) => !d.sound), half = dl.filter((d) => d.sound && d.credit < 1);
  if (W.C && unsound.length) add('C', W.C * unsound.length / Math.max(1, dl.length), L('Unsound Deal Room decisions', 'Keputusan Deal Room kurang wajar'),
    L(unsound.length + ' of ' + dl.length + ' decisions were not sound: ', unsound.length + ' daripada ' + dl.length + ' keputusan kurang wajar: ') + unsound.map((d) => ctitle(d.card) + ' (' + OPT[d.opt] + ')').join(', ') + '.',
    L('Open "Think it through" before choosing: check the values it lists against the rule of thumb, then pick the option whose risk you can carry.', 'Buka "Fikir dahulu" sebelum memilih: semak nilai yang disenaraikan berbanding panduan, kemudian pilih opsyen yang risikonya mampu ditanggung.'));
  if (W.C && half.length) add('C', W.C * 0.5 * half.length / Math.max(1, dl.length), L('Opportunities left on the table', 'Peluang yang dilepaskan'),
    L('You chose Leave on ' + half.map((d) => ctitle(d.card)).join(', ') + ', although a sound way to engage existed (half credit).', 'Anda memilih Leave pada ' + half.map((d) => ctitle(d.card)).join(', ') + ', walaupun ada cara wajar untuk mengambilnya (separuh markah).'),
    L('Leave is safe but not free. When the checks are met, Take or Conditions earns full credit and adds to the park.', 'Leave memang selamat tetapi ada kosnya. Apabila semakan dipenuhi, Take atau Conditions mendapat markah penuh dan menambah nilai park.'));
  /* D, E */
  if (W.D && tm.hasD && r.D < 0.7 * W.D) add('D', W.D - r.D, L('Defence', 'Defence'), L('Defence marked ' + n1(r.D) + ' of ' + W.D + '.', 'Defence mendapat ' + n1(r.D) + ' daripada ' + W.D + '.'),
    L('Prepare three things: your strategy in one sentence, the two decisions that shaped the park, and what you would change.', 'Sediakan tiga perkara: strategi anda dalam satu ayat, dua keputusan yang membentuk park, dan apa yang akan anda ubah.'));
  if (W.E) {
    const neg = (t.esgLog || []).filter((e) => e.d < 0);
    add('E', W.E - r.E, L('ESG record', 'Rekod ESG'),
      L('ESG ended at ' + sgn(t.esg) + (neg.length ? '. Losses came from: ' + neg.map((e) => ewhy(e.why) + ' (' + e.d + ')').join(', ') : '') + '.', 'ESG berakhir pada ' + sgn(t.esg) + (neg.length ? '. Penurunan ESG datang daripada: ' + neg.map((e) => ewhy(e.why) + ' (' + e.d + ')').join(', ') : '') + '.'),
      L('Protect the low ground and the forest edge, choose covenants with environmental conditions, and add a buffer or retention park where the level allows.', 'Lindungi tanah rendah dan pinggir hutan, pilih covenant dengan syarat alam sekitar, dan tambah green buffer atau retention park jika level membenarkan.'));
  }
  gaps.sort((a, b) => b.lost - a.lost);

  /* opportunities that never became marks directly */
  const sheds = t.buildings.filter((b) => b.status === 'shed').length;
  if (sheds) missed.push(L(sheds + ' shed(s) were never converted into lettable space.', sheds + ' shed tidak pernah ditukar menjadi ruang sewa.'));
  const ready = t.buildings.filter((b) => b.status === 'ready');
  const empty = ready.reduce((a, b) => a + PB.freeUnits(t, b), 0);
  if (empty >= 2) missed.push(L(empty + ' ready units stood empty at the end: rent and impact not earned.', empty + ' unit yang siap masih kosong di akhir: sewa dan impact tidak diperoleh.'));
  const noSvc = Object.keys(t.zones).filter((z) => lv.zones.indexOf(z) >= 0 && t.buildings.some((b) => b.zone === z && b.status === 'ready') && !(t.zones[z].svc.road >= 1 && t.zones[z].svc.water >= 1 && t.zones[z].svc.power >= 1));
  if (noSvc.length) missed.push(L('Zone ' + noSvc.join(', ') + ' had buildings without full services, so nobody could move in there.', 'Zon ' + noSvc.join(', ') + ' ada bangunan tanpa services lengkap, jadi tiada penyewa boleh masuk.'));
  const F = FACN(), noFac = [];
  if (!t.fac.kpi) noFac.push(F.kpi + L(' (impact counts in full)', ' (impact dikira penuh)'));
  if (!t.fac.lab && !t.fac.labaccess) noFac.push(F.lab + ' / ' + F.labaccess + L(' (R&D anchors need one)', ' (R&D anchor memerlukannya)'));
  if (!t.fac.incubator) noFac.push(F.incubator + L(' (startups)', ' (startup)'));
  if (!t.fac.mgmt) noFac.push(F.mgmt + L(' (+1 action point a quarter)', ' (+1 action point setiap suku tahun)'));
  if (!t.fac.liaison) noFac.push(F.liaison + L(' (+1 applicant a quarter)', ' (+1 pemohon setiap suku tahun)'));
  if (noFac.length) missed.push(L('Facilities never set up: ', 'Kemudahan yang tidak pernah disediakan: ') + noFac.join('; ') + '.');
  const spare = t.cash - t.debt - t.emerg;
  if (spare > 3) missed.push(L('The park ended with ' + n1(spare) + ' Cr of spare cash. Cash earns no marks: part of it could have funded Innovation programmes or capacity.', 'Park berakhir dengan lebihan tunai ' + n1(spare) + ' Cr. Tunai tidak memberi markah: sebahagiannya boleh membiayai Innovation programmes atau kapasiti.'));
  const lost = t.log.filter((x) => x.kind === 'bad' && / left the park\.$/.test(x.text)).length;
  if (lost >= 2) missed.push(L(lost + ' tenants left the park during the game. Supported spin-offs and anchors stay longer.', lost + ' penyewa keluar dari park sepanjang permainan. Spin-off yang disokong dan anchor kekal lebih lama.'));

  /* strengths */
  for (const P of parts) if (P.max && P.got >= 0.8 * P.max) strengths.push(L(P.label + ': ' + n1(P.got) + ' of ' + P.max + '.', P.label + ': ' + n1(P.got) + ' daripada ' + P.max + '.'));
  if (dl.length && !unsound.length) strengths.push(L('Every Deal Room decision was sound.', 'Semua keputusan Deal Room wajar.'));
  if (!t.bailouts && !t.receiver) strengths.push(L('The park never needed a bailout.', 'Park tidak pernah memerlukan bailout.'));
  if (t.fac.kpi && !(t.ipu > 0.05)) strengths.push(L('Impact was verified from the start.', 'Impact disahkan sejak awal.'));
  if (p.drift <= 0.3) strengths.push(L('The park stayed true to its mission (drift ' + pc(p.drift) + ').', 'Park kekal setia pada misinya (drift ' + pc(p.drift) + ').'));

  /* the next medal */
  const M = lv.medals, next = [];
  const gates = [];
  if (p.score < 0.5 * W.parkTarget) gates.push(L('a park score of at least ' + Math.round(W.parkTarget / 2) + ' (now ' + n1(p.score) + ')', 'skor park sekurang-kurangnya ' + Math.round(W.parkTarget / 2) + ' (sekarang ' + n1(p.score) + ')'));
  if (r.medal !== 'gold') {
    const tgt = r.medal === 'silver' ? 'gold' : (r.medal === 'bronze' ? 'silver' : 'bronze');
    if (r.total < M[tgt]) next.push(L(n1(M[tgt] - r.total) + ' more marks (' + MEDAL(tgt) + ' starts at ' + M[tgt] + ')', n1(M[tgt] - r.total) + ' markah lagi (' + MEDAL(tgt) + ' bermula pada ' + M[tgt] + ')'));
    if (tgt !== 'bronze') next.push(...gates);
    if (tgt === 'silver' && t.receiver) next.push(L('no receivership', 'tiada receivership'));
    if (tgt === 'gold') {
      if (t.bailouts) next.push(L('no bailout', 'tiada bailout'));
      if (!(p.fcr >= 1)) next.push(L('FCR12 of at least 1', 'FCR12 sekurang-kurangnya 1'));
      if (p.drift > 0.5) next.push(L('drift of 50% or less', 'drift 50% atau kurang'));
      if (lv.esgGate && t.esg < 0) next.push(L('ESG of 0 or more', 'ESG 0 atau lebih'));
    }
    var nextMedal = tgt;
  }

  /* comparison */
  const cmp = rival(res, tm); let vs = null;
  if (cmp) {
    const diffs = partKeys(lv).map((k) => ({ k, d: cmp.rub[k] - r[k] })).filter((x) => x.d > 0.5).sort((a, b) => b.d - a.d).slice(0, 3);
    const theirFac = Object.keys(cmp.t.fac).filter((k) => cmp.t.fac[k] && !t.fac[k]).map((k) => F[k] || k);
    vs = { name: cmp.name, bench: !!cmp.bench, total: cmp.rub.total, medal: cmp.rub.medal, diffs, theirFac, ahead: r.total >= cmp.rub.total };
  }

  /* take-away points: the three biggest gaps as actions, the main principle from a mistake, and one thing to keep */
  const take = [];
  for (const g of gaps.slice(0, 3)) take.push(g.tip);
  const les = unsound.map((d) => (root.LESSONS || {})[d.card]).filter(Boolean)[0];
  if (les) take.push(L('Principle to remember: ', 'Prinsip untuk diingat: ') + les[lang()].principle);
  if (strengths.length) take.push(L('Keep doing: ', 'Teruskan: ') + strengths[0].replace(/\.$/, '') + '.');
  return { r, t, lv, parts, gaps, missed, strengths, next, nextMedal: typeof nextMedal === 'undefined' ? null : nextMedal, vs, take, dl, unsound };
}

function earlyNote(res) { return res.g.endedEarly ? L('Ended early on ' + mname(res.g.endedEarly) + ': the remaining months ran without new orders, so the marks below include that autopilot period.', 'Ditamatkan awal pada ' + mname(res.g.endedEarly) + ': baki bulan berjalan tanpa arahan baharu, jadi markah di bawah merangkumi tempoh autopilot itu.') : ''; }
/* one-line verdict */
function summary(a) {
  const top = a.gaps.slice(0, 2).map((g) => g.part + ' (' + g.title + ', −' + n1(g.lost) + ')');
  return L(MEDAL(a.r.medal) + ', ' + n1(a.r.total) + ' of 100.' + (top.length ? ' Most marks were lost on ' + top.join(' and ') + '.' : ''),
    MEDAL(a.r.medal) + ', ' + n1(a.r.total) + ' daripada 100.' + (top.length ? ' Markah paling banyak hilang pada ' + top.join(' dan ') + '.' : ''));
}

/* ------------------------------------------------------------------ the debrief shown in the game */
function html(res, tm, opts) {
  if (!tm || !tm.rub) return '';
  const a = analyse(res, tm), o = opts || {};
  let h = '<details class="debrief"' + (o.open ? ' open' : '') + '><summary>' + esc(L('Debrief and advice for next time', 'Ulasan dan cadangan untuk lain kali')) + '</summary>';
  h += '<p class="db-sum">' + esc(summary(a)) + (res.g.endedEarly ? ' ' + esc(earlyNote(res)) : '') + '</p>';
  if (a.gaps.length) h += '<div class="db-sub">' + esc(L('Where the marks went', 'Di mana markah hilang')) + '</div><ol class="db-gaps">' + a.gaps.slice(0, o.all ? 99 : 4).map((g) =>
    '<li><div class="db-h"><b>' + esc(g.title) + '</b><span class="db-pts">' + esc(g.part) + ' −' + n1(g.lost) + '</span></div><div class="db-d">' + esc(g.detail) + '</div><div class="db-tip">→ ' + esc(g.tip) + '</div></li>').join('') + '</ol>';
  if (a.missed.length) h += '<div class="db-sub">' + esc(L('Opportunities missed', 'Peluang terlepas')) + '</div><ul class="db-list">' + a.missed.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  if (a.strengths.length) h += '<div class="db-sub">' + esc(L('What went well', 'Yang baik')) + '</div><ul class="db-list ok">' + a.strengths.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  if (a.nextMedal && a.next.length) h += '<div class="db-sub">' + esc(L('For ', 'Untuk ') + MEDAL(a.nextMedal) + L(' you needed', ' anda perlukan')) + '</div><p class="db-d">' + esc(a.next.join(' · ')) + '</p>';
  if (a.vs && !a.vs.ahead && a.vs.diffs.length) h += '<div class="db-sub">' + esc(L('Compared with ', 'Berbanding ') + a.vs.name + (a.vs.bench ? L(' (benchmark)', ' (benchmark)') : '')) + '</div><p class="db-d">' +
    esc(a.vs.diffs.map((x) => x.k + ' +' + n1(x.d)).join(' · ') + (a.vs.theirFac.length ? L('. They had: ', '. Mereka ada: ') + a.vs.theirFac.join(', ') + '.' : '')) + '</p>';
  h += '<div class="row db-actions"><button class="btn primary" data-act="transcript"' + (o.team ? ' data-team="' + esc(o.team) + '"' : '') + '>' + esc(L('Download transcript (PDF)', 'Muat turun transkrip (PDF)')) + '</button></div></details>';
  return h;
}

/* ------------------------------------------------------------------ the printable transcript */
function lineChart(vals, title, unit) {
  if (!vals || vals.length < 2) return '';
  const w = 330, h = 120, pl = 34, pr = 8, pt = 8, pb = 22;
  const lo = Math.min(0, ...vals), hi = Math.max(0.1, ...vals), sx = (i) => pl + (i / (vals.length - 1)) * (w - pl - pr), sy = (v) => pt + (1 - (v - lo) / (hi - lo)) * (h - pt - pb);
  const ticks = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v * 10) / 10);
  const yrs = Math.floor(vals.length / 12);
  let s = '<figure class="ch"><figcaption>' + esc(title) + ' <span>(' + esc(unit) + ')</span></figcaption><svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(title) + '">';
  for (const v of ticks) s += '<line x1="' + pl + '" x2="' + (w - pr) + '" y1="' + sy(v) + '" y2="' + sy(v) + '" class="gr"/><text x="' + (pl - 4) + '" y="' + (sy(v) + 3) + '" class="ax" text-anchor="end">' + v + '</text>';
  if (lo < 0) s += '<line x1="' + pl + '" x2="' + (w - pr) + '" y1="' + sy(0) + '" y2="' + sy(0) + '" class="zero"/>';
  for (let y = 1; y <= yrs; y++) { const x = sx(Math.min(vals.length - 1, y * 12 - 1)); s += '<text x="' + x + '" y="' + (h - 6) + '" class="ax" text-anchor="middle">' + L('Y', 'T') + y + '</text>'; }
  s += '<polyline fill="none" class="ln" points="' + vals.map((v, i) => sx(i).toFixed(1) + ',' + sy(v).toFixed(1)).join(' ') + '"/></svg></figure>';
  return s;
}
function transcript(res, tm, meta) {
  const tname = tm.id === 'you' ? L('Your park', 'Park anda') : tm.name;
  const a = analyse(res, tm), r = a.r, t = a.t, lv = a.lv, p = r.park, m = meta || {};
  const so = PB.socio(t), H = res.teams.filter((x) => !x.bench && x.rub).sort((x, y) => y.rub.total - x.rub.total);
  const rank = H.indexOf(tm) + 1, today = new Date();
  const dstr = today.getDate() + ' ' + (lang() === 'ms' ? ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'] : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'])[today.getMonth()] + ' ' + today.getFullYear();
  const lvName = lv.name + ' · ' + (lang() === 'ms' ? ({ rintis: 'Level 1', bina: 'Level 2', lestari: 'Level 3' }[lv.key]) : 'Level ' + lv.n);
  const brand = (root.IMPAK && root.IMPAK.BRAND) || {};
  const row = (k, v) => '<tr><th>' + esc(k) + '</th><td>' + v + '</td></tr>';
  const sec = (title, body) => '<section><h2>' + esc(title) + '</h2>' + body + '</section>';

  const AV = root.__AVATARS || {}, pose = r.medal === 'gold' || r.medal === 'silver' ? 'cheer' : 'thanks', av = AV[pose] || AV.ok || AV.idle || '';
  const greet = { gold: L('Outstanding work. Your park met every gate.', 'Syabas! Park anda memenuhi semua syarat.'), silver: L('Well done. A strong park with room to grow.', 'Tahniah! Park yang kukuh, masih ada ruang untuk berkembang.'),
    bronze: L('Good effort. The park stands; the debrief shows what to sharpen.', 'Usaha yang baik. Park anda berdiri; ulasan di dalam menunjukkan apa yang perlu dipertajam.'), none: L('Thank you for playing. Every lesson inside is a step to a medal.', 'Terima kasih kerana bermain. Setiap pelajaran di dalam ialah langkah ke arah pingat.') }[r.medal];
  let body = '<section class="cert ' + r.medal + '"><div class="frame">' +
    '<div class="c-brand">IMPAK<sup>™</sup><span>Technovation Park</span></div>' +
    '<div class="c-sub">' + esc(L('Team achievement transcript', 'Transkrip pencapaian pasukan')) + '</div>' +
    '<div class="c-rule"></div>' +
    '<div class="c-lead">' + esc(L('This record is presented to the team', 'Rekod ini diberikan kepada pasukan')) + '</div>' +
    '<div class="c-team">' + esc(tname) + '</div>' +
    '<div class="c-lead">' + esc(L('for completing', 'kerana menamatkan')) + ' <b>' + esc(lvName) + '</b> · ' + Math.round((res.sc.months || lv.months) / 12) + L(' simulated years', ' tahun simulasi') + '</div>' +
    '<div class="c-mid"><div class="c-av">' + (av ? '<img src="' + av + '" alt="' + esc(L('IMPAK tutor', 'Tutor IMPAK')) + '">' : '') + '<div class="c-bubble">' + esc(greet) + '</div></div>' +
    '<div class="seal ' + r.medal + '"><div><span class="s-m">' + esc(MEDAL(r.medal)) + '</span><span class="s-t">' + n1(r.total) + '</span><span class="s-o">' + esc(L('of 100', 'daripada 100')) + '</span></div></div>' +
    '<div class="c-facts">' + (H.length > 1 ? '<div><span>' + esc(L('Place', 'Tempat')) + '</span><b>' + rank + ' / ' + H.length + '</b></div>' : '') +
    '<div><span>' + esc(L('Park score', 'Skor park')) + '</span><b>' + n1(p.score) + ' / ' + lv.score.parkTarget + '</b></div>' +
    '<div><span>' + esc(L('Sound decisions', 'Keputusan wajar')) + '</span><b>' + a.dl.filter((d) => d.sound).length + ' / ' + a.dl.length + '</b></div>' +
    '<div><span>Impact</span><b>' + n1(p.ip) + '</b></div></div></div>' +
    '<table class="meta">' + row(L('Members', 'Ahli'), '<span class="edit" data-k="members" contenteditable="true" data-ph="' + esc(L('type the names here before printing', 'taip nama ahli di sini sebelum cetak')) + '">' + esc(m.members || '') + '</span>') +
    (m.room ? row(L('Room', 'Bilik'), esc(m.room)) : '') + row(L('Game', 'Permainan'), esc(res.g.gid || '') + ' · seed ' + esc(res.g.seed)) +
    (m.event ? row(L('Programme', 'Program'), esc(m.event)) : '') + row(L('Date', 'Tarikh'), esc(dstr)) + (res.g.endedEarly ? row(L('Note', 'Nota'), esc(earlyNote(res))) : '') + '</table>' +
    '<div class="c-sign"><div><span class="line"></span>' + esc(L('Facilitator', 'Fasilitator')) + '</div><div><span class="line"></span>' + esc(L('Team representative', 'Wakil pasukan')) + '</div></div>' +
    '<div class="c-note">' + esc(L('A record of a training game, not an assessment of the members\' competence. The pages that follow explain each mark and what to do next time.', 'Rekod permainan latihan, bukan penilaian kompetensi ahli. Halaman berikutnya menerangkan setiap markah dan apa yang perlu dibuat lain kali.')) + '</div>' +
    '</div></section>';
  body += '<header class="run"><div class="brand">IMPAK<sup>™</sup> – Technovation Park</div><div>' + esc(tname) + ' · ' + esc(lvName) + ' · ' + esc(MEDAL(r.medal)) + ' ' + n1(r.total) + '</div></header>';
  body += '<p class="lede">' + esc(summary(a)) + '</p>';

  body += sec(L('Marks by part', 'Markah mengikut bahagian'), '<table class="parts"><thead><tr><th></th><th>' + esc(L('Part', 'Bahagian')) + '</th><th>' + esc(L('What it measures', 'Apa yang diukur')) + '</th><th class="r">' + esc(L('Marks', 'Markah')) + '</th><th class="bar"></th></tr></thead><tbody>' +
    a.parts.map((P) => '<tr><td class="k">' + P.k + '</td><td><b>' + esc(P.label) + '</b></td><td class="w">' + esc(P.what) + (P.k === 'D' && !tm.hasD ? ' <i>' + esc(L('(not yet marked)', '(belum dinilai)')) + '</i>' : '') + '</td><td class="r">' + n1(P.got) + ' / ' + P.max + '</td><td class="bar"><span style="width:' + Math.round(100 * cl(P.got / P.max)) + '%"></span></td></tr>').join('') +
    '<tr class="sum"><td></td><td><b>' + esc(L('Total', 'Jumlah')) + '</b></td><td class="w">' + esc(L('Medals: Gold ' + lv.medals.gold + ', Silver ' + lv.medals.silver + ', Bronze ' + lv.medals.bronze + '. Silver and Gold also need a park score of at least half the target; Gold also needs no bailout, FCR12 of at least 1 and drift of 50% or less' + (lv.esgGate ? ', and ESG of 0 or more' : '') + '.',
      'Pingat: Emas ' + lv.medals.gold + ', Perak ' + lv.medals.silver + ', Gangsa ' + lv.medals.bronze + '. Perak dan Emas juga memerlukan skor park sekurang-kurangnya separuh sasaran; Emas juga memerlukan tiada bailout, FCR12 sekurang-kurangnya 1 dan drift 50% atau kurang' + (lv.esgGate ? ', serta ESG 0 atau lebih' : '') + '.')) + '</td><td class="r"><b>' + n1(r.total) + '</b></td><td></td></tr></tbody></table>');

  const kv = [[L('Park score', 'Skor park'), n1(p.score) + ' / ' + lv.score.parkTarget], [L('Impact', 'Impact'), n1(p.ip)], ['FCR12', p.fcr > 8 ? '—' : p.fcr.toFixed(2)], ['Drift', pc(p.drift)],
    [L('Occupancy', 'Penghunian'), pc(PB.occupancy(t))], [L('Cash less debt', 'Tunai tolak hutang'), n1(t.cash - t.debt - t.emerg) + ' Cr'], ['Bailouts', String(t.bailouts)],
    [L('Sound decisions', 'Keputusan wajar'), a.dl.filter((d) => d.sound).length + ' / ' + a.dl.length], ['Dare', String(r.dare)]];
  if (lv.score.E) kv.push(['ESG', sgn(t.esg)]);
  const imp = [[L('Jobs', 'Pekerjaan'), so.jobs], [L('Student interns a year', 'Pelajar intern setahun'), so.interns], [L('Firms', 'Syarikat'), so.firms], [L('Alumni-founded', 'Diasaskan alumni'), so.alumni],
    [L('University-linked', 'Berkait universiti'), pc(so.uniShare)], [L('Economic impact', 'Impak ekonomi'), n1(so.econ) + L(' Cr a year', ' Cr setahun')]];
  body += sec(L('Key figures at the final bell', 'Angka utama pada loceng akhir'), '<div class="two"><table class="kv">' + kv.map((x) => row(x[0], esc(x[1]))).join('') + '</table><div><table class="kv">' + imp.map((x) => row(x[0], esc(x[1]))).join('') +
    '</table><p class="note">' + esc(L('Socio-economic figures are shown for discussion and are not scored.', 'Angka sosioekonomi untuk perbincangan sahaja dan tidak diberi markah.')) + '</p></div></div>' +
    '<div class="two">' + lineChart(t.ipHist, L('Impact over time', 'Impact mengikut masa'), L('points', 'mata')) + lineChart(t.cashHist, L('Cash less debt over time', 'Tunai tolak hutang mengikut masa'), 'Cr') + '</div>');

  if (a.strengths.length) body += sec(L('What went well', 'Yang baik'), '<ul>' + a.strengths.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>');
  if (a.gaps.length) body += sec(L('Where the marks went, and what to do next time', 'Di mana markah hilang, dan apa yang perlu dibuat lain kali'), '<table class="gaps"><tbody>' + a.gaps.map((g) =>
    '<tr><td class="k">' + g.part + '<br><span>−' + n1(g.lost) + '</span></td><td><b>' + esc(g.title) + '.</b> ' + esc(g.detail) + '<div class="tip">→ ' + esc(g.tip) + '</div></td></tr>').join('') + '</tbody></table>');
  if (a.missed.length) body += sec(L('Opportunities missed', 'Peluang terlepas'), '<ul>' + a.missed.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>');
  if (a.nextMedal && a.next.length) body += sec(L('The next medal', 'Pingat seterusnya'), '<p>' + esc(L('For ' + MEDAL(a.nextMedal) + ' the team needed: ', 'Untuk ' + MEDAL(a.nextMedal) + ' pasukan memerlukan: ') + a.next.join('; ') + '.') + '</p>');
  if (a.vs) body += sec(L('Comparison', 'Perbandingan'), '<p>' + esc(a.vs.ahead
    ? L('The team finished ahead of ' + a.vs.name + (a.vs.bench ? ' (benchmark)' : '') + ' (' + n1(a.vs.total) + ').', 'Pasukan mendahului ' + a.vs.name + (a.vs.bench ? ' (benchmark)' : '') + ' (' + n1(a.vs.total) + ').')
    : L(a.vs.name + (a.vs.bench ? ' (benchmark)' : '') + ' scored ' + n1(a.vs.total) + '. It earned more on ', a.vs.name + (a.vs.bench ? ' (benchmark)' : '') + ' mendapat ' + n1(a.vs.total) + '. Ia mendapat lebih pada ') + (a.vs.diffs.map((x) => x.k + ' (+' + n1(x.d) + ')').join(', ') || '—') +
      (a.vs.theirFac.length ? L('. Facilities it had and you did not: ', '. Kemudahan yang ada padanya tetapi tiada pada anda: ') + a.vs.theirFac.join(', ') : '') + '.') + '</p>');

  const dl = t.dlog.filter((d) => d.eligible || d.opt === null);
  if (dl.length) body += sec(L('Decision journal', 'Jurnal keputusan'), '<table class="dj"><thead><tr><th>' + esc(L('When', 'Tarikh')) + '</th><th>' + esc(L('Deal', 'Deal')) + '</th><th>' + esc(L('Choice', 'Pilihan')) + '</th><th></th><th>' + esc(L('Principle', 'Prinsip')) + '</th></tr></thead><tbody>' + dl.map((d) => {
    const ev = res.sc.events.find((e) => e.id === d.eid), Ls = (root.LESSONS || {})[d.card];
    if (!d.eligible) return '<tr class="na"><td>' + esc(ev ? mname(ev.month) : '') + '</td><td>' + esc(ctitle(d.card)) + '</td><td colspan="3">' + esc(L('did not apply to this park', 'tidak terpakai untuk park ini')) + '</td></tr>';
    return '<tr><td>' + esc(ev ? mname(ev.month) : '') + '</td><td>' + esc(ctitle(d.card)) + '</td><td>' + OPT[d.opt] + (d.site ? ' · ' + esc(d.site) : '') + '</td><td class="v ' + (d.sound ? 'ok' : 'no') + '">' + (d.sound ? (d.credit < 1 ? '½' : '✓') : '✗') + '</td><td>' + esc(Ls ? Ls[lang()].principle : '') + '</td></tr>';
  }).join('') + '</tbody></table><p class="note">✓ ' + esc(L('sound', 'wajar')) + ' · ½ ' + esc(L('sound but an opportunity was left', 'wajar tetapi peluang dilepaskan')) + ' · ✗ ' + esc(L('not sound', 'kurang wajar')) + '</p>');

  body += sec(L('Take-away points', 'Perkara utama untuk dibawa pulang'), '<ol class="take">' + a.take.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' +
    '<div class="refl"><b>' + esc(L('Team reflection', 'Refleksi pasukan')) + '</b><p class="edit" data-k="refl" contenteditable="true" data-ph="' + esc(L('One thing we will do differently in a real park: …', 'Satu perkara yang akan kami buat secara berbeza dalam park sebenar: …')) + '"></p></div>');

  const css = `@page{size:A4;margin:14mm 13mm 16mm}*{box-sizing:border-box}body{font:10.5pt/1.45 "Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1d2330;margin:0;background:#eef0f4}
.page{max-width:186mm;margin:12px auto;background:#fff;padding:14mm 13mm;box-shadow:0 1px 6px rgba(0,0,0,.12)}
.bar-top{position:sticky;top:0;background:#1d2330;color:#fff;padding:10px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px;z-index:2}
.bar-top button{font:inherit;font-weight:600;background:#4f7cff;color:#fff;border:0;border-radius:6px;padding:8px 14px;cursor:pointer}
.cert{break-after:page;page-break-after:always;margin:0 0 6mm}
.cert .frame{border:3px double #1d2a4a;outline:1px solid #b8892b;outline-offset:-9px;padding:12mm 12mm 9mm;text-align:center;position:relative;background:radial-gradient(circle at 50% 0,#fbf7ec 0,#fff 60%)}
.c-brand{font-weight:800;letter-spacing:.06em;color:#1d2a4a;font-size:38pt;line-height:1.05}.c-brand sup{font-size:.35em;vertical-align:super}
.c-brand span{display:block;font-size:20pt;letter-spacing:.32em;text-transform:uppercase;font-weight:600;color:#b8892b;margin-top:2mm}
.c-sub{font:italic 15pt/1.3 Georgia,"Times New Roman",serif;color:#384157;margin-top:4mm}
.c-rule{width:46mm;height:2px;background:#b8892b;margin:5mm auto}
.c-lead{font:12pt/1.4 Georgia,"Times New Roman",serif;color:#4a5368}
.c-team{font:700 26pt/1.15 Georgia,"Times New Roman",serif;color:#1d2a4a;margin:2mm 0 3mm}
.c-mid{display:grid;grid-template-columns:1fr auto 1fr;gap:6mm;align-items:center;margin:7mm 0 5mm}
.c-av{display:flex;align-items:flex-end;gap:2mm;justify-content:flex-end}.c-av img{height:60mm;width:auto}
.c-bubble{position:relative;min-width:38mm;max-width:50mm;text-align:left;font-size:10pt;line-height:1.35;background:#f3f5fa;border:1px solid #d8dce6;border-radius:8px;padding:7px 9px;margin-bottom:34mm}
.seal{width:40mm;height:40mm;border-radius:50%;display:grid;place-items:center;color:#1d2a4a;border:2px solid rgba(0,0,0,.18);box-shadow:inset 0 0 0 4px rgba(255,255,255,.55),inset 0 0 0 6px rgba(0,0,0,.12)}
.seal.gold{background:radial-gradient(circle at 35% 30%,#fff3c4,#e2b53f 55%,#b8892b)}.seal.silver{background:radial-gradient(circle at 35% 30%,#fff,#c9ced6 55%,#9aa3b0)}
.seal.bronze{background:radial-gradient(circle at 35% 30%,#ffe2c7,#d39062 55%,#a5683b)}.seal.none{background:radial-gradient(circle at 35% 30%,#fff,#e3e6ec 60%,#c3c8d2)}
.seal div{display:grid;justify-items:center;line-height:1.05}.s-m{font-weight:800;font-size:11pt;letter-spacing:.12em;text-transform:uppercase}.s-t{font-weight:800;font-size:26pt}.s-o{font-size:8.5pt}
.c-facts{display:grid;gap:2mm;justify-items:start;text-align:left}.c-facts div{display:grid}.c-facts span{font-size:8.5pt;color:#5b6478;text-transform:uppercase;letter-spacing:.06em}.c-facts b{font-size:12pt;color:#1d2a4a}
.cert .meta{width:auto;margin:2mm auto 0;text-align:left}.cert .meta th{width:auto;padding-right:10px}
.c-sign{display:flex;justify-content:space-around;margin-top:12mm;font-size:9.5pt;color:#4a5368}.c-sign div{display:grid;justify-items:center;gap:2mm}.c-sign .line{display:block;width:55mm;border-bottom:1px solid #4a5368;height:10mm}
.c-note{margin-top:7mm;font-size:8.3pt;color:#6b7387}
header.run{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1.5px solid #1d2a4a;padding-bottom:2mm;color:#384157;font-size:9.5pt}header.run .brand{font-weight:700;color:#1d2a4a;font-size:11pt}header.run sup{font-size:.6em}
.lede{font-weight:600;color:#1d2a4a;margin:4mm 0 0}
h2{font-size:11.5pt;margin:16px 0 6px;padding-bottom:3px;border-bottom:1.5px solid #d8dce6;break-after:avoid;color:#1d2a4a}section{break-inside:auto}
table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:3px 6px}
.meta th,.kv th{width:38%;color:#5b6478;font-weight:500}
.edit{border-bottom:1px dashed #9aa3b5;outline:none;min-width:40mm;display:inline-block}
.edit:empty::before{content:attr(data-ph);color:#9aa3b5;font-style:italic}
.parts th{font-size:9pt;color:#5b6478;font-weight:600;border-bottom:1px solid #d8dce6}.parts td{border-bottom:1px solid #eef0f4}.parts .k{font-weight:700;width:8mm}.parts .w{color:#4a5368;font-size:9.2pt}
.r{text-align:right;white-space:nowrap}td.bar{width:26mm}td.bar span{display:block;height:8px;border-radius:0 4px 4px 0;background:#4f7cff;margin-top:5px}.parts .sum td{border-bottom:0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.note{font-size:8.8pt;color:#5b6478;margin:4px 0}
.ch{margin:6px 0;break-inside:avoid}.ch figcaption{font-size:9pt;font-weight:600}.ch figcaption span{font-weight:400;color:#5b6478}.ch svg{width:100%;height:auto}
.gr{stroke:#e3e6ec;stroke-width:1}.zero{stroke:#9aa3b5;stroke-width:1}.ax{font-size:8px;fill:#5b6478}.ln{stroke:#4f7cff;stroke-width:2;stroke-linejoin:round}
.gaps td{border-bottom:1px solid #eef0f4;padding:5px 6px}.gaps .k{font-weight:700;width:12mm;text-align:center}.gaps .k span{font-weight:500;color:#b4472c;font-size:9pt}.tip{color:#1f5130;margin-top:2px}
.dj{font-size:9pt}.dj th{color:#5b6478;font-weight:600;border-bottom:1px solid #d8dce6}.dj td{border-bottom:1px solid #eef0f4}.dj .na td{color:#8a92a5}.v{font-weight:700;text-align:center}.v.ok{color:#1f7a3a}.v.no{color:#b4472c}
ul,ol{margin:4px 0;padding-left:18px}li{margin:2px 0}.take li{margin:4px 0}.refl{border:1px solid #d8dce6;border-radius:6px;padding:6px 10px;margin-top:10px;break-inside:avoid}.refl p{min-height:14mm;margin:4px 0 0;display:block}
footer{margin-top:16px;padding-top:6px;border-top:1px solid #d8dce6;font-size:8.3pt;color:#6b7387}
@media print{.edit:empty::before{content:''}body{background:#fff}.page{margin:0;padding:0;box-shadow:none;max-width:none}.bar-top{display:none}.edit{border-bottom:0}.cert .frame{min-height:265mm}}
@media (max-width:600px){.page{padding:14px}.two{grid-template-columns:1fr}}`;
  const top = '<div class="bar-top" data-lang="' + lang() + '"><button onclick="window.print()">' + esc(L('Print / Save as PDF', 'Cetak / Simpan sebagai PDF')) + '</button><span class="lsw" role="group" aria-label="' + esc(L('Language of the transcript', 'Bahasa transkrip')) + '"><button data-lg="ms">Bahasa Melayu</button><button data-lg="en">English</button></span><span>' + esc(L('Choose the language, type the members\' names and your reflection, then choose "Save as PDF" as the printer.', 'Pilih bahasa, taip nama ahli dan refleksi, kemudian pilih "Save as PDF" sebagai pencetak.')) + '</span></div>';
  const foot = '<footer>' + esc(L('Generated by IMPAK – Technovation Park ', 'Dijana oleh IMPAK – Technovation Park ') + (brand.version || '') + ' · ' + dstr + '. ' +
    L('A record of a training game, not an assessment of the team members\' competence.', 'Rekod permainan latihan, bukan penilaian kompetensi ahli pasukan.') + ' ' + (brand.copyright || '')) + '</footer>';
  return '<!DOCTYPE html><html lang="' + lang() + '" data-title="' + esc('IMPAK – ' + L('Transcript', 'Transkrip') + ' – ' + tname) + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc('IMPAK – ' + L('Transcript', 'Transkrip') + ' – ' + tname) + '</title><style>' + css + '</style></head><body>' + top + '<div class="page">' + body + foot + '</div></body></html>';
}

/* both languages in one page with a switch; the first one shown follows the app's language */
function inLang(lg, fn) { const H = root.IMPAK && root.IMPAK.HOST; if (!H) return fn(); const old = H.lang; H.lang = lg; try { return fn(); } finally { H.lang = old; } }
function bilingual(res, tm, meta) {
  const cur = lang(), part = (lg) => inLang(lg, () => transcript(res, tm, meta));
  const cut = (doc, a, b) => doc.slice(doc.indexOf(a), b ? doc.indexOf(b) : undefined);
  const ms = part('ms'), en = part('en');
  const head = cut(cur === 'ms' ? ms : en, '<!DOCTYPE html>', '<div class="bar-top"');
  const bar = (doc, lg) => cut(doc, '<div class="bar-top"', '<div class="page">').replace('<div class="bar-top"', '<div class="bar-top" data-for="' + lg + '"');
  const pg = (doc, lg) => cut(doc, '<div class="page">', '</body>').replace('<div class="page">', '<div class="page" data-for="' + lg + '" lang="' + lg + '">');
  const css = '<style>[data-for]{display:none}body[data-lang="ms"] [data-for="ms"],body[data-lang="en"] [data-for="en"]{display:block}body[data-lang] .bar-top[data-for]{display:none}body[data-lang="ms"] .bar-top[data-for="ms"],body[data-lang="en"] .bar-top[data-for="en"]{display:flex}' +
    '.lsw{display:inline-flex;border:1px solid #4f5b76;border-radius:6px;overflow:hidden}.lsw button{background:transparent;color:#fff;border-radius:0;padding:8px 12px;font-weight:500}body[data-lang="ms"] .lsw [data-lg="ms"],body[data-lang="en"] .lsw [data-lg="en"]{background:#4f7cff;font-weight:700}@media print{.bar-top{display:none!important}}</style>';
  const js = '<script>(function(){var b=document.body;function set(l){b.setAttribute("data-lang",l);document.documentElement.lang=l;document.title=' + JSON.stringify({ ms: inLang('ms', () => 'IMPAK – Transkrip – ' + (tm.id === 'you' ? 'Park anda' : tm.name)), en: 'IMPAK – Transcript – ' + (tm.id === 'you' ? 'Your park' : tm.name) }) + '[l];}' +
    'document.addEventListener("click",function(e){var x=e.target.closest("[data-lg]");if(x)set(x.getAttribute("data-lg"));});' +
    'document.addEventListener("input",function(e){var x=e.target.closest(".edit[data-k]");if(!x)return;var k=x.getAttribute("data-k");document.querySelectorAll(\'.edit[data-k="\'+k+\'"]\').forEach(function(y){if(y!==x)y.innerText=x.innerText;});});set(' + JSON.stringify(cur) + ');})();</' + 'script>';
  return head.replace('</head>', css + '</head>').replace('<body>', '<body data-lang="' + cur + '">') + bar(ms, 'ms') + bar(en, 'en') + pg(ms, 'ms') + pg(en, 'en') + js + '</body></html>';
}

/* open the transcript in a new tab; if the browser blocks it, download the page instead */
function open(res, tm, meta) {
  const doc = bilingual(res, tm, meta);
  const w = root.open('', '_blank');
  if (w && w.document) { w.document.open(); w.document.write(doc); w.document.close(); return true; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
  a.download = 'IMPAK-transcript-' + String(tm.name).replace(/[^\w-]+/g, '_') + '.html'; document.body.appendChild(a); a.click(); a.remove();
  return false;
}

root.IMPAKDebrief = { analyse, summary, html, transcript, bilingual, open, partInfo };
})(typeof window !== 'undefined' ? window : globalThis);
