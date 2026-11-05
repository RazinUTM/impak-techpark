// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
/* Exercises apps-script/Code.gs under Node with in-memory stand-ins for the Google services
 * (Spreadsheet, Cache, Lock, Properties, Utilities, MailApp). Covers: setup, GM open/set/update,
 * join (wrong PIN, open tier, code tier), orders (closed, late, ok), decisions, state, report + replay.
 * Usage: node tools/gs_test.js */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const DIR = path.join(__dirname, '..', 'apps-script');
const sheets = {};
function Sheet(name) { this.name = name; this.rows = []; }
Sheet.prototype.getLastRow = function () { return this.rows.length; };
Sheet.prototype.appendRow = function (r) { this.rows.push(r.slice()); };
Sheet.prototype.setFrozenRows = function () {};
Sheet.prototype.getRange = function (r, c, nr, nc) { const self = this; return { getValues() { return self.rows.slice(r - 1, r - 1 + (nr || 1)).map((x) => x.slice(c - 1, c - 1 + (nc || 1))); }, setValues(v) { for (let i = 0; i < v.length; i++) self.rows[r - 1 + i] = v[i].slice(); }, setValue(v) { self.rows[r - 1][c - 1] = v; } }; };
Sheet.prototype.deleteRow = function (r) { this.rows.splice(r - 1, 1); };
const ss = { getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = new Sheet(n)) };
const store = {}, cacheMem = {};
const ctx = {
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => store[k] || null, setProperty: (k, v) => { store[k] = v; } }) },
  SpreadsheetApp: { getActive: () => ss },
  CacheService: { getScriptCache: () => ({ get: (k) => cacheMem[k] || null, put: (k, v) => { cacheMem[k] = v; }, remove: (k) => { delete cacheMem[k]; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { getUuid: () => 'uuid-' + Math.random(), computeHmacSha256Signature: (s, k) => crypto.createHmac('sha256', k).update(s).digest(), base64EncodeWebSafe: (b) => Buffer.from(b).toString('base64url'), base64DecodeWebSafe: (s) => Buffer.from(s, 'base64url'), newBlob: (b) => ({ getDataAsString: () => Buffer.from(b).toString('utf8') }) },
  Session: { getEffectiveUser: () => ({ getEmail: () => 'gm@example.my' }) },
  MailApp: { sendEmail: (o) => { ctx.__mail = o; } },
  ContentService: { createTextOutput: (s) => ({ setMimeType() { return { text: s }; } }), MimeType: { JSON: 'json' } },
  Logger: { log: () => {} }, console,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'engine.gs'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'Code.gs'), 'utf8'), ctx);
const H = (p) => vm.runInContext('handle(' + JSON.stringify(p) + ')', ctx);
let fails = 0;
const check = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (extra ? ' — ' + extra : '')); if (!cond) fails++; };

