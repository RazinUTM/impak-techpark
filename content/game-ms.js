/* IMPAK – Technovation Park — Bahasa Melayu text for what the engine writes in English:
   deal cards, deal outcomes, the park's news log, ESG reasons, tenant and works names.
   Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia.
   Licensed under CC BY-NC-ND 4.0 — see content/LICENSE. Not covered by the MIT licence of the code.
   The engine (src/engine.js) stays verbatim in English because the server replays it; the views translate its
   output through these tables. Game terms (Deal Room, Take/Conditions/Leave, impact, linked, upkeep, road/water/
   power/fibre, facility and building names, zone names) stay in English, as recorded in content/glossary-bm.md. */
(function (root) {
'use strict';
const DIE = (a) => ' (bersetuju jika dadu ' + a + ')';
const CARDS = {
  contractor: { title: 'Tawaran pukal kontraktor', text: 'Sebuah kontraktor menawarkan dua New Build pada harga tetap 12 Cr, siap dalam 12 bulan, jika anda menandatangani sekarang.',
    T: 'Tandatangani untuk dua New Build (12 Cr; Development Fund membayar 80% selagi masih ada).', C: 'Minta satu bangunan sahaja, 6.5 Cr' + DIE('3–6') + '.', L: 'Tolak.' },
  datacentre: { title: 'Ground lease pusat data', text: 'Pengendali pusat data mahukan ground lease 30 tahun di satu plot Highway Frontage. Ia akan menggunakan elektrik grid sepanjang masa.',
    T: 'Pajakkan seperti ditawarkan di Zon D: +1.5 Cr setahun, 2 unit unlinked, tiada syarat tenaga (−2 ESG); mungkin gagal bayar semasa downturn.',
    C: 'Pajakkan plot pilihan anda dengan covenant tenaga boleh baharu dan kegunaan penyelidikan: +1.0 Cr dan +1 impact setahun, linked. Pengendali bersetuju jika dadu 3–6; plot yang dipilih mengubah nilainya.', L: 'Simpan plot itu.' },
  donor: { title: 'Penderma menawarkan peralatan', text: 'Sebuah syarikat industri menawarkan peralatan prototaip secara percuma. Kontrak servisnya ditanggung anda.',
    T: 'Terima: upkeep 1.2 Cr setahun; +1 impact setahun selagi anda ada 2 atau lebih penyewa linked.', C: 'Terima hanya jika penderma membayar kontrak servis hingga akhir Tahun 4' + DIE('4–6') + '.', L: 'Tolak.' },
  jv: { title: 'Joint venture incubator swasta', text: 'Sebuah accelerator swasta akan menjalankan inkubasi bersama di premisnya sendiri dan membawa startup sekarang. Ia mahu memilih startup itu sendiri.',
    T: 'Terima seperti ditawarkan: +2 Cr dan 3 startup sekarang; kadar bergraduat mereka separuh; pada Tahun 4 rakan kongsi mungkin keluar bersama mereka.',
    C: 'Terima dengan panel pemilihan bersama: +1 Cr dan 2 startup, kadar bergraduat biasa, tiada klausa keluar' + DIE('3–6') + '.', L: 'Tolak.' },
  flood: { title: 'Amaran banjir', text: 'Pakar hidrologi memberi amaran bahawa tanah rendah (Zon E dan G) mungkin dilanda banjir pada pertengahan Tahun 3.',
    T: 'Bina saliran kecemasan sekarang: 1.5 Cr, melindungi Zon E dan G secara kekal.', C: 'Beli insurans banjir: 0.3 Cr setahun, menanggung kos pembaikan.', L: 'Ambil risiko.' },
  telecom: { title: 'Tawaran fibre telco', text: 'Sebuah telco menawarkan untuk memasang fibre ke setiap zon secara percuma, sebagai balasan hak eksklusif dan 5% daripada sewa anda.',
    T: 'Terima: fibre di semua zon dalam 2 bulan; 5% sewa kepada telco mulai itu.', C: 'Fibre ke tiga zon yang ada road, tanpa perkongsian sewa' + DIE('3–6') + '.', L: 'Tolak.' },
  inquiry: { title: 'Pertanyaan anchor', text: 'Sebuah syarikat multinasional mahukan 6 unit untuk pusat R&D dalam 12 bulan, jika anda memulakan New Build sekarang.',
    T: 'Mulakan New Build sekarang (7 Cr, Development Fund terpakai); anchor itu membuat pre-let, tetapi masih mungkin menarik diri (1 dalam 3).',
    C: 'Tawarkan 3 unit dalam ruang sedia ada apabila siap (perlukan Lab atau Lab Access; anchor bersetuju jika dadu 3–6).', L: 'Tolak.' },
  developer: { title: 'Pemaju mahukan tanah rizab', text: 'Sebuah pemaju hartanah menawarkan untuk memajak dua plot University Reserve yang baharu (Zon H).',
    T: 'Pajakkan dua plot seperti ditawarkan: +1.5 Cr setahun setiap satu, unlinked; mungkin gagal bayar semasa downturn.',
    C: 'Pajakkan satu plot dengan syarat reversion dan covenant: +1.2 Cr dan +1 impact setahun, linked' + DIE('3–6') + '.', L: 'Simpan tanah itu.' },
  bts: { title: 'Anchor build-to-suit', text: 'Sebuah R&D anchor akan menyewa seluruh bangunan 6 unit di Zon H jika anda membinanya, dengan hak eksklusif dalam sektornya.',
    T: 'Bina: 7 Cr daripada tunai atau pinjaman; 4.0 Cr dan +4 impact setahun selepas siap; hanya satu kemasukan linked setiap suku tahun.',
    C: 'Tawarkan 3 unit dalam ruang sedia ada, tanpa hak eksklusif (perlukan Lab atau Lab Access; anchor bersetuju jika dadu 3–6).', L: 'Tolak.' },
  agency: { title: 'Penempatan bersama agensi', text: 'Sebuah agensi kerajaan mahukan 3 unit untuk lima tahun. Ia tidak pernah keluar dan tidak pernah tawar-menawar.',
    T: 'Sewakan 3 unit: 1.2 Cr setiap satu setahun, unlinked.', C: 'Sewakan 3 unit jika agensi itu menjalankan meja sokongan SME: linked, +1 impact setahun' + DIE('4–6') + '.', L: 'Tolak.' },
  rector: { title: 'Rektor mahukan bahagian', text: 'Rektor baharu meminta park membayar sebahagian daripada lebihan pendapatan kepada universiti.',
    T: 'Terima: 20% daripada setiap lebihan bulanan.', C: 'Rundingkan peraturan lebihan: 10% jika dadu 3–6, 30% jika dadu 1–2.', L: 'Tolak: peruntukan universiti dihentikan dan hubungan yang tegang menelan 2 impact.' },
  factory: { title: 'Kilang bermasalah', text: 'Sebuah kilang berjiran telah ditutup. Bangunannya, yang sudah lengkap dengan services, dijual.',
    T: 'Beli: 3 Cr daripada tunai atau pinjaman, 4 unit siap dalam 3 bulan, upkeep 1.0 Cr setahun.', C: 'Beli bersama sebuah Tech SME yang sudah bersetuju untuk masuk' + DIE('4–6') + '.', L: 'Tolak.' },
  natlab: { title: 'Pemindahan makmal kebangsaan', text: 'Sebuah makmal kebangsaan sedang berpindah dan memerlukan plot rizab bersebelahan universiti.',
    T: 'Tawarkan plot rizab anda di Zon H: +1.0 Cr dan +3 impact setahun, linked.', L: 'Tolak.' },
  holiday: { title: 'Anchor minta cuti sewa', text: 'Penyewa anchor anda sedang bergelut dan meminta cuti sewa sehingga downturn berakhir.',
    T: 'Beri: tiada sewa daripada anchor anda sepanjang baki permainan, tetapi mereka kekal.', C: 'Tawarkan separuh sewa: mereka kekal jika dadu 3–6, keluar jika dadu 1–2.', L: 'Tolak: mereka keluar jika dadu 1–4.' },
  restructure: { title: 'Bank menawarkan penstrukturan semula', text: 'Bank anda menawarkan untuk menetapkan kadar pinjaman anda pada 10% dengan fi 1 Cr.',
    T: 'Bayar 1 Cr dan tetapkan kadar.', L: 'Tolak.' },
  stimulus: { title: 'Stimulus startup', text: 'Kerajaan membayar park yang ada incubator supaya startup terus bertahan sepanjang downturn.',
    T: 'Sertai: +0.5 Cr bagi setiap startup sekarang dan satu pemohon startup tambahan setiap suku tahun.', L: 'Tolak.' },
  talent: { title: 'Bakat dilepaskan', text: 'Penutupan syarikat telah melepaskan jurutera berpengalaman yang mahu menubuhkan syarikat sendiri.',
    T: 'Biayai program pengasas: 1 Cr, tiga pemohon spin-off sekarang.', C: 'Biayai bersama universiti: 0.5 Cr, dua pemohon spin-off' + DIE('3–6') + '.', L: 'Tolak.' },
  solar: { title: 'Tawaran kanopi solar', text: 'Sebuah syarikat tenaga menawarkan kanopi solar di atas tempat letak kereta dan bumbung bangunan anda.',
    T: 'Beli sistem: 1.5 Cr; upkeep turun 0.3 Cr setahun secara kekal dan ESG +2.', C: 'Power-purchase agreement: tiada kos pendahuluan, upkeep turun 0.1 Cr setahun, ESG +1' + DIE('3–6') + '.', L: 'Tolak.' },
  chemical: { title: 'Firma kimia mahu masuk', text: 'Sebuah firma kimia khusus menawarkan sewa tertinggi di rantau ini untuk 2 unit. Prosesnya melepaskan sisa ke anak sungai.',
    T: 'Sewakan 2 unit seperti ditawarkan: 2.0 Cr setahun, unlinked, ESG −3, dan peluang tumpahan 1 dalam 6 setiap tahun (denda 2 Cr, −2 ESG, −3 impact).',
    C: 'Sewakan 2 unit dengan covenant zero-discharge: 1.5 Cr setahun, unlinked, ESG −1, tiada risiko tumpahan' + DIE('4–6') + '.', L: 'Tolak.' },
  greencert: { title: 'Pensijilan park hijau', text: 'Sebuah badan pensijilan menawarkan untuk mengaudit dan mengiktiraf park sebagai daerah inovasi hijau.',
    T: 'Dapatkan sijil: 1 Cr dan 0.2 Cr setahun; ESG +2, dan selagi ESG 3 atau lebih, satu pemohon linked tambahan setiap suku tahun.', L: 'Tolak.' },
  audit: { title: 'Audit alam sekitar', text: 'Sebuah kumpulan komuniti telah menugaskan audit alam sekitar ke atas park. Keputusannya bergantung pada rekod ESG anda.',
    T: 'Lulus (ESG 2 atau lebih): terbitkan laporan, 0.2 Cr, +2 impact dan ESG +1. Gagal: bayar 1 Cr untuk pemulihan, ESG +2.', C: 'Jika gagal sahaja: pelan pemulihan bersama universiti, 0.5 Cr, ESG +2 (dipersetujui jika dadu 3–6).',
    L: 'Abaikan. Jika gagal: −3 impact dan ESG −2.' },
  drought: { title: 'Tahun kemarau', text: 'Tahun yang kering menekan bekalan air di rantau ini. Park tanpa simpanan air sendiri perlu membayar air yang dihantar dengan lori tangki.',
    T: 'Penuaian air hujan: 0.8 Cr, ESG +1, kebal sekarang dan pada masa depan.', C: 'Kongsi skim simpanan air dengan universiti: 0.4 Cr, ESG +1 (dipersetujui jika dadu 3–6).',
    L: 'Bayar surcaj air: upkeep +0.4 Cr setahun selama 12 bulan (retention park menjadikan anda kebal).' },
};

/* names the engine uses inside sentences */
const TEN = { backoffice: 'Back-office korporat', sme: 'Tech SME', spinoff: 'Spin-off universiti', anchor: 'R&D anchor', bigAnchor: 'R&D anchor (build-to-suit)',
  agency: 'Agensi kerajaan', agencyL: 'Meja SME agensi', chem: 'Firma kimia', chemC: 'Firma kimia (zero discharge)' };
const TEN_EN2MS = {}; // filled below from the engine labels
const WORKS = { road: 'Bina road', roadHalf: 'Siapkan road', water: 'Sambungan water', power: 'Sambungan power', powerShared: 'Power (substation dikongsi)', fibre: 'Pasang fibre', clear: 'Forest clearance', retention: 'Retention works' };
const WORKS_EN2MS = {};
const SEV = { Mild: 'ringan', Severe: 'teruk', Crisis: 'krisis', mild: 'ringan', severe: 'teruk', crisis: 'krisis' };
const MON = { Jan: 'Jan', Feb: 'Feb', Mar: 'Mac', Apr: 'Apr', May: 'Mei', Jun: 'Jun', Jul: 'Jul', Aug: 'Ogo', Sep: 'Sep', Oct: 'Okt', Nov: 'Nov', Dec: 'Dis' };
const ESG_WHY = {
  'audit failure ignored': 'kegagalan audit diabaikan', 'audit passed and published': 'audit lulus dan diterbitkan', 'building on the former wetland': 'bangunan di bekas tanah lembap',
  'chemical spill into the creek': 'tumpahan kimia ke anak sungai', 'chemicals firm under a zero-discharge covenant': 'firma kimia di bawah covenant zero-discharge',
  'chemicals firm discharging to the creek': 'firma kimia melepaskan sisa ke anak sungai', 'data centre on grid power, no conditions': 'pusat data menggunakan elektrik grid, tanpa syarat',
  'drainage protects the low ground': 'saliran melindungi tanah rendah', 'forest clearance on the ridge': 'pembukaan hutan di rabung', 'green buffer kept on the ridge': 'green buffer dikekalkan di rabung',
  'joint restoration plan': 'pelan pemulihan bersama', 'park certified green': 'park disijilkan hijau', 'rainwater harvesting': 'penuaian air hujan', 'restoration works after the audit': 'kerja pemulihan selepas audit',
  'retention works finished': 'retention works siap', 'shared water storage': 'simpanan air bersama', 'solar canopies bought': 'kanopi solar dibeli', 'solar power-purchase agreement': 'power-purchase agreement solar',
  'wetland kept as a retention park': 'tanah lembap dikekalkan sebagai retention park',
};
function esgWhy(w) { let m; if (ESG_WHY[w]) return ESG_WHY[w]; if ((m = /^data centre sited on Zone (\w)$/.exec(w))) return 'pusat data ditempatkan di Zon ' + m[1]; return w; }
function mon(s) { return String(s).replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) Y(\d)\b/g, (x, a, y) => MON[a] + ' T' + y); }

