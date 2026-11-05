/* SPDX-License-Identifier: MIT
   Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia */
/* IMPAK v0.6 — browser host: mounts the v0.5 game core (window.IMPAK) into the Cable Lab shell (window.UIKit):
   level menu, settings, orders (controls), site plan (viewport), results, guide with tutor, clock bar;
   practice solo (MemStore) and live sessions (live.js → Apps Script). */
(function (root) {
'use strict';
const K = root.UIKit, G = root.IMPAK, PB = root.PB, C = PB.CFG;
const { $, $$, escapeHtml } = K;
const doc = root.document;

/* ---------------------------------------------------------------- dictionaries, preferences */
const DICTS = { en: Object.assign({}, root.I18N.en, root.CONTENT.en), ms: Object.assign({}, root.I18N.ms, root.CONTENT.ms) };
root.COURSE = { modules: [{ id: 'impak', stages: 3, store: 'impak.activity', page: 'index.html', depth: 0 }], i18n: { en: {}, ms: {} } };
const prefs = K.createPrefs('impak.prefs');
const t = K.makeT(DICTS, () => prefs.lang);
K.configure({ t, prefs });
const openState = K.createStore('impak.open', { zone: true, apps: true, money: false, fac: false });
const uiStore = K.createStore('impak.ui', { tab: 'park', level: 0 });
const LEVELS = G.LEVEL_KEYS;                               // ['rintis', 'bina', 'lestari']
const levelIndex = (key) => Math.max(0, LEVELS.indexOf(key || 'rintis'));

/* ---------------------------------------------------------------- host adapter for the game core */
const HOST = G.HOST;
let OFFSET = 0;                                             // clock offset against the server (live mode)
HOST.kind = 'browser'; HOST.shell = true; HOST.offline = false;
HOST.lang = prefs.lang;
HOST.now = () => Date.now() + (G.APP.store && G.APP.store.mode === 'live' ? OFFSET : 0);
HOST.toast = (msg, kind) => K.toast(msg);
HOST.save = (name, data) => { const a = doc.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = name; doc.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
HOST.hash = (h) => { try { root.history.replaceState(null, '', h ? '#' + h : location.pathname + location.search); } catch (e) { /* ignore */ } };
HOST.remember = (k, v) => { if (k === 'tab' && ['park', 'impact', 'stand', 'news', 'pins', 'rules'].indexOf(v) >= 0) { uiStore.tab = v; uiStore.save(); } };
HOST.landing = () => '';
HOST.footer = () => '';
HOST.setOffset = (ms) => { OFFSET = ms; };
HOST.dealAdvice = (res, tm, ev, phase) => { const A = root.IMPAKAdvice; if (!A) return ''; return phase === 'after' ? A.after(res, tm, ev) : A.before(res, tm, ev); };
const ACT = G.ACT;
HOST.act = {
  'pin'(d) { pinNow(d.pin); },
  'leave'() { if (root.IMPAKLive) root.IMPAKLive.leave(); ACT.home(); },
  'open-join'(d) { LAND.view = d.v || 'live'; },
  'tab'(d) { openPart(d.k); },
  'home'() { goHome(); },
};
const GROUP_OF = { apps: 'apps', money: 'money', fac: 'fac', zone: 'zone' };
function openPart(k) {
  if (GROUP_OF[k]) {
    const det = $('#grp-' + GROUP_OF[k]); if (!det) return;
    det.open = true; openState[GROUP_OF[k]] = true; openState.save();
    try { det.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { /* ignore */ }
    K.spotlight(det, { label: det.querySelector('summary h2').textContent, ms: 2200 });
    return;
  }
  if (resultsBar && !resultsBar.isOpen('plots')) resultsBar.set('plots', true);
  setTab(k);
}

/* ---------------------------------------------------------------- narrator (tutor) */
const AV = root.__AVATARS || {}; AV.neutral = AV.neutral || AV.idle;
const narrator = K.createNarrator({
  poses: [
    [/^say\.welcome|^say\.landing|^say\.live\.wait/, 'wave'], [/^say\.setup/, 'point'], [/^say\.hold\.event|^say\.zone/, 'point'],
    [/^say\.hold\.(checkpoint|forecast)|^say\.dealClosed|^predict\.wrong|^why/, 'explain'], [/^say\.hold\.downturn|^say\.cash|^say\.receiver|^say\.final\.none/, 'think'],
    [/^say\.final\.gold/, 'cheer'], [/^say\.final\.(silver|bronze)|^act\.complete/, 'thumbs'], [/^say\.hold\.end|^say\.ap/, 'note'],
    [/^say\.pinned|^predict\.(noted|right)/, 'ok'], [/^say\.fund/, 'think'], [/^say\.running|^say\.paused/, 'idle'],
  ],
  altPose: { idle: 'thanks', point: 'explain', explain: 'point', think: 'idle', wave: 'thanks', ok: 'thumbs', thumbs: 'ok', note: 'idle', cheer: 'thumbs', thanks: 'idle' },
  avatars: AV, bubble: '#say', avatarImg: '#avatar', logEl: '#log', logTitleKey: 'log.title', maxLog: 6,
});
const avatarImg = $('#avatar'); if (avatarImg && AV.idle) avatarImg.src = AV.idle;

/* ---------------------------------------------------------------- activities (guided steps per level) */
const ev = (name, test) => ({ ev: name, test });
const st = (fn) => ({ state: (res, tm) => { try { return !!(res && tm && fn(res, tm, tm.t)); } catch (e) { return false; } } });
const ordersOf = (res, tm) => (G.store() ? G.store().ordersFor(tm.id) : []);
const STEPS = {
  0: [
    { id: 'pickC', text: 'act.0.pickC', hint: 'act.0.pickC.h', target: '#r-map', need: [ev('zone', (d) => d.z === 'C')] },
    { id: 'start', text: 'act.0.start', hint: 'act.0.start.h', target: '#btn-play', need: [st((res) => res.g.status !== 'setup')] },
    { id: 'road', text: 'act.0.road', hint: 'act.0.road.h', target: '#r-zone', need: [st((res, tm, T) => T.zones.C.svc.road >= 1 || T.zones.C.works.some((w) => w.kind === 'road' || w.kind === 'roadHalf'))] },
    { id: 'admit', text: 'act.0.admit', hint: 'act.0.admit.h', target: '#r-apps', need: [st((res, tm, T) => T.tenants.length > 0)] },
    { id: 'deal', text: 'act.0.deal', hint: 'act.0.deal.h', need: [st((res, tm, T) => T.dlog.length > 0)] },
    { id: 'park', text: 'act.0.park', hint: 'act.0.park.h', target: '#plot-tabs button[data-plot="park"]', need: [ev('tab', (d) => d.k === 'park')] },
    { id: 'year1', text: 'act.0.year1', hint: 'act.0.year1.h', need: [st((res, tm, T) => res.T >= 12 && T.cash > 0)] },
  ],
  1: [
    { id: 'start', text: 'act.1.start', hint: 'act.1.start.h', target: '#btn-play', need: [st((res) => res.g.status !== 'setup')] },
    { id: 'loan', text: 'act.1.loan', hint: 'act.1.loan.h', target: '#r-money', need: [st((res, tm, T) => T.debt > 0)] },
    { id: 'build', text: 'act.1.build', hint: 'act.1.build.h', target: '#r-zone', need: [st((res, tm) => ordersOf(res, tm).some((o) => o.type === 'build'))] },
    { id: 'fund', text: 'act.1.fund', hint: 'act.1.fund.h', need: [st((res, tm, T) => T.fundUsed >= 0.5 * (T.fund0 || C.FUND))] },
    { id: 'H', text: 'act.1.H', hint: 'act.1.H.h', need: [st((res, tm, T) => (T.hplots || []).some((p) => p && p !== 'reclaimed'))] },
    { id: 'forecast', text: 'act.1.forecast', hint: 'act.1.forecast.h', need: [st((res) => res.sc.downturn.forecastAt && res.T >= res.sc.downturn.forecastAt - 1)] },
    { id: 'survive', text: 'act.1.survive', hint: 'act.1.survive.h', need: [st((res, tm, T) => res.final && !T.bailouts && !T.receiver)] },
  ],
  2: [
    { id: 'start', text: 'act.2.start', hint: 'act.2.start.h', target: '#btn-play', need: [st((res) => res.g.status !== 'setup')] },
    { id: 'esg', text: 'act.2.esg', hint: 'act.2.esg.h', need: [st((res, tm, T) => (T.esgLog || []).some((x) => x.d > 0))] },
    { id: 'lab', text: 'act.2.lab', hint: 'act.2.lab.h', target: '#r-fac', need: [st((res, tm, T) => !!(T.fac.lab || T.fac.labaccess))] },
    { id: 'anchor', text: 'act.2.anchor', hint: 'act.2.anchor.h', target: '#r-apps', need: [st((res, tm, T) => T.tenants.some((x) => x.type === 'anchor' || x.type === 'bigAnchor'))] },
    { id: 'deals', text: 'act.2.deals', hint: 'act.2.deals.h', need: [st((res, tm, T) => T.dlog.filter((d) => d.eligible && d.sound).length >= 3)] },
    { id: 'downturn', text: 'act.2.downturn', hint: 'act.2.downturn.h', need: [st((res, tm) => PB.inDownturn(res.sc, res.mCur) && tm.ps.fcr >= 1)] },
    { id: 'finish', text: 'act.2.finish', hint: 'act.2.finish.h', need: [st((res) => res.final)] },
  ],
};
const PREDICT = { 0: { q: 'pq.rent', answer: 0 }, 1: { q: 'pq.fund', answer: 1 }, 2: { q: 'pq.downturn', answer: 1 } };
let activity = null, predict = null, stageNav = null, screenGuide = null, resultsBar = null;

/* ---------------------------------------------------------------- shell state */
const S = { role: null, level: 0, pins: { A: null, B: null }, lastSaid: '', mounted: '', zoom: 1 };
const LAND = { view: 'home', err: '', busy: false, codeSent: false };
function app() { return G.APP; }
function res() { return G.currentRes(); }
function teamNow(r) { return r ? G.teamOf(r, app().teamId) : null; }

/* ---------------------------------------------------------------- in-page dialogs (window.confirm/prompt are refused in some embeddings) */
function ask(msg, withInput) {
  return new Promise((resolve) => {
    const d = doc.createElement('dialog'); d.className = 'sguide askbox';
    d.innerHTML = '<div class="sgbody"><p class="lead">' + escapeHtml(msg) + '</p>' + (withInput ? '<input type="text" id="ask-in" autocomplete="off" style="width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink);font:inherit;text-transform:uppercase">' : '') + '</div>' +
      '<div class="sgfoot"><button type="button" class="tb primary" data-a="ok">OK</button><button type="button" class="tb" data-a="no">' + escapeHtml(t('ui.info.close')) + '</button></div>';
    doc.body.appendChild(d);
    const done = (v) => { try { d.close(); } catch (e) { /* ignore */ } d.remove(); resolve(v); };
    d.querySelector('[data-a="ok"]').addEventListener('click', () => done(withInput ? (d.querySelector('#ask-in').value || '').trim() : true));
    d.querySelector('[data-a="no"]').addEventListener('click', () => done(withInput ? '' : false));
    d.addEventListener('cancel', (e) => { e.preventDefault(); done(withInput ? '' : false); });
    if (withInput) d.querySelector('#ask-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done((d.querySelector('#ask-in').value || '').trim()); } });
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    const f = d.querySelector('input, .tb.primary'); if (f) f.focus();
  });
}

/* ---------------------------------------------------------------- level switching (solo) and the stage menu */
async function switchLevel(n, force) {
  const key = LEVELS[n]; if (!key) return;
  const a = app();
  if (a.role === 'team') { K.toast(t('ui.stage.live')); return; }
  const g = G.game();
  if (a.role === 'solo' && g && g.status !== 'setup' && g.status !== 'ended' && !force) { if (!(await ask(t('ui.stage.confirm')))) return; }
  S.level = n; uiStore.level = n; uiStore.save();
  ACT['role-solo']({ level: key });
  a.ui.seenEnd = false; a.ui.seenReveal = null; a.ui.zone = 'C';
  predict.hide();
  activity.start(n);
  activity.restart();
  narrator.say('say.welcome.' + n, {}, true);
  if (PREDICT[n]) predict.show({ predict: PREDICT[n] });
  S.lastSaid = 'welcome';
  stageNav.render();
  render(true);
}

/* ---------------------------------------------------------------- site plan pins */
function pinNow(which) {
  const map = $('#r-map svg'); if (!map) return;
  const r = res(); const d = r ? G.dateParts(r.ck.T, r.months) : null;
  S.pins[which] = { svg: map.outerHTML, when: d ? d.day + ' ' + d.month + ', ' + t('ro.year', { y: d.year }) : '' };
  $('#tab-pins').hidden = false; $('#vp-clear').hidden = false;
  K.toast(t('vp.pinned', { pin: which, when: S.pins[which].when }));
  narrator.say('say.pinned', {}, true);
  if (uiStore.tab === 'pins') render(true);
}
function pinsHTML() {
  const A = S.pins.A, B = S.pins.B;
  if (!A && !B) return '<p class="muted">' + escapeHtml(t('pins.empty')) + '</p>';
  const fig = (p, k) => p ? '<figure><figcaption>Pin ' + k + ' · ' + escapeHtml(p.when) + '</figcaption>' + p.svg + '</figure>' : '<figure><figcaption class="faint">Pin ' + k + '</figcaption></figure>';
  return '<div class="pinsgrid">' + fig(A, 'A') + fig(B, 'B') + '</div>';
}

/* ---------------------------------------------------------------- results: tiles (from the v0.5 top bar) and tabs */
function tilesHTML(r, tm) {
  const T = tm.t, lv = r.lv, n1 = G.n1, n0 = G.n0, sg1 = G.sg1, pc = G.pc;
  const cap = PB.loanCap(T, r.sc, r.mCur);
  const fund = r.mCur <= T.fundEnd ? n1(T.fund) : '<small>lapsed</small>';
  const net = tm.P.net, run = net < 0 && T.cash > 0 ? T.cash / -net : (T.cash <= 0 ? 0 : 99);
  const cashCls = T.cash < 0 || run < 6 ? 'bad' : (run < 12 ? 'warn' : '');
  const cashTip = T.cash < 0 ? 'Cash is negative: the bank will step in' : (run < 12 ? 'At this rate cash runs out in about ' + Math.max(1, Math.floor(run)) + ' months' : 'Cash and the monthly change (income minus costs)');
  const left = T.fundEnd - r.mCur + 1, fundCls = r.mCur <= T.fundEnd && T.fund > 3 && left <= 6 ? 'warn' : '';
  const debt = T.debt + T.emerg, loanCls = T.emerg > 0 || (cap > 0 && debt / cap >= 0.8) ? 'warn' : '';
  const behind = r.ck.T > 12 && tm.ps.score < lv.score.parkTarget * (r.ck.T - 6) / r.months;
  return '<div class="kpi ' + cashCls + '" title="' + escapeHtml(cashTip) + '"><span class="label">' + t('kpi.cash') + '</span><span class="v">' + n1(T.cash) + ' <small class="' + (net < 0 ? 'neg' : (net > 0 ? 'pos' : '')) + '">' + (net < 0 ? '▼' : (net > 0 ? '▲' : '')) + ' ' + sg1(net) + '/' + t('kpi.mo') + '</small></span></div>' +
    '<div class="kpi ' + fundCls + '"><span class="label">Development Fund</span><span class="v">' + fund + (fundCls ? '<small> ' + left + ' ' + t('kpi.mo') + '</small>' : '') + '</span></div>' +
    (lv.key === 'rintis' ? '' : '<div class="kpi ' + loanCls + '"><span class="label">' + t('kpi.loans') + '</span><span class="v">' + n1(debt) + '<small> / ' + cap + '</small></span></div>') +
    '<div class="kpi ' + (behind ? 'warn' : '') + '"><span class="label">' + t('kpi.score') + '</span><span class="v">' + n0(tm.ps.score) + '<small> / ' + lv.score.parkTarget + '</small></span></div>' +
    '<div class="kpi"><span class="label">FCR12</span><span class="v">' + (isFinite(tm.ps.fcr) ? tm.ps.fcr.toFixed(2) : '–') + '<small> drift ' + pc(tm.ps.drift) + '</small></span></div>' +
    '<div class="kpi"><span class="label">' + t('kpi.occ') + '</span><span class="v">' + pc(tm.occ) + '</span></div>' +
    (lv.score.E > 0 ? '<div class="kpi"><span class="label">ESG</span><span class="v" style="color:' + (T.esg < 0 ? 'var(--c-crit)' : 'inherit') + '">' + (T.esg >= 0 ? '+' : '') + n1(T.esg) + '</span></div>' : '') +
    '<div class="kpi ' + (T.ap === 0 ? 'dim' : '') + '"><span class="label">Action points</span><span class="v"><span class="ap">' + G.apDots(T.ap) + '</span>' + T.ap + '<small> +' + T.apQ + '/' + t('kpi.qtr') + '</small></span></div>';
}
function tabHTML(r, tm) {
  switch (uiStore.tab) {
    case 'impact': return G.tabImpact(r, tm);
    case 'stand': return G.tabStand(r, tm);
    case 'news': return G.tabNews(r, tm);
    case 'pins': return pinsHTML();
    case 'rules': return G.RULES_HTML(r.sc);
    default: return G.tabPark(r, tm);
  }
}
function setTab(k) { uiStore.tab = k; uiStore.save(); $$('#plot-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.plot === k)); app().ui.tab = k; if (activity) activity.event('tab', { k }); render(true); }

/* ---------------------------------------------------------------- clock bar */
function readoutsHTML(r, tm) {
  if (!r) return '';
  const d = G.dateParts(r.ck.T, r.months), g = r.g;
  let h = G.levelChip(r).replace('class="chip lvl"', 'class="chip"') + G.phaseChip(r) + G.statusChip(g, r.ck);
  if (tm) h += '<span class="ro">' + escapeHtml(t('ro.ap')) + ' <b>' + tm.t.ap + '</b></span>';
  if (G.store() && G.store().mode === 'live') { const L = root.IMPAKLive; h += '<span class="chip">' + escapeHtml(t('ro.room', { code: (L && L.room) || '' })) + '</span><span class="sync ' + (L ? L.syncClass() : 'off') + '"><i></i>' + escapeHtml(t(L ? L.syncKey() : 'ro.sync.off')) + '</span>'; }
  return h;
}
const MON = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], ms: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'] };
function bigClockHTML(r) {
  if (!r) return '';
  const d = G.dateParts(r.ck.T, r.months), mi = Math.min(r.months - 1, Math.floor(r.ck.T + 1e-9)), mo = mi % 12;
  const frac = Math.max(0, Math.min(1, r.ck.T / r.months));
  return '<div class="bc-date"><b>' + d.day + '</b> ' + escapeHtml(MON[prefs.lang === 'ms' ? 'ms' : 'en'][mo]) + '</div>' +
    '<div class="bc-meta"><span class="bc-year">' + escapeHtml(t('ro.year', { y: d.year })) + '</span><span class="bc-month">' + escapeHtml(t('ro.month', { m: mi + 1, n: r.months })) + '</span>' +
    '<span class="bc-bar" aria-hidden="true"><i style="width:' + (frac * 100).toFixed(1) + '%"></i></span></div>';
}
function updateTransport(r) {
  const bar = $('.transport'), a = app(), live = G.store() && G.store().mode === 'live';
  bar.classList.toggle('locked', !!live && a.role !== 'gm');
  const play = $('#btn-play'), step = $('#btn-step'), reset = $('#btn-reset'), speed = $('#sel-speed');
  if (!r || a.role !== 'solo') { play.disabled = !r && a.role !== 'solo'; play.classList.remove('running'); $('#lbl-play').textContent = t('tr.play'); step.disabled = true; reset.disabled = a.role !== 'solo'; if (!r) { const ro = $('#readouts'); ro.innerHTML = ''; ro._k = ''; const bc = $('#bigclock'); bc.innerHTML = ''; bc._k = ''; return; } }
  const g = r.g, ck = r.ck;
  if (a.role === 'solo') {
    const running = g.status === 'running' && !ck.hold;
    play.classList.toggle('running', running);
    play.disabled = g.status === 'ended' || !!ck.hold;
    $('#lbl-play').textContent = g.status === 'setup' ? t('tr.play') : (running ? t('tr.pause') : t('tr.resume'));
    step.disabled = !!ck.hold || g.status === 'ended' || g.status === 'setup';
    reset.disabled = false;
    if (String(g.msPerMonth) !== speed.value) speed.value = String(g.msPerMonth);
  }
  const ro = $('#readouts'), rh = readoutsHTML(r, teamNow(r)); if (ro._k !== rh) { ro.innerHTML = rh; ro._k = rh; }
  const bc = $('#bigclock'), bh = bigClockHTML(r); if (bc._k !== bh) { bc.innerHTML = bh; bc._k = bh; }
}
function soloPlay() { const r = res(); if (!r) return; const g = r.g; if (g.status === 'setup') G.dispatch('solo-start'); else if (g.status === 'running' && !r.ck.hold) G.dispatch('solo-pause'); else if (g.status === 'paused') G.dispatch('solo-resume'); render(true); }
function soloStep() { const r = res(); if (!r || r.ck.hold || r.g.status === 'ended' || r.g.status === 'setup') return; const nx = r.ck.next; if (!nx) return; G.store().gmUpdate({ accMs: nx.t * r.g.msPerMonth, startedAt: HOST.now(), status: 'running', lastReveal: null }); render(true); }
async function soloNew() { const r = res(); if (r && r.g.status !== 'setup' && r.g.status !== 'ended' && !(await ask(t('tr.confirmNew')))) return; switchLevel(S.level, true); }

/* ---------------------------------------------------------------- landing (no role yet) */
function landingHTML() {
  const L = root.IMPAKLive, online = !!(L && L.configured);
  const levelBtns = LEVELS.map((k, i) => '<button type="button" class="btn' + (i === 0 ? ' accent' : '') + '" data-level="' + i + '" data-a="solo">' + escapeHtml(t('stage.' + i)) + '</button>').join('');
  let live = '';
  if (!online) live = '<p class="muted">' + escapeHtml(t('land.offline')) + '</p>';
  else if (LAND.view === 'live') live = joinFormHTML('team');
  else if (LAND.view === 'gm') live = joinFormHTML('gm');
  else live = '<div class="rcbtns"><button type="button" class="btn accent" data-a="open" data-v="live">' + escapeHtml(t('land.live')) + '</button></div>';
  const t0 = PB.newTeam('preview', 'priority', 'lestari');
  return '<div class="hero"><div><h1>' + escapeHtml(G.BRAND.name) + '<sup class="tm">™</sup><small>' + escapeHtml(G.BRAND.tag) + '</small></h1>' +
    '<p>' + escapeHtml(t('say.landing')) + '</p>' + qrHTML() + resumeHTML() + '</div><div class="panel" style="padding:8px">' + G.planSVG(t0, 1, 0, null, 'L') + '</div></div>' +
    '<div class="rolecards' + (LAND.view === 'live' ? ' joining' : '') + '">' +
    '<div class="rolecard solo"><h3>' + escapeHtml(t('land.solo')) + '</h3><p>' + escapeHtml(t('land.solo.d')) + '</p><div class="rcbtns">' + levelBtns + '</div></div>' +
    '<div class="rolecard live"><h3>' + escapeHtml(t('land.live')) + '</h3><p>' + escapeHtml(t('land.live.d')) + '</p>' + live + '</div>' +
    (online ? '<div class="rolecard rc-gm"><h3>' + escapeHtml(t('land.gm')) + '</h3><p>' + escapeHtml(t('land.gm.d')) + '</p><div class="rcbtns"><button type="button" class="btn" data-a="open" data-v="gm">' + escapeHtml(t('join.gm')) + '</button><button type="button" class="btn" data-a="screen">' + escapeHtml(t('join.screen')) + '</button></div></div>' : '') +
    '</div><div class="foot">' + escapeHtml(G.BRAND.mark) + ' · ' + escapeHtml(G.BRAND.copyright) + ' · v' + escapeHtml(G.BRAND.version) + '</div>';
}
function qrHTML() {
  if (!root.__QR_SITE) return '';
  const u = String(root.IMPAK_SITE || '').replace(/^https:\/\//, '').replace(/\/$/, '');
  return '<div class="qrbox">' + root.__QR_SITE + '<div><div class="adv-sub">' + escapeHtml(t('land.qr')) + '</div><div class="qrurl">' + escapeHtml(u) + '</div><div class="faint">' + escapeHtml(t('land.qr.d')) + '</div></div></div>';
}
HOST.joinCard = (res) => {
  const L = root.IMPAKLive, room = L && L.room;
  return '<div class="joincard">' + (root.__QR_SITE || '') + '<div><div class="label">' + escapeHtml(t('land.qr')) + '</div><div class="qrurl">' + escapeHtml(String(root.IMPAK_SITE || '').replace(/^https:\/\//, '').replace(/\/$/, '')) + '</div>' +
    (room ? '<div class="label" style="margin-top:10px">' + escapeHtml(t('join.room')) + '</div><div class="code">' + escapeHtml(room) + '</div>' : '') + '<div class="faint">' + escapeHtml(t('land.qr.join')) + '</div></div></div>';
};
function resumeHTML() {
  const A = app(), btns = [];
  const sg = A.solo && A.solo.game;
  if (sg && sg.status !== 'ended') {
    let date = ''; try { const sc = G.scen(sg.seed, sg.level); const ck = G.clockOf(sg, sc, HOST.now()); const d = G.dateParts(ck.T, sc.months); date = d.day + ' ' + MON[prefs.lang === 'ms' ? 'ms' : 'en'][MON.en.indexOf(d.month)] + ', ' + t('ro.year', { y: d.year }); } catch (e) { /* ignore */ }
    btns.push('<button type="button" class="btn accent" data-a="resume-solo">' + escapeHtml(t('land.resume.solo', { level: t('stage.' + levelIndex(sg.level)), date })) + '</button>');
  }
  const L = root.IMPAKLive, ses = L && L.store && L.store.session;
  if (ses && ses.room) {
    const g = L.store.game, tm = g && ses.team ? g.teams.find((x) => x.id === ses.team) : null;
    const k = ses.role === 'gm' ? 'land.resume.gm' : (ses.role === 'screen' ? 'land.resume.screen' : 'land.resume.team');
    btns.push('<button type="button" class="btn accent" data-a="resume-live">' + escapeHtml(t(k, { room: ses.room, team: tm ? tm.name : '' })) + '</button><button type="button" class="btn" data-a="leave-live">' + escapeHtml(t('land.leave')) + '</button>');
  }
  if (!btns.length) return '';
  return '<div class="resume"><div class="adv-sub">' + escapeHtml(t('land.resume')) + '</div><div class="rcbtns">' + btns.join('') + '</div></div>';
}
function resumeSolo() {
  const A = app(); if (!A.solo || !A.solo.game) return;
  A.store = A.solo; A.role = 'solo'; A.teamId = 'you'; HOST.hash('solo');
  S.level = levelIndex(A.solo.game.level); uiStore.level = S.level; uiStore.save();
  activity.start(S.level); S.lastSaid = ''; stageNav.render(); render(true);
}
function resumeLive() {
  const A = app(), L = root.IMPAKLive, ses = L && L.store && L.store.session; if (!ses) return;
  A.store = L.store; A.live = L.store;
  if (ses.role === 'gm') { A.canEdit = true; A.role = 'gm'; }
  else if (ses.role === 'screen') A.role = 'screen';
  else { A.role = 'team'; A.teamId = ses.team; }
  afterJoin(); S.lastSaid = ''; render(true);
}
function goHome() {
  const A = app(), r = res();
  if (A.role === 'solo' && r && r.g.status === 'running' && !r.ck.hold) G.dispatch('solo-pause');
  ACT.home();
  lastKind = ''; S.lastSaid = ''; LAND.view = 'home';
  stageNav.render(); render(true);
}
function joinFormHTML(kind) {
  const L = root.IMPAKLive, f = L.form;
  const inp = (id, key, type, extra) => '<div class="f"><label for="j-' + id + '">' + escapeHtml(t(key)) + '</label><input id="j-' + id + '" data-j="' + id + '" type="' + (type || 'text') + '" value="' + escapeHtml(f[id] || '') + '"' + (extra || '') + '></div>';
  let h = '<form class="join" data-kind="' + kind + '">';
  if (kind === 'team') {
    h += '<div class="two">' + inp('room', 'join.room', 'text', ' autocomplete="off" maxlength="6" style="text-transform:uppercase"') + inp('pin', 'join.pin', 'text', ' inputmode="numeric" autocomplete="off" maxlength="6"') + '</div>' +
      inp('name', 'join.name', 'text', ' autocomplete="name"') + '<div class="two">' + inp('email', 'join.email', 'email', ' autocomplete="email"') + inp('org', 'join.org') + '</div>';
    if (L.needsCode) h += '<div class="two">' + inp('code', 'join.code', 'text', ' inputmode="numeric" maxlength="6"') + '<div class="f"><label>&nbsp;</label><button type="button" class="btn" data-a="sendcode"' + (LAND.busy ? ' disabled' : '') + '>' + escapeHtml(t('join.sendCode')) + '</button></div></div>';
    h += '<div class="pdpa">' + escapeHtml(t('join.pdpa')) + '</div>';
  } else {
    h += '<div class="two">' + inp('room', 'join.room', 'text', ' autocomplete="off" maxlength="6" style="text-transform:uppercase"') + inp('gmpin', 'join.gmPin', 'password', ' autocomplete="off"') + '</div>' + inp('email', 'join.email', 'email');
  }
  h += '<div class="err">' + escapeHtml(LAND.err) + (LAND.codeSent ? escapeHtml(t('join.codeSent')) : '') + '</div><div class="rcbtns"><button type="submit" class="btn accent"' + (LAND.busy ? ' disabled' : '') + '>' + escapeHtml(t(kind === 'team' ? 'join.go' : 'join.gm')) + '</button><button type="button" class="btn" data-a="open" data-v="home">' + escapeHtml(t('ui.info.close')) + '</button></div></form>';
  return h;
}
function wireLanding(el) {
  el.querySelectorAll('[data-a="solo"]').forEach((b) => b.addEventListener('click', () => switchLevel(parseInt(b.dataset.level, 10), true)));
  el.querySelectorAll('[data-a="resume-solo"]').forEach((b) => b.addEventListener('click', resumeSolo));
  el.querySelectorAll('[data-a="resume-live"]').forEach((b) => b.addEventListener('click', resumeLive));
  el.querySelectorAll('[data-a="leave-live"]').forEach((b) => b.addEventListener('click', () => { root.IMPAKLive.leave(); render(true); }));
  el.querySelectorAll('[data-a="open"]').forEach((b) => b.addEventListener('click', () => { LAND.view = b.dataset.v; LAND.err = ''; LAND.codeSent = false; render(true); }));
  el.querySelectorAll('[data-a="screen"]').forEach((b) => b.addEventListener('click', async () => { const L = root.IMPAKLive; const code = await ask(t('join.room'), true); if (code) L.openScreen(code.toUpperCase()).then(() => render(true), (e) => { K.toast(t(e.key || 'join.err.net')); }); }));
  el.querySelectorAll('[data-a="sendcode"]').forEach((b) => b.addEventListener('click', () => { const L = root.IMPAKLive; readForm(el); LAND.busy = true; render(true); L.sendCode().then(() => { LAND.codeSent = true; LAND.err = ''; }, (e) => { LAND.err = t(e.key || 'join.err.net'); }).finally(() => { LAND.busy = false; render(true); }); }));
  const form = el.querySelector('form.join');
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault(); const L = root.IMPAKLive; readForm(el); LAND.busy = true; LAND.err = ''; render(true);
    const p = form.dataset.kind === 'team' ? L.join() : L.openGM();
    p.then(() => { LAND.view = 'home'; afterJoin(); }, (err) => { LAND.err = t(err.key || 'join.err.net'); }).finally(() => { LAND.busy = false; render(true); });
  });
}
function readForm(el) { const L = root.IMPAKLive; el.querySelectorAll('[data-j]').forEach((i) => { L.form[i.dataset.j] = i.value.trim(); }); L.saveForm(); }
function afterJoin() {
  const a = app(); S.level = levelIndex(G.game() && G.game().level); uiStore.level = S.level; uiStore.save();
  if (a.role === 'team') { activity.start(S.level); narrator.say('say.welcome.' + S.level, {}, true); predict.hide(); }
  stageNav.render();
}

/* ---------------------------------------------------------------- frames: regions mounted into the shell */
function focusState(el) {
  const a = doc.activeElement; if (!a || !el.contains(a) || !/^(INPUT|TEXTAREA)$/.test(a.tagName)) return null;
  return { id: a.id, din: a.dataset.in, di: a.dataset.i, value: a.value, s: a.selectionStart, e: a.selectionEnd };
}
function restoreFocus(el, f) {
  if (!f) return;
  const q = f.id ? '#' + CSS.escape(f.id) : '[data-in="' + f.din + '"]' + (f.di != null ? '[data-i="' + f.di + '"]' : '');
  const n = el.querySelector(q); if (!n) return;
  if (n.value !== f.value) n.value = f.value;
  try { n.focus({ preventScroll: true }); if (f.s != null) n.setSelectionRange(f.s, f.e); } catch (e) { /* ignore */ }
}
function apply(regions) {
  for (const r of regions) {
    const el = doc.getElementById(r.id); if (!el) continue;
    const key = r.key !== undefined ? r.key : r.html;
    if (el._k !== key) { const f = focusState(el); el.innerHTML = r.html !== undefined ? r.html : r.fn(); el._k = key; restoreFocus(el, f); if (r.after) r.after(el); }
  }
}
function clearRegions(ids) { for (const id of ids) { const el = doc.getElementById(id); if (el && el._k !== '') { el.innerHTML = ''; el._k = ''; } } }
const TEAM_REGIONS = ['r-tiles', 'r-banner', 'r-map', 'r-leg', 'r-zone', 'r-apps', 'r-money', 'r-fac', 'r-tab', 'r-over'];
function teamRegions(r, tm) {
  const a = app(), ca = prefs.lang + JSON.stringify(G.canAct(r));
  const MS = 20, mapT = tm.t.buildings.some((b) => b.status === 'building') ? Math.floor(r.T * MS) / MS : '';
  const hold = r.ck.hold;
  const overKey = [prefs.lang, r.key, hold && hold.id, r.g.status, r.g.lastReveal, r.g.reveal, a.ui.seenReveal, a.ui.seenEnd, hold && hold.kind === 'event' ? JSON.stringify(G.store().decisionOf(hold.id, tm.id)) : ''].join('|');
  return [
    { id: 'r-tiles', key: r.key + '|' + Math.floor(r.T * 4) + '|' + prefs.lang, fn: () => tilesHTML(r, tm) },
    { id: 'r-banner', html: G.bannerTeam(r, tm) },
    { id: 'r-map', key: r.key + '|' + a.ui.zone + '|' + mapT, fn: () => G.planSVG(tm.t, r.mCur, mapT === '' ? r.T : mapT, a.ui.zone, 'm') },
    { id: 'r-leg', key: 'leg', fn: G.planLegend },
    { id: 'r-zone', key: r.key + '|' + a.ui.zone + '|' + ca, fn: () => G.zonePanel(r, tm) },
    { id: 'r-apps', key: r.key + '|' + ca, fn: () => G.tabApps(r, tm) },
    { id: 'r-money', key: r.key + '|' + a.ui.loan + '|' + a.ui.repay + '|' + ca, fn: () => G.tabMoney(r, tm) },
    { id: 'r-fac', key: r.key + '|' + ca, fn: () => G.tabFac(r, tm) },
    { id: 'r-tab', key: r.key + '|' + uiStore.tab + '|' + (uiStore.tab === 'stand' ? Math.floor(r.T * 4) : '') + '|' + (S.pins.A ? 'A' : '') + (S.pins.B ? 'B' : ''), fn: () => tabHTML(r, tm) },
    { id: 'r-over', key: overKey, fn: () => G.dealTeam(r, tm) || G.soloHoldOverlay(r, tm) || G.finalOverlay(r, tm) },
  ];
}
function groupStatus(r, tm) {
  const T = tm.t;
  $('#zone-status').textContent = a().ui.zone + ' · ' + (C.ZONES[a().ui.zone] ? C.ZONES[a().ui.zone].name : '');
  $('#apps-status').textContent = T.applicants.length ? T.applicants.length + ' applying' : '';
  $('#money-status').textContent = 'cash ' + G.n1(T.cash) + (T.debt ? ' · debt ' + G.n1(T.debt + T.emerg) : '');
  $('#fac-status').textContent = Object.keys(T.fac).filter((k) => T.fac[k]).length + ' set up';
  function a() { return app(); }
}

/* ---------------------------------------------------------------- the tutor watches the game */
function watch(r, tm) {
  if (!r || !tm) return;
  const g = r.g, ck = r.ck, T = tm.t;
  let key = '';
  if (r.final && g.reveal && tm.rub) key = 'say.final.' + tm.rub.medal;
  else if (T.receiver) key = 'say.receiver';
  else if (ck.hold) key = ck.hold.kind === 'event' ? 'say.hold.event' : (ck.hold.kind === 'checkpoint' ? 'say.hold.checkpoint' : 'say.hold.' + ck.hold.kind);
  else if (g.status === 'setup') key = G.store().mode === 'live' ? 'say.live.wait' : 'say.setup';
  else if (g.lastReveal && g.status === 'paused') key = 'say.dealClosed';
  else if (g.status === 'paused') key = 'say.paused';
  else if (T.cash > 0 && tm.P.net < 0 && T.cash / -tm.P.net < 6) key = 'say.cash.low';
  else if (r.mCur <= T.fundEnd && T.fund > 3 && T.fundEnd - r.mCur < 4) key = 'say.fund.lapse';
  else if (T.ap === 0 && r.mCur % 3 !== 0) key = 'say.ap.none';
  else if (g.status === 'running') key = 'say.running';
  if (key && key !== S.lastSaid) { S.lastSaid = key; narrator.say(key, {}, true); }
  if (predict && predict.state && !predict.state.revealed && predict.state.chosen >= 0 && r.T >= 6) predict.reveal();
}

/* ---------------------------------------------------------------- decision journal and glossary */
function renderJournal(r, tm) {
  const A = root.IMPAKAdvice, box = $('#journal'); if (!A || !box) return;
  const key = prefs.lang + '|' + JSON.stringify(tm.t.dlog.map((d) => [d.eid, d.opt, d.sound]));
  if (box._k === key) return; box._k = key;
  box.innerHTML = A.journal(r, tm);
  const el = tm.t.dlog.filter((d) => d.eligible);
  $('#journal-count').textContent = el.length ? el.filter((d) => d.sound).length + '/' + el.length : '';
}
function renderGloss() {
  const box = $('#gloss'), q = ($('#gloss-q').value || '').trim().toLowerCase(), L = prefs.lang === 'ms' ? 'ms' : 'en';
  const cats = (root.GLOSS_CATS || {})[L] || {};
  const items = (root.GLOSSARY || []).filter((g) => !q || (g.term + ' ' + (g.aka || '') + ' ' + g[L]).toLowerCase().indexOf(q) >= 0);
  if (!items.length) { box.innerHTML = '<p class="faint">' + escapeHtml(t('gloss.none')) + '</p>'; return; }
  let h = '', cat = '';
  for (const g of items) {
    if (g.cat !== cat) { cat = g.cat; h += '<div class="gcat">' + escapeHtml(cats[cat] || cat) + '</div>'; }
    h += '<dt>' + escapeHtml(g.term) + (g.aka ? ' <small>(' + escapeHtml(g.aka) + ')</small>' : '') + '</dt><dd>' + escapeHtml(g[L]) + '</dd>';
  }
  box.innerHTML = h;
}
function openGloss() {
  const d = $('#glossbox'); if (!d) return; d.open = true;
  try { d.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { /* ignore */ }
  setTimeout(() => { const i = $('#gloss-q'); if (i) i.focus({ preventScroll: true }); }, 350);
}

/* ---------------------------------------------------------------- why? and the assumption ledger */
function renderWhy() { const el = $('#why'); if (el) el.innerHTML = t('why.' + S.level); }
function renderLedger() {
  const el = $('#ledger'); if (!el) return;
  const row = (k, v) => '<li><b>' + escapeHtml(k) + '</b>: ' + escapeHtml(v) + '</li>';
  const ten = Object.keys(C.TEN).map((k) => C.TEN[k].label + ' ' + C.TEN[k].rent + ' Cr/unit/yr, IP ' + C.TEN[k].ip + (C.TEN[k].linked ? ', linked' : '')).join('; ');
  el.innerHTML = '<li class="faint">' + escapeHtml(t('ledger.note')) + '</li>' +
    row('Development Fund', C.FUND + ' Cr, pays ' + Math.round(C.FUND_SHARE * 100) + '% of capital works until month ' + C.FUND_END + ' (Rintis: 20 Cr, 100%)') +
    row('Start cash · park office', C.START_CASH + ' Cr · ' + C.PARK_OFFICE + ' Cr/yr') +
    row('Loans', 'cap ' + C.LOAN_CAP + ' Cr at ' + Math.round(C.RATE * 100) + '%/yr; emergency loan ' + Math.round(C.EMERG * 100) + '%') +
    row('Action points', C.AP_Q + ' per quarter') +
    row('Works', Object.keys(C.WORKS).map((k) => C.WORKS[k].label + ' ' + C.WORKS[k].cost + ' Cr / ' + C.WORKS[k].months + ' mo').join('; ')) +
    row('Buildings', Object.keys(C.BUILD).map((k) => C.BUILD[k].label + ' ' + C.BUILD[k].cost + ' Cr, ' + C.BUILD[k].units + ' units, ' + C.BUILD[k].months + ' mo, upkeep ' + C.BUILD[k].upkeep).join('; ')) +
    row('Tenants', ten) +
    row('Start-ups', 'fee ' + C.STARTUP.fee + ' Cr, graduation 1/3 (1/2 with a lab), failure 1/6, IP on graduation ' + C.STARTUP.gradIP) +
    row('Applicant mix', C.MIX.map((m) => m[0] + ' ' + Math.round(m[1] * 100) + '%').join(', ')) +
    row('Downturn', Object.keys(C.SEV).map((k) => C.SEV[k].label + ': cap ' + C.SEV[k].cap + ', rate ' + Math.round(C.SEV[k].rate * 100) + '%, unlinked rents −' + Math.round(C.SEV[k].cut * 100) + '%').join('; ')) +
    row('FCR bands', C.FCR_BANDS.map((b) => '≥ ' + b[0] + ' → +' + b[1]).join(', ') + '; below → ' + C.FCR_LOW) +
    row('Drift penalty', C.DRIFT_PEN.map((b) => '> ' + Math.round(b[0] * 100) + '% → −' + b[1]).join(', ')) +
    row('ESG', 'floor ' + C.ESG.floor + ', target ' + C.ESG.target + '; clear ' + C.ESG.clear + ', buffer +' + C.ESG.buffer + ', park +' + C.ESG.park + ', certification +' + C.ESG.cert) +
    row('Medals', 'Gold ' + C.MEDALS.gold + ' · Silver ' + C.MEDALS.silver + ' · Bronze ' + C.MEDALS.bronze + ' (+ park gate: half the target)') +
    row('Impact coefficients', 'jobs per unit: ' + Object.keys(PB.SOCIO).filter((k) => PB.SOCIO[k] && PB.SOCIO[k].jobs != null).map((k) => k + ' ' + PB.SOCIO[k].jobs).join(', ') + '; local multiplier ' + PB.SOCIO.mult);
}

/* ---------------------------------------------------------------- rendering */
function setMode() {
  const a = app(), chip = $('#mode-chip');
  const live = G.store() && G.store().mode === 'live';
  chip.textContent = a.role === 'solo' ? t('mode.solo') : (a.role ? t('mode.live') : '');
  doc.body.classList.toggle('fullpage', a.role === 'gm' || a.role === 'screen');
  $('#app').hidden = !(a.role === 'gm' || a.role === 'screen');
  $('#r-land').hidden = !!a.role;
  $('#ctrl-note').innerHTML = a.role ? '' : '<div class="note">' + escapeHtml(t('ctrl.nogame')) + '</div>';
  void live;
}
let lastKind = '';
function render(force) {
  const a = app();
  setMode();
  doc.body.classList.toggle('on-landing', !a.role);
  doc.body.classList.toggle('live-mode', !!(G.store() && G.store().mode === 'live'));
  const bc = $('#to-console'); if (bc) bc.hidden = !(a.role === 'screen' && a.canEdit);
  $('#btn-home').hidden = !a.role;
  if (!a.role) {
    const land = $('#r-land'), key = 'land|' + prefs.lang + '|' + (app().solo && app().solo.game ? app().solo.game.gid + app().solo.game.status : '') + '|' + (root.IMPAKLive && root.IMPAKLive.room) + '|' + LAND.view + '|' + LAND.err + '|' + LAND.busy + '|' + LAND.codeSent + '|' + (root.IMPAKLive && root.IMPAKLive.configured);
    if (land._k !== key) { land.innerHTML = landingHTML(); land._k = key; wireLanding(land); }
    clearRegions(TEAM_REGIONS); updateTransport(null);
    if (S.lastSaid !== 'landing') { S.lastSaid = 'landing'; narrator.say('say.landing', {}, true); }
    return;
  }
  if (a.role === 'gm' || a.role === 'screen') {
    const fr = G.buildFrame(), box = $('#app');
    if (lastKind !== fr.kind) { box.innerHTML = fr.mount; lastKind = fr.kind; }
    apply(fr.regions);
    applyLive(fr.live);
    updateTransport(null);
    return;
  }
  const r = res(), tm = teamNow(r);
  if (!r || !tm) { clearRegions(TEAM_REGIONS); updateTransport(r); return; }
  lastKind = '';
  apply(teamRegions(r, tm));
  groupStatus(r, tm);
  renderJournal(r, tm);
  updateTransport(r);
  applyLive(G.liveData(r));
  watch(r, tm);
  if (activity) activity.poll(r, tm);
}
function applyLive(live) {
  if (!live) return; const now = HOST.now();
  doc.querySelectorAll('[data-live="dealtimer"]').forEach((el) => { if (live.dealEnd == null) return; const left = live.dealEnd - now; el.textContent = G.fmtTimer(left); el.classList.toggle('low', left < 20000); });
  doc.querySelectorAll('[data-live="resumetimer"]').forEach((el) => { if (live.resumeEnd == null) return; el.textContent = G.liveText('resume', live.resumeEnd - now); });
}
function loop() {
  if (doc.hidden) return;
  try { const r = res(); G.autoTick(r, false); render(); } catch (err) { console.error(err); }
}

/* ---------------------------------------------------------------- language, theme, static text */
function applyLang() {
  HOST.lang = prefs.lang;
  K.applyStaticText(t); K.applyPrefsUI(prefs, t);
  renderWhy(); renderLedger(); renderGloss();
  $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  $('#btn-home').title = t('nav.home.tip');
  const jb = $('#journal'); if (jb) jb._k = '';
  if (stageNav) stageNav.render();
  if (activity) activity.render();
  if (screenGuide) screenGuide.render();
  if (resultsBar) resultsBar.render();
  narrator.renderLog();
  const land = $('#r-land'); land._k = '';
  S.lastSaid = '';                                        // the tutor repeats the current line in the new language
  if (predict && predict.state && predict.state.chosen < 0) predict.show(predict.state.card);
  if (!app().role) narrator.say('say.landing', {}, true);
  render(true);
}

/* ---------------------------------------------------------------- zoom and pan on the site plan */
function setupViewport() {
  const sc = $('#vpscroll'), zoomEl = $('#vpzoom');
  let drag = null;
  sc.addEventListener('pointerdown', (e) => { if (e.target.closest('g[data-act], button, a, input, select')) return; drag = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop, moved: false }; });
  sc.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; sc.classList.add('dragging'); } sc.scrollLeft = drag.l - dx; sc.scrollTop = drag.t - dy; });
  const up = () => { drag = null; sc.classList.remove('dragging'); };
  sc.addEventListener('pointerup', up); sc.addEventListener('pointercancel', up); sc.addEventListener('pointerleave', up);
  sc.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); S.zoom = Math.max(0.6, Math.min(3, S.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); zoomEl.style.transform = 'scale(' + S.zoom + ')'; zoomEl.style.width = (100 / S.zoom) + '%'; }, { passive: false });
  $('#vp-fit').addEventListener('click', () => { S.zoom = 1; zoomEl.style.transform = ''; zoomEl.style.width = ''; sc.scrollTo(0, 0); });
  $('#vp-pinA').addEventListener('click', () => pinNow('A'));
  $('#vp-pinB').addEventListener('click', () => pinNow('B'));
  $('#vp-clear').addEventListener('click', () => { S.pins = { A: null, B: null }; $('#tab-pins').hidden = true; $('#vp-clear').hidden = true; if (uiStore.tab === 'pins') setTab('park'); else render(true); });
}

/* ---------------------------------------------------------------- game-core clicks (data-act) */
doc.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el || el.hasAttribute('disabled')) return;
  const name = el.dataset.act;
  if (!HOST.act[name] && !ACT[name]) return;
  if (el.type === 'checkbox') { G.dispatch(name, el.dataset, el); render(true); return; }
  e.preventDefault();
  G.dispatch(name, el.dataset, el);
  if (name === 'zone' && activity) { activity.event('zone', { z: el.dataset.z }); narrator.say('say.zone', { z: el.dataset.z }); }
  if (name === 'order' && activity) activity.event('order', { o: el.dataset.o });
  if (name === 'home') { S.lastSaid = ''; stageNav.render(); }
  render(true);
});
doc.addEventListener('input', (e) => { const el = e.target; if (el.dataset && el.dataset.in) G.onInput(el.dataset.in, el.dataset.i, el.value); });
doc.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest("g[data-act='zone']")) { e.preventDefault(); ACT.zone(e.target.closest('g').dataset); render(true); return; }
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button') return;
  if (app().role !== 'solo') return;
  if (e.code === 'Space') { e.preventDefault(); soloPlay(); } else if (e.key === 'r' || e.key === 'R') soloNew(); else if (e.key === '.') soloStep();
});

