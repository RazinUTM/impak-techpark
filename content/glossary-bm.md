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
| graduate (a startup leaving the incubator) | bergraduat |
| applicant · tenant | pemohon · penyewa |
| acres | ekar (map captions: *ek*) |
| Front screen · Room | Skrin hadapan · Bilik |
| "agrees on 3–6" | "bersetuju jika dadu 3–6" |

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

The tutor's steps quote these button names, so a change here must also change `content/texts.js` (`act.0.road`).