/* deal outcomes: what follows "Card title: " */
const SAY_EXACT = {
  'the contractor walked away.': 'kontraktor menarik diri.', 'no free plot on Zone D: the operator went elsewhere.': 'tiada plot kosong di Zon D: pengendali beralih ke tempat lain.',
  'lease signed as offered.': 'pajakan ditandatangani seperti ditawarkan.', 'no plot to offer.': 'tiada plot untuk ditawarkan.', 'equipment accepted.': 'peralatan diterima.',
  'equipment accepted; donor pays the service contract to the end of Year 4.': 'peralatan diterima; penderma membayar kontrak servis hingga akhir Tahun 4.',
  'the donor declined the condition.': 'penderma menolak syarat itu.', '+2 Cr and 3 startups.': '+2 Cr dan 3 startup.', '+1 Cr and 2 startups, joint selection.': '+1 Cr dan 2 startup, pemilihan bersama.',
  'the partner declined joint selection.': 'rakan kongsi menolak pemilihan bersama.', 'drainage built; Zones E and G protected.': 'saliran siap; Zon E dan G dilindungi.',
  'insurance bought (0.3 Cr a year).': 'insurans dibeli (0.3 Cr setahun).', 'fibre coming to every zone; 5% of rent to the telco.': 'fibre akan dipasang di setiap zon; 5% sewa kepada telco.',
  'the telco declined.': 'telco menolak.', 'the anchor will take 3 units when space is ready.': 'anchor akan mengambil 3 unit apabila ruang siap.', 'the anchor declined.': 'anchor menolak.',
  'plots leased as offered.': 'plot dipajak seperti ditawarkan.', 'one plot leased with conditions.': 'satu plot dipajak dengan syarat.', 'the developer declined.': 'pemaju menolak.',
  'build-to-suit started on Zone H.': 'build-to-suit dimulakan di Zon H.', 'the agency declined the SME desk.': 'agensi menolak meja SME.', '20% of surplus to the university.': '20% lebihan kepada universiti.',
  'refused; the allocation stops.': 'ditolak; peruntukan universiti dihentikan.', 'factory bought; ready in 3 months.': 'kilang dibeli; siap dalam 3 bulan.', 'the seller declined.': 'penjual menolak.',
  'the national lab is coming to Zone H.': 'makmal kebangsaan akan berpindah ke Zon H.', 'rent holiday granted.': 'cuti sewa diberikan.', 'anchors stay at half rent.': 'anchor kekal dengan separuh sewa.',
  'the anchors left.': 'anchor telah keluar.', 'refused; the anchors left.': 'ditolak; anchor telah keluar.', 'refused; the anchors stayed.': 'ditolak; anchor kekal.', 'rate fixed at 10%.': 'kadar ditetapkan pada 10%.',
  'solar canopies installed; upkeep −0.3 Cr a year.': 'kanopi solar dipasang; upkeep −0.3 Cr setahun.', 'PPA signed; upkeep −0.1 Cr a year.': 'PPA ditandatangani; upkeep −0.1 Cr setahun.',
  'the company declined.': 'syarikat menolak.', 'no serviced 2-unit space free.': 'tiada ruang 2 unit dengan services yang kosong.', 'the firm refused the covenant.': 'firma menolak covenant itu.',
  'certified.': 'disijilkan.', 'passed; report published (+2 impact).': 'lulus; laporan diterbitkan (+2 impact).', 'passed; nothing published.': 'lulus; tiada laporan diterbitkan.',
  'failed; restoration paid.': 'gagal; kos pemulihan dibayar.', 'failed; joint plan agreed.': 'gagal; pelan bersama dipersetujui.', 'failed; the university declined the plan (−3 impact).': 'gagal; universiti menolak pelan itu (−3 impact).',
  'failed and ignored (−3 impact).': 'gagal dan diabaikan (−3 impact).', 'storage built.': 'simpanan air dibina.', 'shared scheme agreed.': 'skim bersama dipersetujui.',
  'the university declined; your retention park covers you.': 'universiti menolak; retention park anda melindungi anda.', 'the university declined; water surcharge for 12 months.': 'universiti menolak; surcaj air selama 12 bulan.',
  'water surcharge for 12 months.': 'surcaj air selama 12 bulan.', 'your storage covers you.': 'simpanan air anda melindungi anda.', 'the university declined.': 'universiti menolak.',
  'does not apply to your park.': 'tidak terpakai untuk park anda.',
};
const SAY_RE = [
  [/^two New Builds under way( in Zone (\w))?\.$/, (m) => 'dua New Build sedang dibina' + (m[2] ? ' di Zon ' + m[2] : '') + '.'],
  [/^one New Build under way( in Zone (\w))?\.$/, (m) => 'satu New Build sedang dibina' + (m[2] ? ' di Zon ' + m[2] : '') + '.'],
  [/^lease signed with conditions on Zone (\w)(; income starts once the zone has road and power)?\.$/, (m) => 'pajakan bersyarat ditandatangani di Zon ' + m[1] + (m[2] ? '; pendapatan bermula apabila zon itu ada road dan power' : '') + '.'],
  [/^the operator declined the plot on Zone (\w) \(needed (\d)–6\)\.$/, (m) => 'pengendali menolak plot di Zon ' + m[1] + ' (perlu dadu ' + m[2] + '–6).'],
  [/^fibre coming to (\d+) zones\.$/, (m) => 'fibre akan dipasang di ' + m[1] + ' zon.'],
  [/^New Build (\S+) started for the anchor\.$/, (m) => 'New Build ' + m[1] + ' dimulakan untuk anchor.'],
  [/^(\d+) agency units let( \(not enough serviced space for all 3\))?\.$/, (m) => m[1] + ' unit disewakan kepada agensi' + (m[2] ? ' (ruang dengan services tidak cukup untuk ketiga-tiganya)' : '') + '.'],
  [/^(10|30)% of surplus agreed\.$/, (m) => m[1] + '% lebihan dipersetujui.'],
  [/^\+([\d.]+) Cr; an extra startup applicant each quarter\.$/, (m) => '+' + m[1] + ' Cr; satu pemohon startup tambahan setiap suku tahun.'],
  [/^the firm moved into (\S+)\.$/, (m) => 'firma itu masuk ke ' + m[1] + '.'],
  [/^(\d+) spin-off applicants\.$/, (m) => m[1] + ' pemohon spin-off.'],
];
function sayMS(s) { if (SAY_EXACT[s]) return SAY_EXACT[s]; for (const [re, f] of SAY_RE) { const m = re.exec(s); if (m) return f(m); } return s; }

