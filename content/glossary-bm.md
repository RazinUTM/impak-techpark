# BM glossary for IMPAK – Technovation Park

Rules for the Bahasa Melayu interface (decided 6 Nov 2026, extending the earlier "technical terms stay in English" rule).

- **Audience:** park managers, TTO staff, academics and entrepreneurs (technical audience).
- **Register:** formal and neutral for the interface and cards (*anda*); the tutor may use a friendlier voice (*dah*, *tapi*), always with *anda*.
- **Rule:** game terms that the cards, the glossary and the score use under their English name stay in English, without brackets. Everyday words are in Malay.
- **Engine text:** `src/engine.js` stays in English because the server replays it. Its output (deal cards, deal outcomes, the news log, ESG reasons, tenant and works names) is translated for display by `content/game-ms.js`.

## Tier 2: kept in English (game terms)

| English | In BM text | Note |
|---|---|---|
| Deal Room · Take · Conditions · Leave | same | the three options are names on the buttons |
| impact (the scored metric) | impact | *impak* is used only for the socio-economic figures: *impak ekonomi* |
| upkeep · committed income · FCR12 · drift · headroom | same | |
| Development Fund · fund | same | |
| checkpoint · downturn | same | the downturn's severity is in Malay: *ringan, teruk, krisis* |
| linked · unlinked · back-office · Tech SME · spin-off · R&D anchor · startup · incubator | same | *startup*, not *start-up* |
| action point (AP) · bailout · receivership · mothball · sale and leaseback | same | |
| road · water · power · fibre (the four services) | same | the map badges are R W P F |
| services (what a zone needs before tenants move in) | services | *ada services*, not *serviced* or *perkhidmatan* |
| ground lease · lease · covenant · pre-let · build-to-suit | same | *pajak / pajakan* is fine as the verb or noun in prose |
| Shed · Retrofit · Workshop · Modular block · New Build · Converted factory | same | building types |
| facility names (Shared Prototyping Lab, University Lab Access, Incubator, Industry Liaison Office, Engagement Covenant, KPI & Impact Reporting, Park Management Team, Shared Services, Innovation programmes) | same | |
| zone names (Gateway, Old Workshops, Campus Edge, Highway Frontage, Central Plateau, Forest Ridge, Wetland, University Reserve) | same | *Zon* for "Zone" |
| green buffer · retention works · retention park · Forest clearance | same | |
| ESG · SDG · benchmark · park · Game Master · Cr · seed · PIN | same | *park benchmark* (not *penanda aras*) because the leaderboard chip says *benchmark* |

## Tier 1: translated

| English | BM |
|---|---|
| Phase 1 · 2 · 3 | Fasa 1 · 2 · 3 |
| Year 3 · month | Tahun 3 · bulan |
| team | pasukan |
| Gold · Silver · Bronze · Completed | Emas · Perak · Gangsa · Tamat |
| Threat · Opportunity | Ancaman · Peluang |
| die · roll | dadu · baling |
| interest (on loans) | faedah |
| graduate (a startup leaving the incubator) | bergraduat (not in Kamus Dewan; kept as a project term, 8 Nov) |
| applicant · tenant | pemohon · penyewa |
| acres | ekar (map captions: *ek*) |
| occupancy | penghunian (tile, tables, lessons, debrief) |
| target (park score, fund income) | sasaran |
| preview (Deal Room option effects) | pratonton |
| fee (bank restructuring) | fi |
| bankrupt | bankrap (not *muflis*) |
| final bell | loceng akhir |
| Home / start page | Halaman utama |
| scroll · zoom · pan | skrol · zum · anjak |
| "buys time" | memberi anda masa |
| "counts down" | semakin susut |
| clearing forest | membuka hutan / pembukaan hutan (not *membersihkan*) |
| private (the sheet) | persendirian |
| optional | tidak wajib |
| previous (stage) | sebelumnya |
| solid (box) | penuh |
| n/a | t/b |
| Front screen · Room | Skrin hadapan · Bilik |
| quarter (of a year) | suku tahun (*Suku 2, Tahun 1*) |
| a benchmark's move · key move | langkah · langkah penting |
| one quarter late | lewat satu suku tahun |
| the leading benchmark (debrief heading) | pendahulu (*Cara pendahulu membina park*) |
| the full study (benchmark dialog) | kajian penuh |
| net cash · units ready · firms | tunai bersih · unit siap · syarikat |
| sound · not sound (verdicts) | wajar · kurang wajar |
| "agrees on 3–6" | "bersetuju jika dadu 3–6" |
| university-linked (impact panel, prose) | berkait universiti (the tenant status stays *linked*) |
| water surcharge | surcaj air |
| Fit (viewport button) | Muat skrin (also where the tips quote it) |
| pause (verb in a sentence) | jedakan (*jeda* on the button) |
| play against | melawan |
| at your own pace | mengikut rentak sendiri |
| the park as it stands | keadaan park sekarang |
| Survive and sustain (Lestari) | Bertahan dan mampan |
| for months | berbulan-bulan |
| on a UTM account | di bawah akaun UTM |

## Register

