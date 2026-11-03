# DESIGN — IMPAK to the TechPark v0.6

Drafted by AI from the author's description and decisions of 3 Nov 2026 — reviewed and amended by: ___ on ___.

## 1. What it is

A browser game for training-of-trainers (TOT) on science and technology park (STP) management. Each team develops the same 100-acre park (zones A–H) against a month-by-month clock across three levels (Rintis 3 yr · Bina 4 yr · Lestari 5 yr), takes or declines Deal Room offers, survives a downturn, and is scored (A–E parts, Gold/Silver/Bronze by threshold with a park gate). The v0.5 engine, parameters, scoring and calibration are kept unchanged; v0.6 changes the platform, the shell and the access model.

## 2. Platform and architecture (decision B)

```
 participant browser(s)                      GitHub Pages (static)
 ┌──────────────────────────┐   GET          ┌──────────────────────┐
 │ dist/index.html          │◄───────────────│ shell + engine.js    │
 │  shell · guide · tutor   │                │ + content + avatar   │
 │  engine.js (local run)   │                └──────────────────────┘
 └──────┬───────────▲───────┘
        │ JSONP/fetch│ (live mode only; solo = none)
        ▼           │
 ┌──────────────────┴───────┐   bound to    ┌──────────────────────┐
 │ Apps Script web app      │──────────────►│ private Google Sheet │
 │  rooms · login · orders  │               │  rooms teams players │
 │  deals · messages        │               │  orders deals msgs   │
 │  replay(engine.js) ─► official scores    │  results users       │
 └──────────────────────────┘               └──────────────────────┘
```

- **One engine, two runtimes.** `src/engine.js` has no DOM or Google dependencies and is loaded both by the page and by Apps Script (as `engine.gs`, same text). Given `(level, seed, ordersLog)` it is deterministic.
- **Clock.** The room stores `startAt` (epoch ms) and `pace` (s/month). Each browser computes the current month from `Date.now()`; the server is the reference when writing orders (an order carries the month the server sees).
- **Orders log.** Append-only rows `(room, team, month, seq, type, payload, clientHash)`. The browser applies orders locally at once; the server stores them. Official results = replay of the log at the end (`replay(room)`), compared with each team's self-reported score; mismatch → `flag = tampered`.
- **Deals and GM messages.** Server-side; clients poll `state(room, team, since)` every 5–10 s. Die rolls for deals are drawn on the server from the room seed, so all replays agree.
- **Solo practice.** No backend: engine + a local seed; results shown with "Practice · not recorded".
- **Limits respected.** ≤ 30 simultaneous executions per user; ≤ 9 KB per PropertiesService value, so room state is in Sheet rows and CacheService (≤ 100 KB per value, 6 h); LockService around writes; polls ≈ 3 request/s for 26 devices.

## 3. Login (as in the tenancy app)

- Web app deployed "Execute as me", access "Anyone" (TOT participants are outsiders). Identity is **name + e-mail** typed at join.
- Verification tiers: L0 self-declared (room sessions, facilitator vouches); L1 e-mailed 6-digit code (MailApp, 10-minute validity, 5 attempts then 15-minute lockout) for remote sessions. Tier is a room setting.
- Facilitators (GM) are listed in the `users` tab (e-mail, role, active) exactly as in the tenancy app; a GM must also pass a GM PIN per room.
- Data held: display name, e-mail, team, organisation (optional), room, timestamps. No phone, no IC. Leaderboards and the front screen show team names only. A PDPA notice is shown at join; retention 12 months after the cohort report; the Sheet is private.

## 4. Screen layout (Cable Lab shell)

Seven areas, same grid as Cable Lab: stage menu (top) · settings (top right) · controls (left) · viewport (centre top) · results (centre bottom, foldable) · guide (right) · simulation bar (bottom). The ⓘ "How this screen is organised" overlay and tour are kept.

| Area | IMPAK content |
| --- | --- |
| Stage menu | Level Rintis / Bina / Lestari with ‹ ›; phase badges (Fund → Land grant → Downturn); activity progress ✓ |
| Settings | BM/EN · light/dark · A−/A+ · ⓘ |
| Controls | Practice: playbook cards (Bold / Garden / Purist) as starting points; Live: none. Groups: Build (zone, building type), Finance (loan, fund draw), ESG actions, Deal Room (accept/decline + die), Operations. ↺ = cancel this month's pending orders; "locks at month end" tag |
| Viewport | Park map (8 zones); hover zone → values; Pin A/B snapshots; Colour by occupancy / ESG / cash contribution; zoom, pan, double-click refit |
| Results | Tiles: Cash, Runway, FCR12, Occupancy, ESG, Score pace. Tabs: Cash flow, Score parts, Radar vs leader, Impact, Log |
| Guide | Tutor avatar + speech bubble; yellow current step; "Go to"; predictions; step list; notes; Why? (theory); assumption ledger (engine coefficients shown as placeholders); coach tips (Rintis, Bina only) |
| Simulation bar | Solo: ▶ ⏸ step ■ ↺, speed 30–90 s/month. Live: locked (GM owns). Right: Year·Month, deal-window countdown, room code, sync status |

## 5. Tutor state machine

| Guide state | Pose file |
| --- | --- |
| level intro | wave |
| idle / waiting for an order | idle |
| "Go to" a control | point |
| Why? / theory | explain |
| prediction asked | think |
| step done | thumbs |
| prediction correct | ok |
| debrief / recording score | note |
| Gold | cheer |
| closing | thanks |

Images: `assets/tutor/<pose>.webp` (360 px tall, ≈ 20 KB each; PNG fallback). `idle` is preloaded, others lazy. `prefers-reduced-motion` disables the bubble animation. Alt text: "Tutor".

## 6. Repository layout

```
LICENSE  README.md  DESIGN.md  AI_USAGE.md  THIRD_PARTY_LICENSES.md  DECISIONS.md  CITATION.cff
src/         engine.js (shared), shell/*.js, *.css, i18n.js, tutor.js, live.js, solo.js
content/     LICENSE (CC BY-NC-ND), texts and cards (BM/EN), map labels
assets/tutor LICENSE, 10 poses (webp + png)
apps-script/ Code.gs, engine.gs (copy of src/engine.js), appsscript.json
tools/       build.py (→ dist/index.html), avatar_split.py, calib.mjs (Node validation)
dist/        index.html (built; the file GitHub Pages serves)
ref/         transcribed v0.5 and Cable Lab (git-ignored)
```

## 7. Validation

- Determinism: same (level, seed, orders) → identical state on 100 seeds × 3 levels, browser and Node.
- Replay: engine replay of a recorded solo game equals the live final state.
- Calibration: style bots reproduce the v0.5 means within Monte Carlo noise (300 seeds; benchmark defence D = 11 as in v0.5). Result 3 Nov 2026: within ±1 point on every row.
- Backend: `tools/gs_test.js` (handler under Node stand-ins) and `tools/live_test.js` (GM → team → front screen via `tools/mock_server.js`).
- Shell: screenshots light/dark, desktop and 390 px phone; overlay and tour; BM/EN swap leaves no untranslated UI chrome.

## 8. Out of scope for v0.6.0

Accounts with passwords; real-time sockets; app-store packaging; the Node.js server edition.