/* the news log */
const NOTE_EXACT = {
  'A Zone H plot was reserved for a named future user.': 'Satu plot Zon H dirizabkan untuk pengguna masa depan yang dinamakan.',
  'Forest Ridge declared a green buffer (+1 impact a year).': 'Forest Ridge diisytiharkan green buffer (+1 impact setahun).',
  'Wetland made a retention park (+1 impact a year).': 'Wetland dijadikan retention park (+1 impact setahun).',
  'Back-office rents renegotiated to 70% for 12 months.': 'Sewa back-office dirunding semula kepada 70% selama 12 bulan.',
  'Land Grant: Zone H is released. Each plot needs a signed use by the end of Year 3.': 'Land Grant: Zon H dilepaskan. Setiap plot perlu penggunaan yang ditandatangani sebelum akhir Tahun 3.',
  'Zone F cleared.': 'Hutan Zon F telah dibuka.', 'Retention works finished: Zones E and G protected.': 'Retention works siap: Zon E dan G dilindungi.',
  'The anchor lost patience and went elsewhere.': 'Anchor hilang sabar dan beralih ke tempat lain.',
  'Flood: the low ground flooded, but none of your buildings was hit.': 'Banjir: tanah rendah dinaiki air, tetapi tiada bangunan anda terjejas.',
  'Spill at the chemicals plant: 2 Cr fine, −3 impact.': 'Tumpahan di loji kimia: denda 2 Cr, −3 impact.',
  'Second bankruptcy: the park is in receivership.': 'Bankrap kali kedua: park dalam receivership.',
  'Bankrupt: the university bailed the park out (−5 impact, one action point fewer next quarter).': 'Bankrap: universiti menyelamatkan park (−5 impact, kurang satu action point pada suku tahun berikutnya).',
};
let NOTE_RE = null;
function noteRules(whyL, titleMap) {
  return [
    [/^ESG ([+−-]?[\d.]+): (.*)\.$/, (m) => 'ESG ' + m[1] + ': ' + esgWhy(m[2]) + '.'],
    [/^Order refused: (.*)$/, (m) => 'Arahan ditolak: ' + whyL(m[1])],
    [/^(.+) started in Zone (\w)( \(approval delayed 3 months\))?; done end of (.+)\.$/, (m) => (WORKS_EN2MS[m[1]] || m[1]) + ' dimulakan di Zon ' + m[2] + (m[3] ? ' (kelulusan lewat 3 bulan)' : '') + '; siap hujung ' + m[4] + '.'],
    [/^Retrofit of (\S+) started; ready end of (.+)\.$/, (m) => 'Retrofit ' + m[1] + ' dimulakan; siap hujung ' + m[2] + '.'],
    [/^(.+?) (\S+) started( \(speculative: no demand gate\))?(; overrun \+([\d.]+) Cr)?; ready end of (.+)\.$/, (m) => m[1] + ' ' + m[2] + ' dimulakan' + (m[3] ? ' (spekulatif: demand gate tidak dipenuhi)' : '') + (m[4] ? '; kos lebihan +' + m[5] + ' Cr' : '') + '; siap hujung ' + m[6] + '.'],
    [/^(.+) launched\.$/, (m) => m[1] + ' dilancarkan.'],
    [/^(.+) joined the incubator\.$/, (m) => m[1] + ' menyertai incubator.'],
    [/^(.+) \((.+)\) moved into (\S+)\.$/, (m) => m[1] + ' (' + (TEN_EN2MS[m[2]] || m[2]) + ') masuk ke ' + m[3] + '.'],
    [/^Borrowed ([\d.]+) Cr\.$/, (m) => 'Meminjam ' + m[1] + ' Cr.'],
    [/^Repaid ([\d.]+) Cr\.$/, (m) => 'Membayar balik ' + m[1] + ' Cr.'],
    [/^Admission policy changed to (\w+) \(−2 impact\)\.$/, (m) => 'Polisi kemasukan ditukar kepada ' + m[1] + ' (−2 impact).'],
    [/^(\S+) mothballed\.$/, (m) => m[1] + ' di-mothball.'],
    [/^(\S+) reopened\.$/, (m) => m[1] + ' dibuka semula.'],
    [/^(\S+) sold for (\d+) Cr and leased back\.$/, (m) => m[1] + ' dijual pada harga ' + m[2] + ' Cr dan disewa semula.'],
    [/^Innovation programme budget set to (\d+) Cr a year\.$/, (m) => 'Bajet Innovation programmes ditetapkan pada ' + m[1] + ' Cr setahun.'],
    [/^Forecast: economists expect a (\w+) downturn from (.+)\. Rates will rise and the bank will cut the loan limit to (\d+) Cr\.$/, (m) => 'Ramalan: pakar ekonomi menjangka downturn ' + (SEV[m[1]] || m[1]) + ' bermula ' + m[2] + '. Kadar faedah akan naik dan bank akan memotong had pinjaman kepada ' + m[3] + ' Cr.'],
    [/^Downturn: (\w+)\. Tenants are closing, rates are rising and the bank has cut the loan limit to (\d+) Cr\.$/, (m) => 'Downturn ' + (SEV[m[1]] || m[1]) + '. Penyewa mula menutup operasi, kadar faedah meningkat dan bank telah memotong had pinjaman kepada ' + m[2] + ' Cr.'],
    [/^(.+) finished in Zone (\w)\.$/, (m) => (WORKS_EN2MS[m[1]] || m[1]) + ' siap di Zon ' + m[2] + '.'],
    [/^(.+) is ready \((\d+) units\)(\.|, but the zone lacks services: nobody can move in yet\.)$/, (m) => m[1] + ' siap (' + m[2] + ' unit)' + (m[3] === '.' ? '.' : ', tetapi zon itu belum ada services lengkap: belum ada penyewa boleh masuk.')],
    [/^The anchor moved into (\S+)\.$/, (m) => 'Anchor masuk ke ' + m[1] + '.'],
    [/^The anchor withdrew: (\S+) stands empty\.$/, (m) => 'Anchor menarik diri: ' + m[1] + ' kosong.'],
    [/^(\d+) unsigned Zone H plot\(s\) reclaimed by the university\.$/, (m) => m[1] + ' plot Zon H yang belum ditandatangani diambil semula oleh universiti.'],
    [/^Flood: (\d+) building\(s\) in Zones E and G damaged (\(insured\)|\(([\d.]+) Cr repairs\))\.$/, (m) => 'Banjir: ' + m[1] + ' bangunan di Zon E dan G rosak ' + (m[3] ? '(pembaikan ' + m[3] + ' Cr).' : '(dilindungi insurans).')],
    [/^The JV partner exited and took (\d+) startups \(−2 impact\)\.$/, (m) => 'Rakan JV keluar dan membawa ' + m[1] + ' startup (−2 impact).'],
    [/^Downturn: (\d+) tenant\(s\) closed\.$/, (m) => 'Downturn: ' + m[1] + ' penyewa menutup operasi.'],
    [/^Downturn: (\d+) ground lease\(s\) defaulted\.$/, (m) => 'Downturn: ' + m[1] + ' ground lease gagal dibayar.'],
    [/^(.+) left the park\.$/, (m) => m[1] + ' keluar dari park.'],
    [/^(.+) graduated and moved into (\S+)\.$/, (m) => m[1] + ' bergraduat dan masuk ke ' + m[2] + '.'],
    [/^(.+) graduated and left for larger premises\.$/, (m) => m[1] + ' bergraduat dan berpindah ke premis yang lebih besar.'],
    [/^(.+) reached the maximum stay and left\.$/, (m) => m[1] + ' mencapai tempoh maksimum dan keluar.'],
    [/^(.+) joined the engagement covenant\.$/, (m) => m[1] + ' menyertai Engagement Covenant.'],
    [/^Cash ran out: emergency loan of ([\d.]+) Cr at (\d+)%\.$/, (m) => 'Tunai habis: pinjaman kecemasan ' + m[1] + ' Cr pada ' + m[2] + '%.'],
    [/^([\d.]+) Cr of the Development Fund lapsed\.$/, (m) => m[1] + ' Cr daripada Development Fund luput.'],
    [/^(.+) closed\.$/, (m) => m[1] + ' ditutup.'],
  ];
}
/* text: one engine log line; whyL: the order-refusal translator from the game core; cardTitles: { english title: card id } */
function note(text, whyL, cardTitles) {
  if (!text) return text;
  if (NOTE_EXACT[text]) return NOTE_EXACT[text];
  const i = text.indexOf(': ');
  if (i > 0 && cardTitles[text.slice(0, i)]) { const id = cardTitles[text.slice(0, i)]; return CARDS[id].title + ': ' + mon(sayMS(text.slice(i + 2))); }
  if (!NOTE_RE) NOTE_RE = noteRules(whyL);
  for (const [re, f] of NOTE_RE) { const m = re.exec(text); if (m) return mon(f(m)); }
  return mon(text);
}
function init(PB) {
  for (const k in TEN) if (PB.CFG.TEN[k]) TEN_EN2MS[PB.CFG.TEN[k].label] = TEN[k];
  for (const k in WORKS) if (PB.CFG.WORKS[k]) WORKS_EN2MS[PB.CFG.WORKS[k].label] = WORKS[k];
}
root.IMPAK_MS = { CARDS, TEN, WORKS, SEV, esgWhy, sayMS, note, mon, init };
})(typeof window !== 'undefined' ? window : globalThis);
