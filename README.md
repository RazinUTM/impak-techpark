# IMPAK™ – Technovation Park

A browser game for training-of-trainers on science and technology park (STP) management. Teams develop the same 100-acre park month by month across three levels — Rintis (open the gates), Bina (grow the park), Lestari (survive and sustain) — take or decline Deal Room offers, survive a downturn and are scored against the level's mandate. Bahasa Melayu and English.

Version 0.6 (public trial): static HTML + JS on GitHub Pages at https://razinutm.github.io/impak-techpark/, with a Google Apps Script backend for live sessions, feedback and anonymous play statistics. Solo practice needs no sign-in.

## Play

- Open https://razinutm.github.io/impak-techpark/ (or scan the QR code on the start page).
- **Practice solo**: no sign-in. A game is kept in the browser and can be continued later; leaving early offers to fast-forward to a result or to delete the game.
- **Live session**: type the room code and team PIN given by the facilitator, then your name and e-mail. The facilitator's screen shows the clock, deals and medals.
- **Learn from the benchmarks**: scripted parks (Garden, Bold, Rocket, Caretaker and others) play the same seed. In News you can follow one of them, one quarter late, with the principle behind each move; Standings opens a study of how its impact grew and where it comes from; after each deal you see what the benchmarks chose; the debrief and the transcript show how the leading benchmark built its park. A facilitator can keep the benchmarks' moves hidden until the final bell.

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

Build: `pip install segno==1.6.6` once (QR code), then `python3 tools/build.py --check` (Python 3, and Node for the syntax check). Validate: `node tools/calib.js` (engine), `node tools/gs_test.js` (backend), `node tools/bench_unit.js` (benchmark learning), `node tools/shot.js`, `node tools/bench_test.js`, `node tools/live_test.js` and `node tools/live_bench_test.js` (screens, Playwright).

Hosting: publish `dist/index.html` with GitHub Pages (the repository must be public on a free account; the site is public either way). Paste the Apps Script web-app URL into `src/config.js` before building — see `apps-script/README.md`.

## Licence

- Software: MIT — Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia. See `LICENSE`.
- Game content in `content/`: CC BY-NC-ND 4.0. See `content/LICENSE`.
- Tutor avatar in `assets/tutor/`: all rights reserved, licensed to this game only. See `assets/tutor/LICENSE`.
- "IMPAK" and "IMPAK – Technovation Park" are the names of the game, used as an unregistered mark (™, no MyIPO filing yet); no trademark rights are granted. "Technovation Park" is the name of UTM's park; the game's map and conditions remain a fiction (see the caption on the site plan).

## Code authorship / Contributors

Ahmad Razin Zainal Abidin (Universiti Teknologi Malaysia) — game design, parameters, calibration, review.

## AI-assisted development

This software was developed with AI assistance (Claude, claude.ai). The author designed the game and the architecture, reviewed and verified the generated code, and made the decisions recorded in `DESIGN.md` and `DECISIONS.md`. Details: `AI_USAGE.md`.

## Third-party components

None bundled at runtime; a Google-hosted font is loaded by URL. See `THIRD_PARTY_LICENSES.md`.

## Validation status

Engine: 6,300 games × 2 runs — 0 determinism mismatches, 0 replay mismatches; style-bot means within ±1 point of the v0.5 calibration (300 seeds per level). Backend: 41 handler checks under Node stand-ins (rooms, joins, codes, orders, replay, feedback, run records, PIN lockout) and an end-to-end GM → team → front-screen run against a mock server; the real Google deployment is tested by the author. Screens: BM/EN, light/dark, desktop and 390 px phone screenshots. Benchmark learning: 845 Node checks against real game states (nothing shown beyond the one-quarter cut-off; impact sources equal the engine's monthly accrual) and Playwright checks of the study, news, deal reveal, debrief and the GM's hide option. See `DESIGN.md` s7 and `AI_USAGE.md`.

## Data and privacy

Live sessions store display name, e-mail, team and organisation (optional) in a private Google Sheet on a UTM account, for identifying teams and reporting results; records are deleted 12 months after the cohort report. Leaderboards show team names only.

Public trial (from November 2026): the start page says so. The feedback card (two ratings, two short answers, an optional e-mail) and anonymous play statistics (level, month reached, how the game ended, the reason chosen, medal, minutes played) go to the same private Sheet; no name, address or device identifier is sent, and a solo game is otherwise kept only in the player's browser. Feedback rows with an e-mail are deleted after 12 months. See `apps-script/README.md`, "Data kept".

## Disclaimer

A training game. Park economics, tenant behaviour and impact coefficients are simplified placeholders chosen for play balance; results are not forecasts and must not be used for investment, planning or policy decisions.

## How to cite

See `CITATION.cff`.
