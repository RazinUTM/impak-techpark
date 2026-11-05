# Decisions

Design and boundary decisions, newest last. Log decisions, not edits.

## 2026-09-29 Site map anonymised
Decision: the default map "Campus corridor" is inspired by UTM Technovation Park, Skudai, but carries no UTM name or place names; the only mention is the caption "Site inspired by UTM Technovation Park, Skudai. Zones and conditions are a game layout, not the approved plan."
Rationale: the eight zones are a game layout, not the approved 26-plot plan; avoids implying an official plan.
Decided by: Ahmad Razin

## 2026-10-01 Ownership and name
Decision: IP treated as UTM's where made in the course of duties; copyright holder line for releases is "Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia" (standing decision of 2 Nov 2026). "IMPAK" trademark search (classes 41, 9, 28) still to do.
Decided by: Ahmad Razin

## 2026-11-03 Platform: static HTML + JS on GitHub Pages
Decision: the single-file browser app becomes the main platform, hosted on GitHub Pages; the Node.js server edition (v0.5.4) is retired as the main line.
Alternatives: A static-only solo; C Apps Script runs the engine; D Firebase/Supabase.
Rationale: participants open a link, no installs; same pattern as the park's other tools; no new vendor. Engine becomes public by design (see licence posture).
Decided by: Ahmad Razin

