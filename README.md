# IMPAK to the TechPark

A browser game for training-of-trainers on science and technology park (STP) management. Teams develop the same 100-acre park month by month across three levels — Rintis (open the gates), Bina (grow the park), Lestari (survive and sustain) — take or decline Deal Room offers, survive a downturn and are scored against the level's mandate. Bahasa Melayu and English.

Version 0.6 (in development): static HTML + JS on GitHub Pages, with a Google Apps Script backend for live sessions. Solo practice runs offline.

## Play

- Open the published page (link to be added once deployed).
- **Practice solo**: no sign-in, results are not recorded.
- **Live session**: type the room code and team PIN given by the facilitator, then your name and e-mail. The facilitator's screen shows the clock, deals and medals.

## Facilitators

See `apps-script/README.md` for deploying the backend (one Google Sheet + one Apps Script web app on a UTM Workspace account) and `content/run-sheet.md` for running a session.

## Repository

| Path | What |
| --- | --- |
| `src/` | engine (`engine.js`, shared with Apps Script), shell, guide, tutor, live and solo modes |
| `content/` | rule book, cards and texts (CC BY-NC-ND 4.0) |
| `assets/tutor/` | tutor avatar (author's personal mark; not for reuse) |
| `apps-script/` | backend: rooms, login, orders log, replay verification |
| `tools/` | `build.py` → `dist/index.html`; validation and image scripts |
| `dist/` | the built single file that GitHub Pages serves |

Build: `python3 tools/build.py --check` (Python 3 and Node for the syntax check). Validate: `node tools/calib.js` (engine), `node tools/gs_test.js` (backend), `node tools/shot.js` and `node tools/live_test.js` (screens, Playwright).

Hosting: publish `dist/index.html` with GitHub Pages (the repository must be public on a free account; the site is public either way). Paste the Apps Script web-app URL into `src/config.js` before building — see `apps-script/README.md`.

## Licence

- Software: MIT — Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia. See `LICENSE`.
- Game content in `content/`: CC BY-NC-ND 4.0. See `content/LICENSE`.
- Tutor avatar in `assets/tutor/`: all rights reserved, licensed to this game only. See `assets/tutor/LICENSE`.
- "IMPAK" and "IMPAK to the TechPark" are the names of the game; no trademark rights are granted.

## Code authorship / Contributors

Ahmad Razin Zainal Abidin (Universiti Teknologi Malaysia) — game design, parameters, calibration, review.

## AI-assisted development

This software was developed with AI assistance (Claude, claude.ai). The author designed the game and the architecture, reviewed and verified the generated code, and made the decisions recorded in `DESIGN.md` and `DECISIONS.md`. Details: `AI_USAGE.md`.

## Third-party components

None bundled at runtime; a Google-hosted font is loaded by URL. See `THIRD_PARTY_LICENSES.md`.

## Validation status

Engine: 6,300 games × 2 runs — 0 determinism mismatches, 0 replay mismatches; style-bot means within ±1 point of the v0.5 calibration (300 seeds per level). Backend: 23 handler checks under Node stand-ins and an end-to-end GM → team → front-screen run against a mock server; the real Google deployment is tested by the author. Screens: BM/EN, light/dark, desktop and 390 px phone screenshots. See `DESIGN.md` s7 and `AI_USAGE.md`.

## Data and privacy

Live sessions store display name, e-mail, team and organisation (optional) in a private Google Sheet on a UTM account, for identifying teams and reporting results; records are deleted 12 months after the cohort report. Leaderboards show team names only. Solo practice stores nothing.

## Disclaimer

A training game. Park economics, tenant behaviour and impact coefficients are simplified placeholders chosen for play balance; results are not forecasts and must not be used for investment, planning or policy decisions.

## How to cite

See `CITATION.cff`.
