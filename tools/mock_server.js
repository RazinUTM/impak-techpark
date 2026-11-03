// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
/* Serves apps-script/Code.gs over HTTP with in-memory stand-ins for the Google services, so the page can be
 * tested in live mode without a Google deployment:  node tools/mock_server.js [port]  then open
 * dist/index.html?api=http://localhost:<port>/exec . Prints the GM PIN. Not for production. */
'use strict';
const http = require('http'), fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const PORT = parseInt(process.argv[2] || '8787', 10);
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
  MailApp: { sendEmail: (o) => { console.log('[mail]', o.to, o.body.split('\n')[0]); } },
  ContentService: { createTextOutput: (s) => ({ setMimeType() { return { text: s }; } }), MimeType: { JSON: 'json' } },
  Logger: { log: (s) => console.log('[log]', s) }, console,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'engine.gs'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'Code.gs'), 'utf8'), ctx);
vm.runInContext('setup()', ctx);
store.GM_PIN = '123456';
console.log('mock Apps Script on http://localhost:' + PORT + '/exec   GM e-mail gm@example.my   GM_PIN ' + store.GM_PIN);
http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const u = new URL(req.url, 'http://localhost');
  const reply = (p) => { let out; try { out = vm.runInContext('handle(' + JSON.stringify(p) + ')', ctx); } catch (e) { out = { error: 'server', message: String(e) }; } res.writeHead(200, cors); res.end(JSON.stringify(out)); };
  if (req.method === 'GET') { const p = {}; u.searchParams.forEach((v, k) => { p[k] = v; }); return reply(p); }
  let body = ''; req.on('data', (c) => { body += c; }); req.on('end', () => { let p = {}; try { p = JSON.parse(body); } catch (e) { /* ignore */ } reply(p); });
}).listen(PORT);