## 2026-11-03 Architecture B: browser engine + Apps Script backend with replay verification
Decision: the engine runs in the browser from a server-issued seed; Apps Script (owner's UTM Workspace account) bound to a private Sheet holds rooms, login, the append-only orders log, deals, GM messages and results. Official scores are recomputed server-side by replaying the orders log with the same engine.js; a mismatch flags tampering. Clock is timestamp-based (startAt + pace) so clients poll only for deals and messages. Solo practice runs fully offline.
Rationale: keeps v0.5.4's "server authority" for scores without server compute per action; fits Apps Script limits (30 simultaneous executions/user; 9 KB per property value, so state lives in the Sheet/CacheService).
Decided by: Ahmad Razin

## 2026-11-03 Login as in the tenancy app; participant data
Decision: Apps Script web app; identity = name + e-mail (any e-mail; e-mailed 6-digit code when verification is needed, self-declared fallback in the room). Data collected: display name, e-mail, team, organisation (optional). PDPA notice at login; leaderboards show team names only; Sheet stays private; records deleted 12 months after the cohort report; 5-attempt lockout on codes.
Rationale: participants are adults (TOT); PDPA used as the standard even if a free training game by a statutory body may fall outside it.
Decided by: Ahmad Razin

## 2026-11-03 Licence posture P2 (split)
Decision: code MIT; /content CC BY-NC-ND 4.0; /assets/tutor excluded (author's personal mark, licensed to IMPAK only). The engine's numerical parameters are software (MIT).
Alternatives: P1 MIT for everything; P3 source-available (PolyForm NC).
Rationale: the simulator is reusable as a generic STP engine; the game's identity (texts, cards, map, avatar) is protected; still a public GitHub release.
Decided by: Ahmad Razin

## 2026-11-03 Institution
Decision: owner checked with ICC and UTM — no objection to public release; owner will notify ICC (notification, not approval) and takes responsibility. TOT is free, so no outside-work permission is needed (Act 605, Second Schedule reg. 4 does not apply).
Decided by: Ahmad Razin

## 2026-11-03 Tutor avatar
Decision: the owner's avatar (10 poses from two sheets) fronts the Guide panel as tutor. Avatar IP treated as no issue for now; the generator and its terms to be recorded by the owner in THIRD_PARTY_LICENSES.md.
Decided by: Ahmad Razin

## 2026-11-03 Engine source
Decision: engine, parameters and scoring lifted verbatim from the Claude artifact v0.5 (3,031 lines), transcribed to ref/ with diff verification, then validated under Node (determinism, replay equality, style-bot means against the v0.5 calibration table where bots exist). ref/ is git-ignored.
Decided by: Ahmad Razin

## 2026-11-03 Calibration convention and replay check
Decision: tools/calib.js gives benchmark (AI) teams D = 11 of 15 defence marks in Bina and Lestari, the convention of the v0.5 app (`bench ? 11`); with it every style/level mean is within ±1 point of the v0.5 table. The replay check compares engine state and rubric totals; the three history arrays are compared only while a team is solvent, because replay() pads them after receivership while the live loop stops recording (no effect on scores).
Decided by: Ahmad Razin (recorded by Claude)

## 2026-11-03 Shell integration choices
Decision: the v0.5 game core is kept and mounted into the Cable Lab shell by region (orders → controls; site plan → viewport; tiles and info tabs → results; banners, coach, activity, prediction → guide; clock → bar). Deal Room and hold cards stay modal overlays (they hold the clock), so the bar has no duplicate "continue" button. The Game Master console and the front screen keep their v0.5 full-page views. Game content in the views stays English in v0.6.0; UI chrome and guide are BM/EN.
Decided by: Ahmad Razin (recorded by Claude)

## 2026-11-03 Name, mark and avatar origin
Decision: the game is named "IMPAK – Technovation Park" (was "IMPAK to the TechPark"); repository RazinUTM/impak-techpark. "IMPAK" is used with ™ as an unregistered mark; ® is not used until a MyIPO registration exists (using ® on an unregistered mark is an offence under the Trademarks Act 2019). The title now names UTM's park; the site plan stays a fiction with its caption, as decided on 29 Sep.
Avatar: the pose sheets were generated by the author with ChatGPT's image generator from his own likeness; OpenAI's terms assign the output to the user (recorded in THIRD_PARTY_LICENSES.md).
BM strings: spot-checked against DBP PRPM (segerak, serlah, lembap, penanda aras, ganjar, langkau, jeda, fasilitator, kohort); "dijeda" → "berjeda", "disegerak" → "segerak".
Decided by: Ahmad Razin

## 2026-11-04 Language of the guide-side views; results on the landing page
Decision: coach tips, banners, status/phase chips, hold cards, tiles and the engine's refusal reasons are bilingual (BM/EN, technical terms such as Deal Room, Development Fund, FCR12, drift, upkeep, fibre, shed and action points kept in English). engine.js stays verbatim; its reasons are mapped in game.js (`whyL`). Deal cards, zone panel texts and the info tabs are still English. The Results panel is folded on the landing page so the opening choices fit without scrolling. PRPM checks are optional, only where a word reads awkwardly.
Decided by: Ahmad Razin

## 2026-11-04 Decision advice, glossary, header and clock
Decision: three layers of advice around every Deal Room card, without touching the engine or the score: (1) before the decision, "Think it through" lists the figures the decision depends on and the risk of each option; Rintis and Bina show the current figures with ✓/! against the rule of thumb, Lestari shows the questions only; (2) after the deal closes, sound or not, the principle (the engine's `sound()` rule in words) and what to watch next; (3) a Decision journal in the Guide panel for the debrief. A searchable Glossary (BM/EN, ~50 terms) sits in the Guide panel and is linked from the ⓘ dialog. Title enlarged with the mode chip beside it; a large running clock (date, year, month n of N, progress) in the middle of the clock bar.
Open: "Cr" is defined in the glossary as the game's unit of money (credit), pending the author's confirmation.
Decided by: Ahmad Razin

## 2026-11-05 Fixes after the first real test (GM + team)
- Deal Room overlay was rebuilt every second (its render key carried the clock second): taps were lost between press and release, and devices never rested (iPad ran hot). Removed; the timer updates in place. Readouts now update only when they change; the loop does nothing while the tab is hidden.
- GM message box lost focus because the console re-renders as the clock advances: re-renders now keep focus and caret.
- "Switch to manual" could flip back: a poll that started before a GM write overwrote it. Stale polls are now dropped. The console explains what automatic and manual mean (deals and reveal only; the month clock always runs until Pause).
- New: "End the game…" with confirmation (remaining months play out with no orders); a "← Game Master console" button on the front screen; starting cash set by the GM (teams, benchmarks and the server replay use it); the guided activity steps are hidden in live sessions (the tutor and coach stay).
Decided by: Ahmad Razin

## 2026-11-05 QR code; phone landing
Decision: a QR code of the published URL on the landing page and on the front screen's join card (with the room code). Drawn at build time with segno 1.6.6 (BSD-3-Clause, build-time only; nothing third-party ships in the page); decoded back with OpenCV in the session to check it. A link with ?room=CODE pre-fills the join form and shows the join card first.
Found while testing: on phones the landing page had zero height (hidden), so a participant who scanned the QR saw no join form. Fixed; the clock bar is compact on phones and hidden on the landing page.
Decided by: Ahmad Razin
