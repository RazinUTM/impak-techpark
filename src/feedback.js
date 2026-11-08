// SPDX-License-Identifier: MIT
/* IMPAK v0.6 — the feedback card of the public trial: two ratings, two short answers and an optional e-mail.
   Shown on the final card after the debrief and from the Guide's "Feedback" button; posted to the Apps Script
   backend (sheet "feedback") when one is configured. Anonymous unless the player types an e-mail. */
(function (root) {
'use strict';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let H = { t: (k) => k, lang: () => 'en', toast: () => {}, send: null, version: '' };
const ST = { fun: 0, learn: 0, good: '', bad: '', email: '', busy: false, msg: '', miss: [], badEmail: false, hidden: {}, sent: {} };
let CUR = null;                                               // the game the card is about
const t = (k, v) => H.t(k, v);
const key = (gid) => 'impak.fb.' + (gid || 'general');
function already(gid) { if (ST.sent[gid || 'general']) return true; try { return !!localStorage.getItem(key(gid)); } catch (e) { return false; } }
function markDone(gid) { ST.sent[gid || 'general'] = true; try { localStorage.setItem(key(gid), String(Date.now())); } catch (e) { /* ignore */ } }
const configured = () => !!(root.IMPAKLive && root.IMPAKLive.configured);

/* what the card is about: the current game, when there is one */
function context(res, tm) {
  const G = root.IMPAK;
  if (!res) { res = G && G.currentRes ? G.currentRes() : null; tm = res && G.teamOf ? G.teamOf(res, G.APP.teamId) : null; }
  if (!res) return { gid: '', mode: '', level: '', medal: '', total: '', month: '', team: '', room: '' };
  const rub = tm && tm.rub, L = root.IMPAKLive;
  return { gid: res.g.gid || '', mode: G.store().mode, level: res.g.level || '', medal: rub ? rub.medal : '', total: rub ? Math.round(rub.total * 10) / 10 : '',
    month: res.final ? res.months : res.mCur, team: tm ? tm.id : '', room: L && L.room || '' };
}
function stars(k) {
  return '<div class="stars" role="radiogroup" aria-label="' + esc(t('fb.' + k)) + '">' + [1, 2, 3, 4, 5].map((n) =>
    '<button type="button" class="star' + (ST[k] >= n ? ' on' : '') + '" data-fbstar="' + k + '" data-n="' + n + '" role="radio" aria-checked="' + (ST[k] === n) + '" aria-label="' + esc(t('fb.star', { n })) + '">' + (ST[k] >= n ? '★' : '☆') + '</button>').join('') + '</div>';
}
function form(c) {
  const gid = c.gid || 'general';
  if (already(c.gid)) return '<div class="fb done"><span>✓</span> ' + esc(t('fb.thanks')) + '</div>';
  if (ST.hidden[gid]) return '';
  return '<div class="fb" data-fbgid="' + esc(gid) + '"><div class="fb-h"><b>' + esc(t('fb.title')) + '</b><span class="muted">' + esc(t('fb.sub')) + '</span></div>' +
    '<div class="fb-row' + (ST.miss.indexOf('fun') >= 0 ? ' need' : '') + '"><span>' + esc(t('fb.fun')) + ' <b class="req" aria-hidden="true">*</b></span>' + stars('fun') + '</div><div class="fb-row' + (ST.miss.indexOf('learn') >= 0 ? ' need' : '') + '"><span>' + esc(t('fb.learn')) + ' <b class="req" aria-hidden="true">*</b></span>' + stars('learn') + '</div>' +
    '<label class="fb-f"><span>' + esc(t('fb.good')) + '</span><textarea data-fbk="good" maxlength="600" rows="2">' + esc(ST.good) + '</textarea></label>' +
    '<label class="fb-f"><span>' + esc(t('fb.bad')) + '</span><textarea data-fbk="bad" maxlength="600" rows="2">' + esc(ST.bad) + '</textarea></label>' +
    '<label class="fb-f"><span>' + esc(t('fb.email')) + '</span><input type="email" data-fbk="email" value="' + esc(ST.email) + '" autocomplete="email" maxlength="120"' + (ST.badEmail ? ' class="bad" aria-invalid="true"' : '') + '></label>' +
    '<input type="text" data-fbk="hp" class="fb-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
    '<div class="fb-pdpa">' + esc(t('fb.pdpa')) + '</div>' +
    '<div class="row"><button type="button" class="btn primary" data-fb="send"' + (ST.busy ? ' disabled' : '') + '>' + esc(t('fb.send')) + '</button><button type="button" class="btn" data-fb="later">' + esc(t('fb.later')) + '</button><span class="fb-msg">' + esc(ST.msg) + '</span></div></div>';
}
/* the card on the final result (after the debrief) */
function card(res, tm) { if (!configured()) return ''; CUR = context(res, tm); return form(CUR); }
/* the same form as a dialog, from the Guide's button or the start page */
function open() {
  if (!configured()) return;
  CUR = context();
  const d = document.createElement('dialog'); d.className = 'sguide askbox fbbox';
  d.innerHTML = '<div class="sgbody g">' + form(CUR) + '</div><div class="sgfoot"><button type="button" class="tb" data-fb="close">' + esc(t('ui.info.close')) + '</button></div>';
  document.body.appendChild(d);
  const done = () => { try { d.close(); } catch (e) { /* ignore */ } d.remove(); };
  d.addEventListener('click', (e) => { if (e.target.closest('[data-fb="close"], [data-fb="later"]')) done(); });
  d.addEventListener('cancel', (e) => { e.preventDefault(); done(); });
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}
function rerender(el) { const box = el.closest('.fb, .fb.done'); if (!box) return; const w = document.createElement('div'); w.innerHTML = form(CUR); const nu = w.firstElementChild; if (nu) box.replaceWith(nu); else box.remove(); }
async function send(el) {
  if (ST.busy) return;
  const hp = (document.querySelector('.fb [data-fbk="hp"]') || {}).value || '';
  ST.miss = ['fun', 'learn'].filter((k) => !ST[k]);
  if (ST.miss.length) { ST.msg = t('fb.need'); rerender(el); return; }                       // the stars are required; the text is not
  const email = ST.email.trim(); ST.badEmail = !!email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  if (ST.badEmail) { ST.msg = t('fb.email.bad'); rerender(el); return; }
  ST.busy = true; ST.msg = ''; rerender(el);
  const c = CUR || context();
  const ua = /iPad|iPhone/.test(navigator.userAgent) ? 'ios' : (/Android/.test(navigator.userAgent) ? 'android' : (/Mac/.test(navigator.userAgent) ? 'mac' : (/Windows/.test(navigator.userAgent) ? 'windows' : 'other')));
  try {
    const r = await H.send({ op: 'feedback', gid: c.gid, mode: c.mode, level: c.level, medal: c.medal, total: c.total, month: c.month, team: c.team, room: c.room,
      fun: ST.fun || '', learn: ST.learn || '', good: ST.good.trim().slice(0, 600), bad: ST.bad.trim().slice(0, 600), email, hp, lang: H.lang(), version: H.version, ua, width: root.innerWidth || 0 });
    markDone(c.gid); ST.good = ''; ST.bad = ''; ST.fun = 0; ST.learn = 0; ST.msg = ''; ST.email = '';
    H.toast(t(r && r.queued ? 'fb.queued' : 'fb.thanks'));
  } catch (e) { ST.msg = t('fb.fail'); }
  ST.busy = false;
  const box = document.querySelector('.fb[data-fbgid], .fb.done'); if (box) rerender(box);
}
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-fbstar]'); if (s) { ST[s.dataset.fbstar] = +s.dataset.n; ST.miss = ST.miss.filter((k) => k !== s.dataset.fbstar); if (!ST.miss.length && ST.msg === t('fb.need')) ST.msg = ''; rerender(s); return; }
  const b = e.target.closest('[data-fb]'); if (!b) return;
  if (b.dataset.fb === 'send') { e.preventDefault(); send(b); }
  else if (b.dataset.fb === 'later') { e.preventDefault(); const gid = (CUR && CUR.gid) || 'general'; ST.hidden[gid] = true; if (!b.closest('dialog')) rerender(b); }
});
document.addEventListener('input', (e) => { const el = e.target; if (el.dataset && el.dataset.fbk && el.dataset.fbk !== 'hp') { ST[el.dataset.fbk] = el.value; if (el.dataset.fbk === 'email' && ST.badEmail) { ST.badEmail = false; el.classList.remove('bad'); el.removeAttribute('aria-invalid'); } } });
root.IMPAKFeedback = { init(h) { H = Object.assign(H, h); }, card, open, configured, context };
})(typeof window !== 'undefined' ? window : globalThis);
