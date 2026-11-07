/* SPDX-License-Identifier: MIT
   Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia */
/* IMPAK v0.6 — live sessions against the Apps Script backend (apps-script/Code.gs).
   The store has the same interface as the game core's MemStore: game, ordersFor, decisionOf, placeOrder,
   decide, gmSet, gmUpdate, on/emit. The browser keeps a local copy and polls the server for changes;
   writes are optimistic (applied locally at once, then posted). */
(function (root) {
'use strict';
const G = root.IMPAK, PB = root.PB;
const ls = { get(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }, del(k) { try { root.localStorage.removeItem(k); } catch (e) { /* ignore */ } } };

/* ------------------------------------------------------------------ API url */
function apiUrl() {
  const q = new URLSearchParams(root.location.search).get('api');
  if (q === 'off') { ls.del('impak.api'); return root.IMPAK_API || ''; }
  if (q && /^https?:\/\//.test(q)) { ls.set('impak.api', q); return q; }
  return ls.get('impak.api') || root.IMPAK_API || '';
}
const API = apiUrl();
class ApiError extends Error { constructor(key, msg) { super(msg || key); this.key = key; } }
async function call(payload) {
  if (!API) throw new ApiError('join.err.net', 'no API');
  let r;
  try {
    if (payload.op === 'state' || payload.op === 'room' || payload.op === 'ping') {
      const u = new URL(API); for (const k in payload) u.searchParams.set(k, payload[k]);
      r = await fetch(u.toString(), { method: 'GET', redirect: 'follow', cache: 'no-store' });
    } else r = await fetch(API, { method: 'POST', redirect: 'follow', body: JSON.stringify(payload) });   // text/plain body: a "simple" request, no preflight
  } catch (e) { throw new ApiError('join.err.net', String(e)); }
  let j; try { j = await r.json(); } catch (e) { throw new ApiError('join.err.net', 'bad json'); }
  if (j && j.error) throw new ApiError({ room: 'join.err.room', pin: 'join.err.pin', code: 'join.err.code', fields: 'join.err.fields' }[j.error] || 'join.err.net', j.message || j.error);
  return j;
}

/* ------------------------------------------------------------------ store */
function deepMerge(a, b) { return G.deepMerge(JSON.parse(JSON.stringify(a || {})), b); }
function ApiStore(session) {
  let SEQ = 0; const nextSeq = () => { SEQ = (SEQ + 1) % 1000; return Date.now() * 1000 + SEQ; };
  const s = {
    mode: 'live', version: 0, listeners: new Set(), game: null, orders: {}, decisions: {}, ready: false, db: true,
    lastOk: 0, lastTry: 0, pending: 0, writes: 0, timer: null, session,
    emit() { this.version++; this._cache = null; for (const f of this.listeners) f(this); },
    on(f) { this.listeners.add(f); },
    ordersFor(team) { return this.orders[team] || []; },
    decisionOf(eid, team) { return (this.decisions[eid] || {})[team] || null; },
    async placeOrder(team, o, t) {
      const order = Object.assign({ t, seq: nextSeq() }, o);
      (this.orders[team] = this.orders[team] || []).push(order); this.emit();
      await this.post({ op: 'order', team, order });
    },
    async decide(team, eid, opt) {
      (this.decisions[eid] = this.decisions[eid] || {})[team] = opt; this.emit();
      await this.post({ op: 'decide', team, eid, opt });
    },
    async gmSet(g) {
      const r = await this.post({ op: 'gm', action: 'set', game: g });
      if (r && r.game) { this.game = r.game; this.orders = {}; this.decisions = {}; this._auto = null; }
      if (r && r.room) { this.session.room = r.room; if (r.token) this.session.token = r.token; saveSession(this.session); }
      this.emit();
    },
    async gmUpdate(p) {
      this.game = deepMerge(this.game, p); this.emit();
      await this.post({ op: 'gm', action: 'update', patch: p });
    },
    async post(payload) {
      this.pending++; this.writes++;
      try { return await call(Object.assign({ room: this.session.room, token: this.session.token }, payload)); }
      catch (e) { G.HOST.toast(String(e.message || e), 'bad'); throw e; }
      finally { this.pending--; setTimeout(() => this.poll(), 800); }
    },
    async poll() {
      if (!this.session.room || this._polling) return; this._polling = true; this.lastTry = Date.now();
      const w0 = this.writes;
      try {
        const r = await call({ op: 'state', room: this.session.room, team: this.session.team || '', token: this.session.token || '' });
        if (this.pending > 0 || this.writes !== w0) return;   // a write happened meanwhile: this snapshot predates it
        if (r.serverTime) { const off = r.serverTime - Date.now(); if (Math.abs(off) > 400 && onOffset) onOffset(off); }
        this.game = r.game || null; this.orders = r.orders || {}; this.decisions = r.decisions || {};
        this.ready = true; this.lastOk = Date.now(); this.emit();
      } catch (e) { /* keep the last state; the sync dot shows it */ }
      finally { this._polling = false; }
    },
    start() { this.poll(); clearInterval(this.timer); this.timer = setInterval(() => this.poll(), 4000); },
    stop() { clearInterval(this.timer); this.timer = null; },
    dump() { return { mode: this.mode, game: this.game, orders: this.orders, decisions: this.decisions }; },
    load() {},
  };
  return s;
}

/* ------------------------------------------------------------------ session and forms */
function loadSession() { try { return JSON.parse(ls.get('impak.session') || 'null'); } catch (e) { return null; } }
function saveSession(x) { if (x) ls.set('impak.session', JSON.stringify(x)); else ls.del('impak.session'); }
let onState = null, onOffset = null, hooks = null;
const L = {
  configured: !!API, store: null, needsCode: false, reported: {},
  get room() { return this.store && this.store.session ? this.store.session.room || '' : ''; },
  form: (() => { try { return JSON.parse(ls.get('impak.form') || '{}'); } catch (e) { return {}; } })(),
  saveForm() { const f = Object.assign({}, this.form); delete f.pin; delete f.gmpin; delete f.code; ls.set('impak.form', JSON.stringify(f)); },
  syncClass() { const s = this.store; if (!s) return 'off'; if (s.pending > 0) return 'wait'; return Date.now() - s.lastOk < 15000 ? 'ok' : 'off'; },
  syncKey() { return { ok: 'ro.sync.ok', wait: 'ro.sync.wait', off: 'ro.sync.off' }[this.syncClass()]; },
  init(h) { hooks = h; onState = h.onState; onOffset = h.onOffset; },
  attach(session, role, teamId) {
    const A = G.APP; this.store = ApiStore(session);
    this.store.on(() => { if (onState) onState(); });
    A.live = this.store; A.store = this.store; A.role = role; A.teamId = teamId || null; A.canEdit = role === 'gm'; A.dbState = 'ok';
    G.HOST.kind = 'server';
    this.store.start();
    saveSession(session);
  },
  resume() {
    const s = loadSession(); if (!s || !API || !s.room) return false;
    this.attach(s, s.role, s.team); return true;
  },
  leave() { if (this.store) this.store.stop(); this.store = null; saveSession(null); const A = G.APP; A.live = null; A.canEdit = false; G.HOST.kind = 'browser'; },
  async join() {
    const f = this.form;
    if (!f.room || !f.pin || !f.name || !f.email) throw new ApiError('join.err.fields');
    const r = await call({ op: 'join', room: f.room.toUpperCase(), pin: f.pin, name: f.name, email: f.email, org: f.org || '', code: f.code || '' });
    this.needsCode = false;
    this.attach({ room: r.room, team: r.team, token: r.token, role: 'team', name: f.name, email: f.email }, 'team', r.team);
    return r;
  },
  async sendCode() { const f = this.form; if (!f.email) throw new ApiError('join.err.fields'); return call({ op: 'sendCode', email: f.email, room: (f.room || '').toUpperCase() }); },
  async openGM() {
    const f = this.form;
    if (!f.gmpin || !f.email) throw new ApiError('join.err.fields');
    const r = await call({ op: 'gm', action: 'open', room: (f.room || '').toUpperCase(), gmpin: f.gmpin, email: f.email });
    this.attach({ room: r.room || '', token: r.token, role: 'gm', email: f.email }, 'gm', null);
    if (!r.room) { G.APP.ui.gmNew = true; G.APP.ui.setup = null; }
    return r;
  },
  async openScreen(code) {
    const r = await call({ op: 'room', room: code });
    this.attach({ room: r.room, token: '', role: 'screen' }, 'screen', null);
    return r;
  },
  /* fire-and-forget records of the public trial (feedback, run statistics); no token needed */
  async send(payload, beacon) {
    if (!API) return null;
    if (beacon && root.navigator && root.navigator.sendBeacon) { try { if (root.navigator.sendBeacon(API, JSON.stringify(payload))) return { ok: true }; } catch (e) { /* fall through */ } }
    return call(payload);
  },
  async report(tm, r) {
    if (!this.store || !tm.rub || this.reported[tm.id]) return; this.reported[tm.id] = true;
    const rb = tm.rub;
    try { await this.store.post({ op: 'report', team: tm.id, score: rb.total, medal: rb.medal, parts: { A: rb.A, B1: rb.B1, B2: rb.B2, B3: rb.B3, C: rb.C, D: rb.D, E: rb.E }, orders: this.store.ordersFor(tm.id).length }); } catch (e) { /* shown by toast */ }
  },
  gmBarExtra() {
    const g = G.game(), s = this.store && this.store.session; if (!g || !s) return '';
    const pins = (g.pins || {});
    const ms = G.HOST.lang === 'ms';
    return '<span class="chip">' + (ms ? 'Bilik' : 'Room') + ' <b>' + G.esc(s.room) + '</b></span>' + g.teams.map((x) => '<span class="chip" title="' + (ms ? 'PIN pasukan' : 'Team PIN') + '">' + G.esc(x.name) + ' · ' + G.esc(pins[x.id] || '····') + '</span>').join('') +
      '<button class="btn sm" data-act="role-screen">' + (ms ? 'Skrin hadapan' : 'Front screen') + '</button>';
  },
};
G.HOST.gmBarExtra = () => L.gmBarExtra();
root.IMPAKLive = L;
})(typeof window !== 'undefined' ? window : globalThis);