vm.runInContext('setup()', ctx);
check('ping', H({ op: 'ping' }).ok);
const gmpin = store.GM_PIN;
check('gm open rejects a wrong PIN', H({ op: 'gm', action: 'open', email: 'gm@example.my', gmpin: 'x', room: '' }).error === 'pin');
check('gm open rejects an unlisted e-mail', H({ op: 'gm', action: 'open', email: 'nobody@example.my', gmpin, room: '' }).error === 'pin');
let r = H({ op: 'gm', action: 'open', email: 'gm@example.my', gmpin, room: '' }); check('gm open', !r.error);
const gmtok = r.token;
const game = { gid: 't1', seed: 'cal-1', level: 'rintis', site: 'corridor', teams: [{ id: 't1', name: 'Team 1' }, { id: 't2', name: 'Team 2' }], bench: ['garden'], status: 'setup', startedAt: 0, accMs: 0, msPerMonth: 5000, window: 60, auto: true, closed: {}, dec: {}, openAt: {}, defence: {}, reveal: false, lastReveal: null };
r = H({ op: 'gm', action: 'set', token: gmtok, game }); check('gm set returns a room code and PINs', r.room && r.game.pins && r.game.pins.t1, r.room);
const room = r.room, pin = r.game.pins.t1;
check('join rejects a wrong PIN', H({ op: 'join', room, pin: '0000', name: 'A', email: 'a@b.c' }).error === 'pin');
check('join rejects missing fields', H({ op: 'join', room, pin, name: '', email: 'a@b.c' }).error === 'fields');
r = H({ op: 'join', room, pin, name: 'Ali', email: 'ali@example.com', org: 'X' }); check('join', r.team === 't1' && r.token);
const tok = r.token;
check('order rejected before the clock starts', H({ op: 'order', token: tok, room, team: 't1', order: { type: 'works', zone: 'C', kind: 'roadHalf', t: 0.2, seq: 1 } }).error === 'closed');
check('gm update starts the clock', !H({ op: 'gm', action: 'update', token: gmtok, room, patch: { status: 'running', startedAt: Date.now() - 5000 * 0.3, accMs: 0 } }).error);
check('order accepted', !H({ op: 'order', token: tok, room, team: 't1', order: { type: 'works', zone: 'C', kind: 'roadHalf', t: 0.2, seq: 1 } }).error);
check('order in the future rejected', H({ op: 'order', token: tok, room, team: 't1', order: { type: 'works', zone: 'C', kind: 'roadHalf', t: 5, seq: 2 } }).error === 'late');
check('order with a forged token rejected', H({ op: 'order', token: tok.slice(0, -2) + 'xx', room, team: 't1', order: { type: 'works', t: 0.2, seq: 3 } }).error === 'auth');
check('decision stored', !H({ op: 'decide', token: tok, room, team: 't1', eid: 'e10', opt: 'T' }).error);
r = H({ op: 'state', room }); check('state returns orders and decisions, hides PINs', r.orders.t1.length === 1 && r.decisions.e10.t1 === 'T' && !r.game.pins);
r = H({ op: 'state', room, token: gmtok }); check('state shows PINs to the GM', !!r.game.pins);
r = H({ op: 'report', token: tok, room, team: 't1', score: 42 }); check('report replays on the server and flags a mismatch', r.flag === 'mismatch' && typeof r.official === 'number', 'official ' + r.official);
r = H({ op: 'report', token: tok, room, team: 't1', score: r.official }); check('report with the official score is ok', r.flag === 'ok');
r = H({ op: 'gm', action: 'replay', token: gmtok, room }); check('gm replay for every team', r.results && r.results.length === 2);
r = H({ op: 'sendCode', email: 'ali@example.com' }); check('sendCode e-mails a 6-digit code', r.ok && /\d{6}/.test(ctx.__mail.body));
H({ op: 'gm', action: 'tier', token: gmtok, room, tier: 'code' });
check('code tier: join without a code is refused', H({ op: 'join', room, pin, name: 'Ali', email: 'ali@example.com' }).error === 'code');
const code = ctx.__mail.body.match(/\d{6}/)[0];
check('code tier: join with the e-mailed code', !H({ op: 'join', room, pin, name: 'Ali', email: 'ali@example.com', code }).error);
check('code tier: a code cannot be reused', H({ op: 'join', room, pin, name: 'Ali', email: 'ali@example.com', code }).error === 'code');
// the server clock stops at pause points like the browser (order at 24 during the end-of-Phase-1 checkpoint)
{
  const g3 = Object.assign({}, game, { gid: 't3', seed: 'cp-1', status: 'setup' });
  const r3 = H({ op: 'gm', action: 'set', token: gmtok, game: g3 });
  const PB = require(path.join(__dirname, '..', 'src', 'engine.js'));
  const sc = PB.makeScenario('cp-1', 'rintis'); const closed = {}; for (const e of sc.events) closed[e.id] = true;   // every deal before month 24 is closed
  H({ op: 'gm', action: 'update', token: r3.token, room: r3.room, patch: { status: 'running', accMs: 27.27 * 5000, startedAt: Date.now(), closed } });
  const tok3 = H({ op: 'join', room: r3.room, pin: r3.game.pins.t1, name: 'C', email: 'c@example.com' }).token;
  const o = H({ op: 'order', token: tok3, room: r3.room, team: 't1', order: { type: 'fac', kind: 'kpi', t: 24, seq: 9 } });
  check('order at month 24 during the checkpoint is accepted', !o.error, o.error ? o.message : 'ok');
  const late = H({ op: 'order', token: tok3, room: r3.room, team: 't1', order: { type: 'fac', kind: 'kpi', t: 22, seq: 10 } });
  check('an order truly behind the clock is still refused', late.error === 'late');
}
// starting cash set by the GM: the server replay must use it (else every report is a mismatch)
{
  const PB = require(path.join(__dirname, '..', 'src', 'engine.js'));
  const g2 = Object.assign({}, game, { gid: 't2', seed: 'cash-1', startCash: 9, status: 'setup' });
  const r2 = H({ op: 'gm', action: 'set', token: gmtok, game: g2 });
  const sc = PB.makeScenario('cash-1', 'rintis'); sc.lv = Object.assign({}, sc.lv, { startCash: 9 });
  const t = PB.replay(sc, 't1', 'priority', [], {}, {}, sc.months), local = Math.round(PB.rubric(t, sc, null, sc.months).total * 100) / 100;
  const tok2 = H({ op: 'join', room: r2.room, pin: r2.game.pins.t1, name: 'B', email: 'b@example.com' }).token;
  H({ op: 'gm', action: 'update', token: r2.token, room: r2.room, patch: { status: 'running', startedAt: Date.now() } });
  const rep = H({ op: 'report', token: tok2, room: r2.room, team: 't1', score: local });
  check('server replay uses the GM starting cash', rep.flag === 'ok' && t.cashHist[0] !== undefined, 'local ' + local + ' official ' + rep.official);
}
console.log(fails ? fails + ' FAILED' : 'all checks passed');
process.exit(fails ? 1 : 0);
