# Backend for live sessions (Google Apps Script)

One private Google Sheet + one Apps Script web app on the facilitator's UTM Workspace account. Nothing else to host.

## Deploy (once, about 15 minutes)

1. Create a new Google Sheet (any name, e.g. *IMPAK sessions*). Keep it private.
2. Extensions → Apps Script. Delete the default `Code.gs` content and add three files with exactly these names:
   - `Code.gs` — copy from this folder.
   - `engine.gs` — copy from this folder (it is written by `tools/build.py` as a verbatim copy of `src/engine.js`; redeploy it whenever the engine changes).
   - `appsscript.json` — Project settings → tick *Show "appsscript.json" manifest file*, then paste this folder's file.
3. Run `setup()` once from the editor (Run ▸ setup). Approve the permissions (Sheets, send e-mail). It creates the tabs, a signing secret and a **GM PIN** (shown in the execution log; also in Project settings → Script properties → `GM_PIN`). Change the PIN there if you wish.
4. In the `users` tab, list every facilitator's e-mail with role `gm`, name, active `TRUE`. Only listed e-mails can open the Game Master console.
5. Deploy → New deployment → type *Web app*: Execute as **Me**, Who has access **Anyone**. Copy the Web app URL (ends in `/exec`).
6. Paste the URL into `src/config.js` (`window.IMPAK_API = '…/exec'`), run `python3 tools/build.py`, and publish `dist/index.html` (GitHub Pages).

Redeploying after a code change: Deploy → Manage deployments → edit → *New version*. The URL stays the same.

Version check: `ping` answers with `api` and `features` (API 2 from 8 Nov 2026: the feedback card needs both star ratings; the written answers stay optional). The page asks on start; while the deployed script is older, feedback and run records wait in the player's browser (up to 20, for 30 days) and are sent after the redeploy, and the GM console shows a notice.

## Session tiers

- **open** (default): a team PIN is enough; the name and e-mail typed at join are recorded as given.
- **code**: the e-mail must be verified with a 6-digit code (MailApp; valid 10 minutes, 5 per hour per address). Switch a room with a POST `{op:'gm', action:'tier', tier:'code', token, room}` or set the `tier` cell of the room in the `rooms` tab to `code`.

## Data kept

| Tab | Rows | Personal data |
| --- | --- | --- |
| rooms | one per game: code, game state (JSON), team PINs | — |
| players | one per join: room, team, name, e-mail, organisation | yes |
| orders, decisions | the teams' order log and Deal Room choices | — |
| results | self-reported vs replayed scores, flag | — |
| codes | e-mailed sign-in codes (expire after 10 min) | e-mail |
| users | facilitators | e-mail |
| log | joins, GM actions | e-mail of the facilitator |
| feedback | the public trial's feedback card: two ratings (1–5), two short answers, game context (level, medal, month), language, device family | e-mail only if the player typed one |
| runs | anonymous practice-game statistics: level, month reached, how the game ended (ended / early / left / deleted), the reason chosen, medal, minutes played | — |

The `feedback` and `runs` tabs are created on first use (no need to rerun `setup()`); each stops at 20,000 rows. Rows carry no name or address, and the browser sends no identifier beyond the game's own id, so one player who plays twice appears twice. A honeypot field and a per-game duplicate check keep bots and double posts out.

Delete `players`, `codes` and `log` rows 12 months after the cohort report, and `feedback` rows that carry an e-mail 12 months after they arrive (the notices at join and on the feedback card say so). `purgeCodes()` removes expired codes; attach it to a daily time trigger if you like.

Wrong PINs: after 25 wrong team PINs for one room, or 25 wrong GM PINs for one e-mail, that key is refused for 15 minutes.

Reading the feedback: open the Sheet and sort `feedback` by `at`; the `runs` tab tells you how far players get (a pivot of `status` by `level` and `month` shows where practice games are abandoned).

## Quotas to keep in mind (Workspace account)

30 simultaneous executions per user; e-mail recipients 1,500/day; each poll is one execution (4 s interval per screen → about 15/min per device). A 12-team session with two devices per team stays well inside this.

## Testing without Google

`node tools/gs_test.js` runs the handler under Node with in-memory stand-ins (23 checks). `node tools/mock_server.js 8787` serves the same handler over HTTP; open `dist/index.html?api=http://localhost:8787/exec` to play a live session locally (GM e-mail `gm@example.my`, PIN `123456`). `node tools/live_test.js` drives GM, team and front screen through it with Playwright.