/* ---------------------------------------------------------------- boot */
function boot() {
  K.applyPrefsUI(prefs, t);
  K.setupPrefButtons(prefs, t, { onTheme: () => render(true), onLang: applyLang, onFont: () => render(true) });
  K.applyStaticText(t);
  for (const k of ['zone', 'apps', 'money', 'fac']) { const d = $('#grp-' + k); d.open = !!openState[k]; d.addEventListener('toggle', () => { openState[k] = d.open; openState.save(); }); }
  stageNav = K.createStageNav({ el: '#stages', moduleId: 'impak', lastStage: 2, base: 1, getStage: () => S.level, onSelect: (n) => switchLevel(n), progress: (n) => (activity ? activity.progress(n) : null) });
  activity = K.createActivity({ storeKey: 'impak.activity', steps: (n) => STEPS[n], taskEl: '#task', bubbleEl: '#bubble', listEl: '#checklist', stageCount: 3, base: 1, gotoStage: (n) => switchLevel(n), stageName: (n) => t('stage.' + n), onChange: () => stageNav.render() });
  predict = K.createPredict({ el: '#predict', narrator });
  resultsBar = K.createResultsBar({ el: '#reshead', storeKey: 'impak.results', onChange: () => {} });
  resultsBar.render();
  screenGuide = K.createScreenGuide({ button: '#btn-info', regions: [
    { id: 'stages', sel: '#stages', name: () => t('ui.reg.stages'), desc: () => t('ui.reg.stages.d'), acc: '--acc-data' },
    { id: 'prefs', sel: '.prefs', name: () => t('ui.reg.prefs'), desc: () => t('ui.reg.prefs.d'), acc: '--acc-data' },
    { id: 'controls', sel: '#controls', name: () => t('ui.reg.controls'), desc: () => t('ui.reg.controls.d'), acc: '--acc-input' },
    { id: 'viewport', sel: '#vpwrap', name: () => t('ui.reg.viewport'), desc: () => t('ui.reg.viewport.d'), acc: '--acc-output' },
    { id: 'results', sel: '#results', name: () => t('ui.reg.results'), desc: () => t('ui.reg.results.d'), acc: '--acc-output' },
    { id: 'guide', sel: '.explain', name: () => t('ui.reg.guide'), desc: () => t('ui.reg.guide.d'), acc: '--acc-guide' },
    { id: 'sim', sel: '.transport', name: () => t('ui.reg.sim'), desc: () => t('ui.reg.sim.d'), acc: '--acc-data' },
  ], extra: {
    html: () => '<h3>' + escapeHtml(t('ui.info.gloss')) + '</h3><p class="lead">' + escapeHtml(t('ui.info.gloss.d')) + ' <button type="button" class="tb" data-a="gloss">' + escapeHtml(t('gloss.open')) + '</button></p>',
    wire: (dlg, close) => { const b = dlg.querySelector('[data-a="gloss"]'); if (b) b.addEventListener('click', () => { close(); openGloss(); }); },
  } });
  $$('#plot-tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.plot)));
  setTab(uiStore.tab || 'park');
  $('#btn-home').addEventListener('click', goHome);
  const tc = doc.createElement('button'); tc.type = 'button'; tc.id = 'to-console'; tc.className = 'toconsole'; tc.hidden = true; tc.textContent = '← Game Master console';
  tc.addEventListener('click', () => { ACT['role-gm'](); lastKind = ''; render(true); }); doc.body.appendChild(tc);
  $('#btn-home').title = t('nav.home.tip');
  const setAll = (open) => { for (const k of ['zone', 'apps', 'money', 'fac']) { const d = $('#grp-' + k); d.open = open; openState[k] = open; } openState.save(); };
  $('#grp-open-all').addEventListener('click', () => setAll(true));
  $('#grp-fold-all').addEventListener('click', () => setAll(false));
  $('#btn-play').addEventListener('click', soloPlay);
  $('#btn-step').addEventListener('click', soloStep);
  $('#btn-reset').addEventListener('click', soloNew);
  $('#sel-speed').addEventListener('change', () => { const r = res(); if (r && app().role === 'solo') { G.dispatch('solo-pace', { v: $('#sel-speed').value }); render(true); } });
  setupViewport();
  renderWhy(); renderLedger(); renderGloss();
  $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  $('#gloss-q').addEventListener('input', renderGloss);
  if (!app().role) $('#journal').innerHTML = '<p class="faint">' + escapeHtml(t('ui.reg.guide')) + '</p>';
  S.level = uiStore.level || 0;
  if (root.IMPAKLive) root.IMPAKLive.init({ onState: () => render(true), onOffset: HOST.setOffset, t, K, G });
  const qroom = new URLSearchParams(location.search).get('room');
  if (qroom && root.IMPAKLive && root.IMPAKLive.configured) { root.IMPAKLive.form.room = qroom.toUpperCase().slice(0, 6); LAND.view = 'live'; }
  const h = (location.hash || '').replace('#', '');
  if (h === 'solo' || /^solo-/.test(h)) { const n = levelIndex(h.slice(5)); switchLevel(/^solo-/.test(h) ? n : S.level, true); }
  else if (root.IMPAKLive && root.IMPAKLive.resume()) { afterJoin(); }
  render(true);
  stageNav.render();
  setInterval(loop, 250);
}
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