- Interface, glossary, lessons, rules, debrief: formal (*apabila*, *tidak*, *memerlukan*).
- The tutor's lines (`content/texts.js`): friendlier (*bila*, *dah*, *tapi*), always with *anda*.
- Keyboard keys stay in English (*Space*, *Esc*, *Ctrl*).
- Value tiles are named by their visible label: *tile Tunai*, *tile Pinjaman*, *tile Development Fund*.
- No bracketed English glosses after a Malay word (*Penghunian*, not *Penghunian (occupancy)*).

## Kept in English by decision

- Admission policy names (*open*, *priority*, *linked*) and the special award titles (*Best Operator*, *Sound Judgement*…): they are names shown on the console and the front screen.
- Colour names in the legends (*teal*, *amber*).
- *trade-off*, *hover*, *banner*, *seed*, *Assumption ledger*.
- Zone names also in zone-panel hints (*Wetland · retention works dahulu*); *Forest clearance* where it names the work order (prose keeps *pembukaan hutan*).
- *Space bar* in the clock tip.

Exceptions the author accepted on 8 Nov 2026 (listed with reasons in `content/bm-lint-accepted.csv`, so the BM lint check does not report them): *dana tersebut* in the debrief tip on spending the fund; *Pekali impak* for the socio-economic coefficients in the Assumption ledger; the caretaker lesson's sentence as written.

## Work orders on the zone panel

| Engine label | BM button |
|---|---|
| Road link | Bina road |
| Complete road | Siapkan road |
| Water connection | Sambungan water |
| Power connection | Sambungan power |
| Power (shared substation) | Power (substation dikongsi) |
| Fibre | Pasang fibre |
| Forest clearance · Retention works | same |

PRPM lookups (7 and 8 Nov 2026), one at a time:

| Word | PRPM finding | Kept |
|---|---|---|
| penghunian | Kamus Inggeris-Melayu Dewan: *occupancy* → penghunian (occupying a house, building or land); *tempoh penghunian* for the period. https://prpm.dbp.gov.my/Cari1?keyword=occupancy | yes |
| fi | Kamus Dewan Edisi Keempat: payment charged for a service or professional advice. https://prpm.dbp.gov.my/Cari1?keyword=fi | yes |
| zum | Kamus Dewan Edisi Keempat: changing a lens's focal length to enlarge or shrink the image (*zum dekat*, *zum jauh*); 14 MABBIM and 41 Istilah entries. https://prpm.dbp.gov.my/Cari1?keyword=zum | yes |
| skrol | Kamus Dewan Edisi Keempat records the spelling (older sense: a roll of written material); 21 Istilah and 2 MABBIM entries carry the computing sense. https://prpm.dbp.gov.my/Cari1?keyword=skrol | yes |
| anjak | Kamus Dewan Edisi Keempat: *menganjak*, to move something from its place, usually by sliding it. *Pan* and *panning* have Istilah entries whose contents the page does not show, so no settled computing equivalent was confirmed; *menganjak* is kept as plain Malay for "drag to move the map". https://prpm.dbp.gov.my/Cari1?keyword=anjak | yes |
| fasa | Kamus Dewan Edisi Keempat: peringkat atau tahap dalam rangkaian sesuatu perkembangan; Glosari Sains Untuk Sekolah: *fasa* = phase. https://prpm.dbp.gov.my/Cari1?keyword=fasa&d=175768 (8 Nov) | yes |
| bankrap | Kamus Dewan Edisi Keempat: *bankrap*, synonym *muflis*; MABBIM (Ekonomi): bankrupt = bankrap; Khidmat Nasihat: the correct spelling is *bankrap*. Preferring *bankrap* over *muflis* is this project's choice; DBP accepts both. https://prpm.dbp.gov.my/Cari1?keyword=bankrap&d=175768 (8 Nov) | yes |
| pratonton | Kamus Inggeris-Melayu Dewan: preview = *pratonton*; Khidmat Nasihat (2018): preview = *pratonton* or *previu*. https://prpm.dbp.gov.my/Cari1?d=175768&keyword=pratonton (8 Nov) | yes |
| sebelumnya | Khidmat Nasihat (2014): previous = *sebelumnya* or *terdahulu*. https://prpm.dbp.gov.my/Cari1?d=175768&keyword=sebelumnya (8 Nov) | yes |
| bergraduat | Khidmat Nasihat (2009–2021): *graduat* and *graduasi* are not in Kamus Dewan Edisi Keempat or Kamus Dewan Perdana; a graduate (person) is *siswazah*. https://prpm.dbp.gov.my/Cari1?d=175768&keyword=graduat (8 Nov) | yes, as a declared project term: understood by the park managers, TTO staff and academics who play, and no DBP-recorded verb fits a startup leaving an incubator (Kamus Dewan has *inkubator* only as a device for eggs or newborns) |

The tutor's steps quote these button names, so a change here must also change `content/texts.js` (`act.0.road`).

Machine-checkable copy: `content/termbase-bm.csv` (columns `en, bm, tier, reject, status, source, note`), checked by the *BM lint* workflow on every pull request. Change the two together.
