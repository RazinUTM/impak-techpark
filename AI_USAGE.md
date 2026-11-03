# AI usage disclosure

Tools: Claude (Fable 5.1, claude.ai), 3 Nov 2026 onward. Earlier versions (v0.1–v0.5.4, Sep–Oct 2026) were also built with Claude in claude.ai; no per-module record was kept at the time.
Scope: code generation, refactoring, tests, documentation, image processing scripts, BM/EN translation of UI strings.
Human verification: all generated material was reviewed, modified where needed and validated by the author, who made the design decisions recorded in DESIGN.md and DECISIONS.md. The author designed the game (levels, mandates, deals, scoring) and its calibration targets, chose the shell layout, the access model and the licence posture.
Last updated: 2026-11-03

| Component | Origin | Human role | Verified by |
| --- | --- | --- | --- |
| src/engine.js | Lifted verbatim from the author's v0.5 build (AI-generated Sep–Oct 2026 from the author's rule book); SPDX header added | Game design, parameters, calibration targets | tools/calib.js: 6,300 games × 2, 0 determinism and 0 replay mismatches; style-bot means within ±1 point of the v0.5 table |
| src/strategies.js | Lifted verbatim from v0.5 (style bots) | Styles defined by the author | tools/calib.js |
| src/game.js | v0.5 game core (views, actions, solo store) with small v0.6 edits: exports for the shell, copyright line, solo strip hidden in shell mode | Reviewed | tools/shot.js, tools/live_test.js |
| src/game.css | v0.5 styles rewritten by script (tools-time Python): scoped under `.g`, variables mapped to the shell's | Reviewed screenshots | tools/shot.js |
| src/shell.css, src/uikit.js | Author's Cable Lab shell (MIT), copied; uikit.js: `base` option added to the stage menu and activity texts | Layout chosen by the author | tools/shot.js |
| src/app.js | AI-generated from DESIGN.md s4–s5 (shell integration, tutor, activities, pins, clock bar, landing) | Specified and reviewed | tools/shot.js (BM/EN, light/dark, phone) |
| src/live.js, apps-script/Code.gs | AI-generated from DESIGN.md s2–s3 (Apps Script store, join, codes, orders, replay verification) | Access model chosen by the author | tools/gs_test.js (23 checks), tools/live_test.js (GM → team → screen through tools/mock_server.js); real Google deployment by the author |
| src/i18n.js | AI-generated; BM wording in the author's register | Author review pending | — |
| content/texts.js, content/run-sheet.md | AI-drafted tutor lines, activity steps, predictions and theory from the author's rule book | Author review pending | — |
| tools/avatar_split.py | AI-generated | Author checked the contact sheet | visual check |
| tools/build.py, tools/calib.js, tools/shot.js, tools/gs_test.js, tools/mock_server.js, tools/live_test.js | AI-generated | Reviewed | run in session |
