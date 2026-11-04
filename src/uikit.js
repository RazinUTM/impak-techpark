/* SPDX-License-Identifier: MIT
   Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia */
/* ================================================================== */
/*  UIKit — the module-independent part of the Cable Lab apps:       */
/*  preferences, i18n, formatting, plots, narrator/avatar, engine     */
/*  host, field table, viewport interaction, checklist, predictions,  */
/*  pins, transport, files. No physics, no module-specific keys.      */
/* ================================================================== */
(function (root) {
'use strict';
const $ = (sel, r) => (r || document).querySelector(sel);
const $$ = (sel, r) => Array.from((r || document).querySelectorAll(sel));
const DEG = 180 / Math.PI;
const cfg = { t: (k) => k, prefs: { lang: 'ms', theme: 'light', font: 1 } };
function configure(o) { Object.assign(cfg, o); }

/* ----------------------------------------------------- stores & prefs */
function createStore(key, defaults) {
  const obj = Object.assign({}, defaults);
  try { Object.assign(obj, JSON.parse(localStorage.getItem(key) || '{}')); } catch (e) { /* storage unavailable */ }
  Object.defineProperty(obj, 'save', { value: () => { try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { /* ignore */ } }, enumerable: false });
  return obj;
}
function createPrefs(key) {
  const prefs = createStore(key, { lang: 'ms', theme: 'light', font: 1 });
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { /* ignore */ }
  if (!saved.theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) prefs.theme = 'dark';
  return prefs;
}
function applyPrefsUI(prefs, t) {
  document.documentElement.dataset.theme = prefs.theme;
  document.documentElement.lang = prefs.lang === 'ms' ? 'ms' : 'en';
  document.documentElement.style.setProperty('--font-scale', String(prefs.font));
  const sun = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>';
  const moon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';
  const tb = $('#btn-theme'); if (tb) { tb.innerHTML = prefs.theme === 'dark' ? sun : moon; tb.title = prefs.theme === 'dark' ? t('pref.theme.light') : t('pref.theme.dark'); tb.setAttribute('aria-label', tb.title); }
  const lb = $('#btn-lang'); if (lb) lb.textContent = prefs.lang === 'ms' ? 'EN' : 'BM';
}
/* Wire the three preference buttons (theme, language, font size); callbacks run after the change. */
function setupPrefButtons(prefs, t, { onTheme, onLang, onFont }) {
  $('#btn-theme').addEventListener('click', () => { prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark'; prefs.save(); applyPrefsUI(prefs, t); if (onTheme) onTheme(); });
  $('#btn-lang').addEventListener('click', () => { prefs.lang = prefs.lang === 'ms' ? 'en' : 'ms'; prefs.save(); if (onLang) onLang(); });
  $('#btn-font-up').addEventListener('click', () => { prefs.font = Math.min(1.3, +(prefs.font + 0.1).toFixed(2)); prefs.save(); applyPrefsUI(prefs, t); if (onFont) onFont(); });
  $('#btn-font-down').addEventListener('click', () => { prefs.font = Math.max(0.85, +(prefs.font - 0.1).toFixed(2)); prefs.save(); applyPrefsUI(prefs, t); if (onFont) onFont(); });
}

/* ------------------------------------------------------------- i18n */
function makeT(dicts, getLang) {
  return function t(key, params) {
    const dict = dicts[getLang()] || dicts.en;
    let s = dict[key] !== undefined ? dict[key] : (dicts.en[key] !== undefined ? dicts.en[key] : key);
    if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k]);
    return s;
  };
}
function applyStaticText(t) {
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
}

/* ------------------------------------------------------- formatting */
function fmtNum(v, sig) {
  sig = sig || 3;
  if (v === null || v === undefined || !isFinite(v)) return '–';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-3) return v.toExponential(sig - 1).replace('e+', 'e');
  return String(Number(v.toPrecision(sig)));
}
function fmtSI(v, unit, sig) {
  if (!isFinite(v)) return '–';
  const a = Math.abs(v);
  const pre = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ']];
  for (const [f, p] of pre) if (a >= f || f === 1e-6) return fmtNum(v / f, sig) + ' ' + p + unit;
  return fmtNum(v, sig) + ' ' + unit;
}
const fmtDeg = (r) => (isFinite(r) ? (r * DEG).toFixed(2) + '°' : '–');
const fmtS = (v) => (isFinite(v) ? (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + ' s' : '–');
const fmtPctRel = (v) => (isFinite(v) ? (Math.abs(v) * 100).toPrecision(2) + ' %' : '–');
const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
function fmtPow10(k) { if (Math.abs(k - Math.round(k)) < 1e-9) return '10' + String(Math.round(k)).split('').map((c) => SUP[c] || c).join(''); return fmtNum(Math.pow(10, k), 2); }
function niceStep(raw) { if (!(raw > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(raw))); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function interp(xs, ys, x) { const n = xs.length; if (!n) return NaN; if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1]; let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; } const f = (x - xs[lo]) / (xs[hi] - xs[lo] || 1); return ys[lo] + f * (ys[hi] - ys[lo]); }
function escapeHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function lerpColor(a, b, u) { const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16)); return 'rgb(' + pa.map((v, i) => Math.round(v + (pb[i] - v) * u)).join(',') + ')'; }
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function getPath(o, path) { return path.split('.').reduce((a, k) => (a ? a[k] : undefined), o); }
function setPath(o, path, v) { const p = path.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) { if (x[p[i]] === undefined) x[p[i]] = {}; x = x[p[i]]; } x[p[p.length - 1]] = v; }
function mergeInto(a, b) { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) { a[k] = a[k] || {}; mergeInto(a[k], b[k]); } else a[k] = b[k]; } return a; }
function stamp(prefix) { return prefix + '_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); }

/* ------------------------------------------------------------ files */
function toast(msg) { const el = $('#toast'); if (!el) return; el.textContent = msg; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2600); }
async function saveFile(name, data) {
  const t = cfg.t;
  if (window.claude && typeof window.claude.use === 'function') {
    try {
      const dl = await window.claude.use('downloads');
      if (dl) { try { await dl.save({ filename: name, data }); toast(t('toast.saved', { name })); } catch (e) { toast(e && e.code === 'declined' ? t('toast.declined') : t('toast.failed')); } return; }
    } catch (e) { /* fall through */ }
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); toast(t('toast.saved', { name }));
  } catch (e) { toast(t('toast.failed')); }
}
async function copyText(text) {
  const t = cfg.t;
  try { await navigator.clipboard.writeText(text); toast(t('toast.copied')); }
  catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(t('toast.copied')); } catch (e2) { toast(t('toast.failed')); } ta.remove(); }
}

/* ------------------------------------------------------------- math */
const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', theta: 'θ', rho: 'ρ', mu: 'μ', pi: 'π', tau: 'τ', zeta: 'ζ', ell: 'ℓ', kappa: 'κ', varphi: 'φ', phi: 'φ', partial: '∂', infty: '∞', approx: '≈', le: '≤', ge: '≥', cdot: '·', times: '×', qquad: ' ', quad: ' ' };
function texToHtml(tex) {
  let x = tex;
  x = x.replace(/\\tfrac12|\\frac12/g, '½');
  x = x.replace(/\\(?:mathrm|text|operatorname|mathbf)\{([^{}]*)\}/g, '$1');
  x = x.replace(/\\(?:left|right|bigl|bigr|Bigl|Bigr)/g, '').replace(/\\[,;!]/g, '').replace(/\\ /g, ' ');
  x = x.replace(/\^\{([^{}]*)\}/g, '<sup>$1</sup>').replace(/_\{([^{}]*)\}/g, '<sub>$1</sub>');
  x = x.replace(/\^(\S)/g, '<sup>$1</sup>').replace(/_(\S)/g, '<sub>$1</sub>');
  for (let k = 0; k < 4; k++) x = x.replace(/\\[td]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '<span class="fr"><span>$1</span><span>$2</span></span>');
  x = x.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  x = x.replace(/\\(sin|cos|tan|cosh|sinh|ln|log|exp)\b/g, '$1 ');
  x = x.replace(/\\([A-Za-z]+)/g, (m, n) => (GREEK[n] !== undefined ? GREEK[n] : n));
  x = x.replace(/[{}]/g, '');
  return '<span class="mth">' + x + '</span>';
}
function typeset(el) {
  if (!el) return;
  if (typeof window.renderMathInElement === 'function') {
    try { window.renderMathInElement(el, { delimiters: [{ left: '\\(', right: '\\)', display: false }, { left: '\\[', right: '\\]', display: true }], throwOnError: false }); return; } catch (e) { /* fall back */ }
  }
  el.innerHTML = el.innerHTML.replace(/\\\[([\s\S]*?)\\\]/g, (m, tx) => '<div class="mth-d">' + texToHtml(tx) + '</div>').replace(/\\\(([\s\S]*?)\\\)/g, (m, tx) => texToHtml(tx));
}

/* ------------------------------------------------------------ plots */
class MiniPlot {
  constructor(canvas) { this.c = canvas; this.spec = null; this.hover = null;
    canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); this.hover = { x: e.clientX - r.left, y: e.clientY - r.top }; this.render(); });
    canvas.addEventListener('mouseleave', () => { this.hover = null; this.render(); }); }
  draw(spec) { this.spec = spec; this.render(); }
  render() {
    const c = this.c, dpr = window.devicePixelRatio || 1, r = c.getBoundingClientRect();
    const W = Math.max(10, r.width), H = Math.max(10, r.height);
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const sp = this.spec; const font = cssVar('--font'); const t = cfg.t;
    ctx.font = '11px ' + font;
    const m = { l: 52, r: 14, t: 10, b: 30 };
    const TX = sp && sp.xlog ? ((v) => (v > 0 ? Math.log10(v) : NaN)) : ((v) => v), TY = sp && sp.ylog ? ((v) => (v > 0 ? Math.log10(v) : NaN)) : ((v) => v);
    const fmtX = (v) => (sp && sp.xlog ? fmtPow10(v) : fmtNum(v, 3)), fmtY = (v) => (sp && sp.ylog ? fmtPow10(v) : fmtNum(v, 3));
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    if (sp && sp.series.length) sp.series.forEach((s) => { for (let i = 0; i < s.x.length; i++) { const x = TX(s.x[i]), y = TY(s.y[i]); if (!isFinite(x) || !isFinite(y)) continue; if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y; } });
    if (!isFinite(xmin) || !isFinite(ymin)) { ctx.fillStyle = cssVar('--muted'); ctx.textAlign = 'center'; ctx.fillText(t('plot.empty'), W / 2, H / 2); ctx.textAlign = 'left'; return; }
    (sp.hlines || []).forEach((h) => { if (h.includeInRange) { const hy = TY(h.y); if (hy < ymin) ymin = hy; if (hy > ymax) ymax = hy; } });
    (sp.vlines || []).forEach((h) => { if (h.includeInRange) { const hx = TX(h.x); if (hx < xmin) xmin = hx; if (hx > xmax) xmax = hx; } });
    if (sp.xlim) { xmin = TX(sp.xlim[0]); xmax = TX(sp.xlim[1]); }
    if (sp.ylim) { ymin = TY(sp.ylim[0]); ymax = TY(sp.ylim[1]); }
    if (!(xmax > xmin)) { xmax = xmin + 1; }
    if (!(ymax > ymin)) { ymax = ymin + 1; ymin -= 1; }
    if (sp.yZero && !sp.ylog && ymin > 0) ymin = 0;
    const yr = ymax - ymin; ymin -= 0.06 * yr; ymax += 0.06 * yr;
    if (sp.xlog) { const xr = xmax - xmin; xmin -= 0.04 * xr; xmax += 0.04 * xr; }
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const X = (x) => m.l + (x - xmin) / (xmax - xmin) * pw, Y = (y) => m.t + (ymax - y) / (ymax - ymin) * ph;
    const xs = sp.xlog && xmax - xmin > 1.2 ? Math.max(1, Math.round((xmax - xmin) / 6)) : niceStep((xmax - xmin) / 6);
    const ys = sp.ylog && ymax - ymin > 1.2 ? Math.max(1, Math.round((ymax - ymin) / 5)) : niceStep((ymax - ymin) / 5);
    ctx.strokeStyle = cssVar('--grid'); ctx.lineWidth = 1; ctx.fillStyle = cssVar('--muted');
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let y = Math.ceil(ymin / ys) * ys, g = 0; y <= ymax && g < 50; y += ys, g++) { const py = Y(y); ctx.beginPath(); ctx.moveTo(m.l, py); ctx.lineTo(W - m.r, py); ctx.stroke(); ctx.fillText(fmtY(y), m.l - 6, py); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let x = Math.ceil(xmin / xs) * xs, g = 0; x <= xmax + 1e-9 && g < 50; x += xs, g++) { const px = X(x); ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, H - m.b); ctx.stroke(); ctx.fillText(fmtX(x), px, H - m.b + 5); }
    ctx.strokeStyle = cssVar('--axis'); ctx.beginPath(); ctx.moveTo(m.l, m.t); ctx.lineTo(m.l, H - m.b); ctx.lineTo(W - m.r, H - m.b); ctx.stroke();
    ctx.fillStyle = cssVar('--ink2'); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (sp.xLabel) ctx.fillText(sp.xLabel, m.l + pw / 2, H - 6);
    if (sp.yLabel) { ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(sp.yLabel, 0, 0); ctx.restore(); }
    ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();
    (sp.hlines || []).forEach((h) => { ctx.strokeStyle = h.color; ctx.setLineDash(h.dash || [4, 4]); ctx.lineWidth = 1.2; const py = Y(TY(h.y)); ctx.beginPath(); ctx.moveTo(m.l, py); ctx.lineTo(W - m.r, py); ctx.stroke(); ctx.setLineDash([]); if (h.label) { ctx.fillStyle = h.color; ctx.textAlign = 'right'; ctx.fillText(h.label, W - m.r - 4, py - 4); } });
    (sp.vlines || []).forEach((h) => { ctx.strokeStyle = h.color; ctx.setLineDash(h.dash || [4, 4]); ctx.lineWidth = 1.2; const px = X(TX(h.x)); ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, H - m.b); ctx.stroke(); ctx.setLineDash([]); if (h.label) { ctx.fillStyle = h.color; ctx.textAlign = 'left'; ctx.fillText(h.label, px + 4, m.t + 12); } });
    sp.series.forEach((s) => {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.setLineDash(s.dash || []); ctx.beginPath();
      let started = false;
      for (let i = 0; i < s.x.length; i++) { const x = TX(s.x[i]), y = TY(s.y[i]); if (!isFinite(x) || !isFinite(y)) { started = false; continue; } const px = X(x), py = Y(y); if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py); }
      ctx.stroke(); ctx.setLineDash([]);
      if (s.markers && s.x.length <= 80) { ctx.fillStyle = s.color; for (let i = 0; i < s.x.length; i++) { const x = TX(s.x[i]), y = TY(s.y[i]); if (!isFinite(x) || !isFinite(y)) continue; ctx.beginPath(); ctx.arc(X(x), Y(y), s.markerSize || 2.5, 0, 2 * Math.PI); ctx.fill(); } }
    });
    ctx.restore();
    if (sp.series.length >= 2) {
      let lx = W - m.r - 8, ly = m.t + 10; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      sp.series.slice().reverse().forEach((s) => {
        const tw = ctx.measureText(s.label).width;
        if (lx - tw - 30 < m.l && lx < W - m.r - 8) { lx = W - m.r - 8; ly += 15; }
        ctx.fillStyle = cssVar('--ink2'); ctx.fillText(s.label, lx, ly);
        ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.setLineDash(s.dash || []); ctx.beginPath(); ctx.moveTo(lx - tw - 24, ly); ctx.lineTo(lx - tw - 6, ly); ctx.stroke(); ctx.setLineDash([]); lx -= tw + 36;
      });
    }
    if (this.hover && this.hover.x >= m.l && this.hover.x <= W - m.r) {
      const xvl = xmin + (this.hover.x - m.l) / pw * (xmax - xmin);
      const xv = sp.xlog ? Math.pow(10, xvl) : xvl;
      ctx.strokeStyle = cssVar('--axis'); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(this.hover.x, m.t); ctx.lineTo(this.hover.x, H - m.b); ctx.stroke(); ctx.setLineDash([]);
      const lines = [fmtNum(xv, 4)];
      sp.series.forEach((s) => { let yv; if (sp.xlog || sp.ylog) { const yl = interp(Array.from(s.x, TX), Array.from(s.y, TY), xvl); yv = sp.ylog ? Math.pow(10, yl) : yl; } else yv = interp(s.x, s.y, xv); if (isFinite(yv)) lines.push(s.label + ': ' + fmtNum(yv, 4)); });
      ctx.font = '11px ' + font; const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 12, th = lines.length * 14 + 8;
      let bx = this.hover.x + 10; if (bx + tw > W - 4) bx = this.hover.x - tw - 10; const by = m.t + 4;
      ctx.fillStyle = cssVar('--panel'); ctx.strokeStyle = cssVar('--line'); ctx.fillRect(bx, by, tw, th); ctx.strokeRect(bx + 0.5, by + 0.5, tw - 1, th - 1);
      ctx.fillStyle = cssVar('--ink'); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      lines.forEach((l, i) => ctx.fillText(l, bx + 6, by + 5 + 14 * i));
    }
  }
}

/* --------------------------------------------------- narrator/avatar */
function createNarrator({ poses, altPose, avatars, bubble, avatarImg, logEl, logTitleKey, maxLog, onWatch }) {
  const t = () => cfg.t;
  let currentPose = '';
  const log = [];
  const poseFor = (key) => { for (const [re, pose] of poses) if (re.test(key)) return pose; return 'neutral'; };
  function renderLog() { const el = $(logEl); if (el) el.innerHTML = log.length ? '<h3>' + t()(logTitleKey) + '</h3>' + log.map((l) => '<p>' + escapeHtml(l) + '</p>').join('') : ''; }
  function setPose(pose, allowSame) {
    const img = $(avatarImg); if (!img) return;
    if (pose === currentPose && !allowSame) pose = altPose[pose] || 'neutral';
    const src = avatars[pose] || avatars.neutral; if (!src) return;
    if (pose === currentPose) return;
    currentPose = pose;
    img.classList.add('swap');
    setTimeout(() => { img.src = src; img.classList.remove('swap'); }, 110);
  }
  const narrator = {
    last: {}, log, setPose, renderLog,
    say(key, params, force) {
      const now = performance.now();
      if (!force && this.last[key] && now - this.last[key] < 20000) return;
      this.last[key] = now;
      const text = t()(key, params || {});
      const b = $(bubble); const prev = b.textContent;
      if (prev && prev !== text) { log.unshift(prev); if (log.length > maxLog) log.length = maxLog; renderLog(); }
      b.textContent = text;
      setPose(poseFor(key));
    },
    note(key, params) { log.unshift(t()(key, params || {})); if (log.length > maxLog) log.length = maxLog; renderLog(); },
    clear() { log.length = 0; renderLog(); },
    watch(st) { if (onWatch) onWatch(st, this); },
  };
  return narrator;
}

/* ------------------------------------------------------- engine host */
/* A Worker built from the physics source embedded in the page (CSP-safe blob), with an inline fallback
   and a watchdog that switches to inline when the worker never answers. */
function createHost({ coreSrc, engineMain, engineGlobal, onMessage, onSwitched }) {
  const host = { kind: '', post: null, worker: null, states: 0, watchdog: null };
  const wrap = (m) => { if (m && m.type === 'state') host.states++; onMessage(m); };
  function inline() {
    const handle = engineMain(wrap);
    host.kind = 'inline'; host.worker = null; host.post = (m) => handle(m);
  }
  function worker() {
    try {
      const glue = '\nconst __handle = ' + (engineGlobal || 'CableCore') + '.engineMain(function (m) { self.postMessage(m); });\nself.onmessage = function (e) { __handle(e.data); };\n';
      const blob = new Blob([coreSrc, glue], { type: 'application/javascript' });
      const w = new Worker(URL.createObjectURL(blob));
      w.onmessage = (e) => wrap(e.data);
      w.onerror = () => { if (host.kind === 'worker') { try { w.terminate(); } catch (e) { /* ignore */ } inline(); if (onSwitched) onSwitched(); } };
      host.kind = 'worker'; host.worker = w; host.post = (m) => w.postMessage(m);
    } catch (e) { inline(); }
  }
  host.arm = function (ms) {                // call right after an init message
    if (host.kind !== 'worker') return;
    clearTimeout(host.watchdog);
    const count = host.states;
    host.watchdog = setTimeout(() => { if (host.states === count && host.kind === 'worker') { try { host.worker.terminate(); } catch (e) { /* ignore */ } inline(); if (onSwitched) onSwitched(); } }, ms || 2500);
  };
  worker();
  return host;
}

/* ------------------------------------------------------- field table */
function makeGroup(key, title, status, openState, extraClass) {
  const det = document.createElement('details'); det.className = 'group g-' + key + (extraClass ? ' ' + extraClass : ''); det.dataset.group = key;
  det.open = !!openState[key];
  const sum = document.createElement('summary');
  const h = document.createElement('h2'); h.textContent = title; sum.appendChild(h);
  if (status) { const st = document.createElement('span'); st.className = 'status'; st.textContent = status; sum.appendChild(st); }
  det.appendChild(sum);
  const body = document.createElement('div'); body.className = 'body'; det.appendChild(body);
  det.addEventListener('toggle', () => { openState[key] = det.open; openState.save(); });
  return { det, body };
}
function sameValue(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b));
  if ((a && typeof a === 'object') || (b && typeof b === 'object')) return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}
function cloneValue(v) { return v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v; }
const ICON_RESET = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.2 3.8v4.6h4.6"/></svg>';
/* f: { path, type: select|checkbox|range|number|text|<custom>, options, optKey, lo, hi, step, live, help, validate, wide }
   custom types are handled by parsers[type] = { toText(value), parse(text) }.
   opts.defaults: scenario holding the stage defaults -> a reset button (↺) appears when the value differs;
   opts.rerender: called after a reset; opts.laterStage: stage number when the field belongs to a later stage. */
function renderField(f, scenario, onChange, { t, parsers, resetHint, defaults, rerender, laterStage }) {
  const later = laterStage !== undefined && laterStage !== null;
  const wrap = document.createElement('div'); wrap.className = 'field' + (f.live === false ? ' structural' : '') + (later ? ' later' : '');
  wrap.dataset.path = f.path;
  const id = 'f-' + f.path.replace(/\./g, '-');
  const head = document.createElement('div'); head.className = 'fhead';
  const label = document.createElement('label'); label.htmlFor = id; label.textContent = t('f.' + f.path);
  head.appendChild(label);
  if (later) { const g = document.createElement('span'); g.className = 'tag later'; g.textContent = t('controls.stageTag', { n: laterStage }); g.title = t('controls.stageTag.tip', { n: laterStage }); head.appendChild(g); }
  if (f.live === false) { const g = document.createElement('span'); g.className = 'tag restart'; g.textContent = t('controls.restartTag'); g.title = resetHint || ''; head.appendChild(g); }
  const val = getPath(scenario, f.path);
  const P = parsers && parsers[f.type];
  /* reset button, kept in step with the value (live fields are not re-rendered after a change) */
  let rb = null;
  function syncReset() {
    if (!defaults) return;
    const def = getPath(defaults, f.path), need = def !== undefined && !sameValue(getPath(scenario, f.path), def);
    if (need && !rb) {
      const shown = f.type === 'select' ? t(f.optKey(def)) : f.type === 'checkbox' ? (def ? '✓' : '✗') : P ? (P.toText(def) || '–') : (typeof def === 'number' ? fmtNum(def, 4) : String(def));
      rb = document.createElement('button'); rb.type = 'button'; rb.className = 'freset'; rb.innerHTML = ICON_RESET;
      rb.title = t('controls.resetField', { v: shown }); rb.setAttribute('aria-label', rb.title);
      rb.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onChange(f, cloneValue(def)); if (rerender) rerender(); else syncReset(); });
      head.appendChild(rb);
    } else if (!need && rb) { rb.remove(); rb = null; }
  }
  const change = (v) => { onChange(f, v); syncReset(); };
  syncReset();
  let input;
  if (f.type === 'select') {
    input = document.createElement('select'); input.id = id;
    f.options.forEach((o) => { const op = document.createElement('option'); op.value = o; op.textContent = t(f.optKey(o)); if (o === val) op.selected = true; input.appendChild(op); });
    input.addEventListener('change', () => change(input.value));
    wrap.appendChild(head); wrap.appendChild(input);
  } else if (f.type === 'checkbox') {
    input = document.createElement('input'); input.type = 'checkbox'; input.id = id; input.checked = !!val;
    input.addEventListener('change', () => change(input.checked));
    wrap.className += ' check'; wrap.appendChild(input); wrap.appendChild(head);
  } else if (f.type === 'range') {
    const hi = f.wide ? f.wide(scenario) : f.hi;
    input = document.createElement('input'); input.type = 'range'; input.id = id; input.min = f.lo; input.max = Math.max(hi, val); input.step = f.step; input.value = val;
    const num = document.createElement('input'); num.type = 'number'; num.min = f.lo; num.step = f.step; num.value = val; num.className = 'num'; num.setAttribute('aria-label', t('f.' + f.path));
    input.addEventListener('input', () => { num.value = input.value; });
    input.addEventListener('change', () => change(parseFloat(input.value)));
    num.addEventListener('change', () => { const v = parseFloat(num.value); if (isFinite(v)) { input.value = v; change(v); } });
    const row = document.createElement('div'); row.className = 'rangerow'; row.appendChild(input); row.appendChild(num);
    wrap.appendChild(head); wrap.appendChild(row);
  } else if (f.type === 'text' || P) {
    input = document.createElement('input'); input.type = 'text'; input.id = id; input.spellcheck = false; input.className = 'mono';
    input.value = P ? P.toText(val) : (val || '');
    const err = document.createElement('div'); err.className = 'fielderr';
    const commit = () => {
      if (P) { const parsed = P.parse(input.value); input.value = P.toText(parsed); change(parsed); return; }
      const v = input.value.trim();
      const e = f.validate ? f.validate(v) : null;
      err.textContent = e ? t(f.badKey || 'f.flow.expr.bad', { err: e }) : '';
      change(v);
    };
    input.addEventListener('change', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    if (f.validate) { const e0 = f.validate(val || ''); if (e0) err.textContent = t(f.badKey || 'f.flow.expr.bad', { err: e0 }); }
    wrap.appendChild(head); wrap.appendChild(input); wrap.appendChild(err);
  } else {
    input = document.createElement('input'); input.type = 'number'; input.id = id; input.min = f.lo; input.max = f.hi; input.step = f.step; input.value = val;
    input.addEventListener('change', () => { let v = parseFloat(input.value); if (!isFinite(v)) { input.value = getPath(scenario, f.path); return; } v = Math.min(Math.max(v, f.lo), f.hi); input.value = v; change(v); });
    wrap.appendChild(head); wrap.appendChild(input);
  }
  if (f.help) { const h = document.createElement('div'); h.className = 'help'; h.textContent = t(f.help); wrap.appendChild(h); }
  return wrap;
}

/* Controls toolbar: expand/collapse all groups, show controls of later stages, reset all to the stage defaults,
   and a one-line legend for the tags used in the field labels. */
const ICON_EXPAND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9l5 5 5-5"/><path d="M4 4h16M4 20h16"/></svg>';
const ICON_COLLAPSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14l5-5 5 5"/><path d="M4 4h16M4 20h16"/></svg>';
function panelHead(t, key, cls) { const h = document.createElement('div'); h.className = 'panelhead ' + (cls || ''); h.innerHTML = '<span class="pdot"></span><span>' + escapeHtml(t(key)) + '</span>'; return h; }
function controlsToolbar({ t, openState, groupKeys, showAll, onShowAll, onResetAll, rerender, showAllAvailable }) {
  const bar = document.createElement('div'); bar.className = 'ctrlbar';
  const allOpen = groupKeys.length > 0 && groupKeys.every((k) => !!openState[k]);
  const row = document.createElement('div'); row.className = 'crow';
  const bx = document.createElement('button'); bx.type = 'button'; bx.className = 'cbtn'; bx.id = 'btn-expand';
  bx.innerHTML = (allOpen ? ICON_COLLAPSE : ICON_EXPAND) + '<span>' + escapeHtml(t(allOpen ? 'controls.collapseAll' : 'controls.expandAll')) + '</span>';
  bx.setAttribute('aria-pressed', allOpen ? 'true' : 'false');
  bx.addEventListener('click', () => { groupKeys.forEach((k) => { openState[k] = !allOpen; }); openState.save(); rerender(); });
  const br = document.createElement('button'); br.type = 'button'; br.className = 'cbtn'; br.id = 'btn-resetall'; br.title = t('controls.resetAll.tip');
  br.innerHTML = ICON_RESET + '<span>' + escapeHtml(t('controls.resetAll')) + '</span>';
  br.addEventListener('click', () => onResetAll());
  row.appendChild(bx); row.appendChild(br); bar.appendChild(row);
  const avail = showAllAvailable !== false || showAll;
  const sa = document.createElement('label'); sa.className = 'cchk' + (avail ? '' : ' off'); sa.title = t(avail ? 'controls.showAll.tip' : 'controls.showAll.none');
  sa.innerHTML = '<input type="checkbox" id="chk-showall"' + (showAll ? ' checked' : '') + (avail ? '' : ' disabled') + '> <span>' + escapeHtml(t('controls.showAll')) + '</span>' + (avail ? '' : '<span class="cnote">' + escapeHtml(t('controls.showAll.none')) + '</span>');
  sa.querySelector('input').addEventListener('change', (e) => onShowAll(e.target.checked));
  bar.appendChild(sa);
  const lg = document.createElement('div'); lg.className = 'clegend';
  lg.innerHTML = '<span class="tag restart">' + escapeHtml(t('controls.restartTag')) + '</span> ' + escapeHtml(t('controls.legend.restart')) + ' · <span class="freset static">' + ICON_RESET + '</span> ' + escapeHtml(t('controls.legend.reset'));
  bar.appendChild(lg);
  return bar;
}

/* --------------------------------------------- viewport interaction */
/* VP: { box, manual, scale, cx, cz, W, H, X, Z, hoverNode, drag }. nodes(): {x, z} arrays of the current state. */
function setupViewportInteraction(canvasSel, tooltipSel, autofitSel, VP, { nodes, tooltipText, markDirty, onHover }) {
  const c = $(canvasSel), tip = $(tooltipSel), autofit = $(autofitSel);
  const screenToWorld = (mx, my) => ({ x: VP.cx + (mx - VP.W / 2) / VP.scale, z: VP.cz - (my - (VP.cy !== undefined ? VP.cy : VP.H / 2)) / VP.scale });   // cy: pixel row of cz (below the legend)
  const currentBox = () => { const B = VP.manual || VP.box; return B ? { xmin: B.xmin, xmax: B.xmax, zmin: B.zmin, zmax: B.zmax } : null; };
  c.addEventListener('wheel', (e) => {
    if (!VP.scale) return; e.preventDefault();
    const r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const w = screenToWorld(mx, my), f = Math.pow(1.0015, e.deltaY);
    const B = currentBox(); if (!B) return;
    VP.manual = { xmin: w.x + (B.xmin - w.x) * f, xmax: w.x + (B.xmax - w.x) * f, zmin: w.z + (B.zmin - w.z) * f, zmax: w.z + (B.zmax - w.z) * f };
    markDirty(); if (autofit) autofit.hidden = false;
  }, { passive: false });
  c.addEventListener('mousedown', (e) => { if (e.button !== 0) return; VP.drag = { mx: e.clientX, my: e.clientY, box: currentBox(), moved: false }; });
  window.addEventListener('mouseup', () => { VP.drag = null; });
  c.addEventListener('dblclick', () => { VP.manual = null; markDirty(); if (autofit) autofit.hidden = true; });
  if (autofit) autofit.addEventListener('click', () => { VP.manual = null; markDirty(); autofit.hidden = true; });
  c.addEventListener('mousemove', (e) => {
    const nd = nodes(); if (!nd || !VP.X) return;
    const r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (VP.drag && VP.drag.box && (e.buttons & 1)) {
      const dx = (e.clientX - VP.drag.mx) / VP.scale, dz = -(e.clientY - VP.drag.my) / VP.scale;
      if (Math.abs(e.clientX - VP.drag.mx) + Math.abs(e.clientY - VP.drag.my) > 3) VP.drag.moved = true;
      const B = VP.drag.box; VP.manual = { xmin: B.xmin - dx, xmax: B.xmax - dx, zmin: B.zmin - dz, zmax: B.zmax - dz }; markDirty(); if (autofit) autofit.hidden = false; tip.classList.remove('show'); return;
    }
    let best = -1, bd = 14 * 14;
    for (let i = 0; i < nd.x.length; i++) { const dx = VP.X(nd.x[i]) - mx, dz = VP.Z(nd.z[i]) - my, d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = i; } }
    VP.hoverNode = best; markDirty(); if (onHover) onHover(best);
    if (best >= 0) { tip.textContent = tooltipText(best); tip.style.left = (mx + 14) + 'px'; tip.style.top = (my + 10) + 'px'; tip.classList.add('show'); }
    else tip.classList.remove('show');
  });
  c.addEventListener('mouseleave', () => { VP.hoverNode = -1; tip.classList.remove('show'); markDirty(); });
  return { screenToWorld, currentBox };
}
function viewportCanvas(sel) { const c = $(sel); const dpr = window.devicePixelRatio || 1; const r = c.getBoundingClientRect(); const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr)); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } return { c, ctx: c.getContext('2d'), W: r.width, H: r.height, dpr }; }

/* ------------------------------------------------- tension colours */
/* Safety scale: u = T / T_allow (allowable tension). Green = well below, amber from SAFETY_WARN, red at and above 1. */
const SAFETY_WARN = 0.6;
const SAFETY_STOPS = {
  light: [[0, '#1e9e4f'], [0.45, '#7dbb1c'], [0.6, '#e2b300'], [0.8, '#f0801f'], [1.0, '#d32f2f'], [1.3, '#8a1212']],
  dark: [[0, '#38c972'], [0.45, '#a3d63c'], [0.6, '#f3c623'], [0.8, '#f7934a'], [1.0, '#ff5b5b'], [1.3, '#c62f2f']],
};
function rampColour(stops, u) {
  if (!(u > stops[0][0])) return stops[0][1];
  for (let k = 1; k < stops.length; k++) if (u <= stops[k][0]) { const a = stops[k - 1], b = stops[k]; return lerpColor(a[1], b[1], (u - a[0]) / (b[0] - a[0])); }
  return stops[stops.length - 1][1];
}
function safetyColour(u, dark) { return rampColour(dark ? SAFETY_STOPS.dark : SAFETY_STOPS.light, u); }
function relativeColour(u, dark) { return dark ? lerpColor('#2a5a8f', '#cde2fb', u) : lerpColor('#b7d3f6', '#0d366b', u); }
function safetyClass(u) { return u >= 1 ? 'crit' : u >= SAFETY_WARN ? 'warn' : 'ok'; }
/* Overlay layout on the viewport canvas. Boxes are { x0, y0, x1, y1 } in CSS pixels. */
function boxesOverlap(a, b) { return !(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1); }
function textBox(ctx, text, x, y, align, size) { const w = ctx.measureText(text).width, s = size || 11; const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x; return { x0: x0 - 2, x1: x0 + w + 2, y0: y - s, y1: y + 0.3 * s }; }
/* Bottom of the HTML legend that floats over the top of the viewport (canvas coordinates). */
function legendBottom(sel) { const lg = $(sel || '.viewport-wrap .legend'); return lg && lg.offsetParent ? lg.offsetTop + lg.offsetHeight : 0; }
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
/* Scale bar in the bottom-right corner. scaleBarGeom gives its place (box) before anything is drawn, so that
   labels can keep clear of it; drawScaleBar draws it and returns the same box. */
function scaleBarGeom({ W, H, worldWidth, scale }) {
  const len = niceStep(worldWidth * 0.2), px = len * scale, x0 = W - 20 - px, y0 = H - 18, lw = 7 * (fmtNum(len, 3).length + 2);
  return { len, px, x0, y0, box: { x0: Math.min(x0 - 4, x0 + px / 2 - lw / 2 - 2), x1: Math.max(x0 + px + 4, x0 + px / 2 + lw / 2 + 2), y0: y0 - 18, y1: y0 + 5 } };
}
function drawScaleBar(ctx, opts) {
  const g = scaleBarGeom(opts), { x0, y0, px } = g;
  ctx.save();
  ctx.strokeStyle = cssVar('--ink2'); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + px, y0); ctx.moveTo(x0, y0 - 4); ctx.lineTo(x0, y0 + 4); ctx.moveTo(x0 + px, y0 - 4); ctx.lineTo(x0 + px, y0 + 4); ctx.stroke();
  ctx.fillStyle = cssVar('--ink2'); ctx.font = '11px ' + cssVar('--font'); ctx.textAlign = 'center';
  ctx.fillText(fmtNum(g.len, 3) + ' m', x0 + px / 2, y0 - 7);
  ctx.restore();
  return g.box;
}
/* Box of an HTML overlay inside the viewport wrapper, in canvas coordinates (null when hidden). */
function domBox(sel, pad) { const e = $(sel); if (!e || !e.offsetParent) return null; const p = pad || 0; return { x0: e.offsetLeft - p, y0: e.offsetTop - p, x1: e.offsetLeft + e.offsetWidth + p, y1: e.offsetTop + e.offsetHeight + p }; }
/* Draw a canvas label at the first candidate position { x, y, align } that hits neither a hard box (other text,
   HTML overlays) nor a soft box (the cable); failing that, the first that hits no hard box; failing that, the
   first candidate, or nothing at all when optional (labels that repeat what the controls already show).
   Returns the label's box, or null when nothing was drawn. */
function placeLabel(ctx, text, size, candidates, hard, soft, optional) {
  const boxes = candidates.map((c) => ({ c, b: textBox(ctx, text, c.x, c.y, c.align || 'right', size) }));
  const free = (b, list) => !(list || []).some((a) => a && boxesOverlap(a, b));
  const pick = boxes.find((k) => free(k.b, hard) && free(k.b, soft)) || boxes.find((k) => free(k.b, hard)) || (optional ? null : boxes[0]);
  if (!pick) return null;
  const al = ctx.textAlign; ctx.textAlign = pick.c.align || 'right'; ctx.fillText(text, pick.c.x, pick.c.y); ctx.textAlign = al;
  return pick.b;
}
/* Right-aligned canvas label at (W - 10, y) that moves left of a reserved box (the scale bar) when it would
   overlap it; draws the label and returns its box. */
function labelClear(ctx, text, xRight, y, size, keepOut) {
  let b = textBox(ctx, text, xRight, y, 'right', size);
  if (keepOut && boxesOverlap(b, keepOut)) { xRight = keepOut.x0 - 8; b = textBox(ctx, text, xRight, y, 'right', size); }
  const al = ctx.textAlign; ctx.textAlign = 'right'; ctx.fillText(text, xRight, y); ctx.textAlign = al;
  return b;
}
/* Colour bar for the viewport, drawn on a small panel at the right edge inside the band [top, bottom]
   (below the legend, above the scale bar). Placement: the largest bar (110 px down to 30 px) and the highest
   position that covers no reserved box (avoid: canvas labels, never) and as few soft boxes as possible
   (soft: cable and reference points), preferring not to cover labels that could move aside (movable). The caption
   (T_allow value) sits under the title, so nothing hangs below the bar; it is dropped when the band is short. When
   even the smallest panel does not fit in the band, nothing is drawn (returns null). mode: 'safety' or 'relative'. */
function drawColourBar(ctx, { right, top, bottom, avoid, movable, soft, mode, Tmax, Tallow, allowPct, dark }) {
  const t = cfg.t, font = cssVar('--font'), ink = cssVar('--ink2');
  const padX = 7, padY = 6, barW = 11, markW = 11, gap = 5;
  const title = t(mode === 'safety' ? 'vp.cbar.safety' : 'vp.cbar.relative');
  const caption = mode === 'safety' ? t('vp.cbar.allow', { v: fmtSI(Tallow, 'N'), p: fmtNum(allowPct, 3) }) : '';
  const ticks = mode === 'safety' ? [[0, '0'], [SAFETY_WARN, Math.round(SAFETY_WARN * 100) + ' %'], [1, '100 %']] : [[0, '0'], [1, fmtSI(Tmax, 'N')]];
  ctx.save();
  ctx.font = 'bold 10.5px ' + font; const titleW = ctx.measureText(title).width;
  ctx.font = '10px ' + font; const capW = caption ? ctx.measureText(caption).width : 0;
  const tickW = Math.max.apply(null, ticks.map((k) => ctx.measureText(k[1]).width));
  let withCap = !!caption;
  const layout = () => {
    const headH = 12 + (withCap ? 12 : 0) + 7, footH = 6;
    const innerW = Math.max(titleW, withCap ? capW : 0, tickW + gap + barW + markW);
    return { headH, footH, w: innerW + 2 * padX, avail: bottom - top - 2 * padY - headH - footH };
  };
  let L = layout();
  if (withCap && L.avail < 46) { withCap = false; L = layout(); }
  const x0 = right - L.w, hard = avoid || [], mov = movable || [], sft = soft || [];
  if (bottom - top < 2 * padY + L.headH + 30 + L.footH) { ctx.restore(); return null; }   // no room: the cable colours still show, the KPI tile gives T_max / MBL
  let best = null;
  for (const bh of [110, 92, 76, 62, 50, 40, 30]) {
    if (bh > Math.max(30, L.avail)) continue;
    const ph = 2 * padY + L.headH + bh + L.footH;
    for (let y = top; y + ph <= bottom; y += 4) {
      const b = { x0, x1: right, y0: y, y1: y + ph };
      let cost = 0;
      for (const a of hard) if (boxesOverlap(a, b)) cost += 1000;
      for (const a of mov) if (boxesOverlap(a, b)) cost += 50;
      if (cost < 1000) for (const a of sft) if (boxesOverlap(a, b)) cost += 1;
      if (!best || cost < best.cost) best = { y, bh, cost };
      if (cost === 0) break;
    }
    if (best && best.cost === 0) break;
  }
  const barH = best ? best.bh : 30, panelH = 2 * padY + L.headH + barH + L.footH;
  const y0 = best ? best.y : Math.max(2, Math.min(top, bottom - panelH));
  /* panel */
  ctx.globalAlpha = 0.9; ctx.fillStyle = cssVar('--view'); roundRect(ctx, x0, y0, L.w, panelH, 7); ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = cssVar('--line'); ctx.lineWidth = 1; roundRect(ctx, x0 + 0.5, y0 + 0.5, L.w - 1, panelH - 1, 7); ctx.stroke();
  ctx.textAlign = 'right'; ctx.fillStyle = cssVar('--ink');
  ctx.font = 'bold 10.5px ' + font; ctx.fillText(title, right - padX, y0 + padY + 10);
  ctx.font = '10px ' + font; ctx.fillStyle = ink;
  if (withCap) ctx.fillText(caption, right - padX, y0 + padY + 22);
  /* bar */
  const bx = right - padX - markW - barW, by = y0 + padY + L.headH;
  for (let k = 0; k < barH; k++) { ctx.fillStyle = mode === 'safety' ? safetyColour(1.3 * (1 - k / barH), dark) : relativeColour(1 - k / barH, dark); ctx.fillRect(bx, by + k, barW, 1.3); }
  ctx.strokeStyle = ink; ctx.strokeRect(bx - 0.5, by - 0.5, barW + 1, barH + 1);
  const Y = mode === 'safety' ? (u) => by + barH * (1 - Math.min(u, 1.3) / 1.3) : (u) => by + barH * (1 - u);
  ctx.fillStyle = ink; ctx.textAlign = 'right';
  ticks.forEach(([u, lab]) => { const yy = Y(u); ctx.beginPath(); ctx.moveTo(bx - 4, yy); ctx.lineTo(bx, yy); ctx.stroke(); ctx.fillText(lab, bx - gap - 1, Math.max(by + 7, Math.min(by + barH + 3, yy + 3.5))); });
  if (mode === 'safety' && isFinite(Tmax) && Tallow > 0) {
    const yy = Y(Tmax / Tallow); ctx.fillStyle = cssVar('--ink'); ctx.beginPath(); ctx.moveTo(bx + barW + 2, yy); ctx.lineTo(bx + barW + 9, yy - 4.5); ctx.lineTo(bx + barW + 9, yy + 4.5); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  return { x0, y0, x1: right, y1: y0 + panelH, caption: withCap, barH };
}

/* --------------------------------------------------------- checklist */
function createChecklist({ storeKey, items, manual, el, getStage }) {
  const checks = createStore(storeKey, {});
  const t = () => cfg.t;
  function render() {
    const box = $(el); if (!box) return;
    const st = getStage(), list = items(st) || [];
    box.innerHTML = '<summary>' + t()('check.title') + ' <span class="count">' + list.filter((k) => checks[st + '.' + k]).length + '/' + list.length + '</span></summary><ul>' +
      list.map((k) => { const done = !!checks[st + '.' + k], man = manual.indexOf(k) >= 0; return '<li class="' + (done ? 'done' : '') + '"><label><input type="checkbox" data-k="' + k + '" ' + (done ? 'checked' : '') + (man ? '' : ' disabled') + '> <span>' + t()('check.' + st + '.' + k) + '</span></label></li>'; }).join('') + '</ul>';
    $$(el + ' input').forEach((inp) => inp.addEventListener('change', () => { checks[getStage() + '.' + inp.dataset.k] = inp.checked; checks.save(); render(); }));
  }
  function tick(key) { const st = getStage(), list = items(st) || []; if (list.indexOf(key) < 0) return; const k = st + '.' + key; if (checks[k]) return; checks[k] = true; checks.save(); render(); }
  return { render, tick, checks };
}

/* ------------------------------------------------------- activities */
/* Guided, step-by-step activity per stage, shown at the top of the guide's speech bubble.
   steps(stage) -> [{ id, text, hint?, params?: () => ({}), target?: selector | (p) => selector, ok?, need: [cond...] }]
   cond: { ev: name, test?: (data) => bool } (event) | { state: (snap, S) => bool } (polled) | { manual: true } (Done button).
   The conditions of a step are satisfied in order. The bubble turns yellow when a new step appears ('task-new',
   cleared at the next user interaction) and green for a moment when a step is completed ('task-ok'). The step's
   target control gets a pulsing outline ('coach'); its folded group is opened the first time. */
function createActivity({ storeKey, steps, taskEl, bubbleEl, listEl, stageCount, gotoStage, stageName, onChange, base }) {
  const t = () => cfg.t;
  base = base || 0;                      // displayed number of stage 0
  const store = createStore(storeKey, {});
  const R = { stage: -1, p: 0, completing: false, newTask: false, hintOpen: false, coachEl: null, coachedFor: '', timer: null };
  const OK_KEYS = ['act.ok.0', 'act.ok.1', 'act.ok.2', 'act.ok.3'];
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function rec(stage) { const k = 's' + stage; if (!store[k] || typeof store[k] !== 'object') store[k] = { i: 0, done: [], skipped: [] }; return store[k]; }
  /* the number of steps per stage is stored with the progress, so that other module pages can show it in their stage menu */
  for (let k = 0; k < (stageCount || 0); k++) rec(k).n = (steps(k) || []).length;
  store.save();
  function list() { return (R.stage >= 0 && steps(R.stage)) || []; }
  function cur() { return list()[rec(R.stage).i] || null; }
  function setLook(kind) { const b = $(bubbleEl); if (!b) return; b.classList.toggle('task-new', kind === 'new'); b.classList.toggle('task-ok', kind === 'ok'); }
  function textOf(s) { return t()(s.text, s.params ? s.params() : {}); }
  function start(stage) {
    clearTimeout(R.timer);
    R.stage = stage; R.p = 0; R.completing = false; R.hintOpen = false; R.coachedFor = '';
    R.newTask = list().length > 0; setLook(R.newTask ? 'new' : '');
    render();
  }
  function satisfies(c, name, data) { return !!c && c.ev === name && (!c.test || !!c.test(data || {})); }
  function event(name, data) {
    if (R.stage < 0 || R.completing) return;
    const s = cur(); if (!s) return;
    if (satisfies(s.need[R.p], name, data)) advance();
  }
  function poll(snap, S) {
    for (let guard = 0; guard < 4; guard++) {
      if (R.stage < 0 || R.completing) return;
      const s = cur(); if (!s) return;
      const c = s.need[R.p];
      if (c && c.state && c.state(snap, S)) advance(); else return;
    }
  }
  function advance() { const s = cur(); if (!s) return; R.p++; if (R.p >= s.need.length) complete(false); else render(); }
  function complete(skipped) {
    const s = cur(), r = rec(R.stage); if (!s) return;
    const bag = skipped ? r.skipped : r.done; if (bag.indexOf(s.id) < 0) bag.push(s.id);
    store.save();
    R.completing = true; R.newTask = false; setLook(skipped ? '' : 'ok');
    render(skipped ? null : (s.ok || OK_KEYS[r.i % OK_KEYS.length]));
    if (onChange) onChange();
    clearTimeout(R.timer);
    R.timer = setTimeout(next, skipped ? 200 : 1900);
  }
  function next() {
    const r = rec(R.stage); r.i++; store.save();
    R.p = 0; R.completing = false; R.hintOpen = false;
    R.newTask = true; setLook('new');
    render();
  }
  function restart() { const r = rec(R.stage); r.i = 0; r.done = []; r.skipped = []; store.save(); start(R.stage); if (onChange) onChange(); }
  function progress(stage) { const r = rec(stage), n = (steps(stage) || []).length; return { done: Math.min(r.done.length, n), n, finished: n > 0 && r.i >= n }; }
  function targetSel(s) { if (!s || !s.target) return ''; return (typeof s.target === 'function' ? s.target(R.p) : s.target) || ''; }
  function coach() {
    if (R.coachEl) { R.coachEl.classList.remove('coach'); R.coachEl = null; }
    const s = cur(); if (!s || R.completing || !s.target) return;
    const sel = targetSel(s); if (!sel) return;
    let el = document.querySelector(sel); if (!el) return;
    const key = R.stage + ':' + s.id + ':' + R.p;
    const first = R.coachedFor !== key;
    el = revealTarget(el, first).el;          // opens folded groups / results the first time; a tab stands in for a hidden panel
    const fw = el.closest('.field'); if (fw) el = fw;
    if (first) {
      R.coachedFor = key;
      try { el.scrollIntoView({ block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth' }); } catch (e) { /* ignore */ }
    }
    el.classList.add('coach'); R.coachEl = el;
  }
  /* "Go to": scroll to the step's control, focus it and spotlight it */
  function showTarget() {
    const s = cur(); const sel = targetSel(s);
    let el = sel ? document.querySelector(sel) : null;
    if (!el) { toast(t()('ui.goto.missing')); return; }
    const r = revealTarget(el, true); el = r.el;
    const box = el.closest('.field') || el;
    try { box.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' }); } catch (e) { /* ignore */ }
    const focusable = box.matches('input, select, textarea, button, a, summary') ? box : box.querySelector('input:not([type="hidden"]), select, textarea, button, summary');
    if (focusable) { try { focusable.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    spotlight(box, { label: r.note || t()('ui.goto.here'), ms: 2800 });
    if (R.newTask) { R.newTask = false; setLook(''); }
  }
  function render(okMsg) {
    const el = $(taskEl); if (!el) return;
    const L = list(), r = rec(R.stage), n = L.length;
    if (!n) { el.hidden = true; renderList(); return; }
    el.hidden = false;
    const s = cur();
    const dots = L.map((st, k) => '<i class="' + (r.done.indexOf(st.id) >= 0 ? 'd' : r.skipped.indexOf(st.id) >= 0 ? 'k' : k === r.i ? 'c' : '') + '"></i>').join('');
    let html = '<div class="thead"><span class="tbadge">' + escapeHtml(t()('act.title')) + '</span><span class="tstep">' + escapeHtml(s ? t()('act.step', { i: r.i + 1, n }) : t()('act.allDone')) + '</span><span class="tdots" aria-hidden="true">' + dots + '</span></div>';
    if (okMsg) html += '<div class="tok">✓ ' + escapeHtml(t()(okMsg)) + '</div>';
    if (s) {
      html += '<div class="ttext' + (R.completing ? ' done' : '') + '">' + textOf(s) + '</div>';
      if (!R.completing) {
        if (s.need.length > 1 && R.p > 0) html += '<div class="tpart">' + escapeHtml(t()('act.partial', { k: R.p, m: s.need.length })) + '</div>';
        if (R.hintOpen && s.hint) html += '<div class="thint">' + t()(s.hint, s.params ? s.params() : {}) + '</div>';
        const c = s.need[R.p], tsel = targetSel(s), tname = tsel ? targetName(tsel) : '';
        html += '<div class="tbtns">' + (tsel ? '<button type="button" class="tb goto" data-a="show" title="' + escapeHtml(t()('ui.goto.tip')) + '">' + ICON_TARGET + '<span>' + escapeHtml(tname ? t()('ui.goto', { name: tname }) : t()('ui.goto.generic')) + '</span></button>' : '') +
          (c && c.manual ? '<button type="button" class="tb primary" data-a="done">' + escapeHtml(t()('act.done')) + '</button>' : '') +
          (s.hint && !R.hintOpen ? '<button type="button" class="tb" data-a="hint">' + escapeHtml(t()('act.hint')) + '</button>' : '') +
          '<button type="button" class="tb ghost" data-a="skip">' + escapeHtml(t()('act.skip')) + '</button></div>';
      }
    } else {
      const nx = R.stage + 1 < stageCount ? R.stage + 1 : -1;
      html += '<div class="ttext">' + escapeHtml(t()('act.complete', { n: R.stage + base })) + ' ' + escapeHtml(nx >= 0 ? t()('act.nextHint', { n: nx + base, name: stageName(nx) }) : t()('act.allStages')) + '</div>' +
        '<div class="tbtns">' + (nx >= 0 ? '<button type="button" class="tb primary" data-a="goto" data-n="' + nx + '">' + escapeHtml(t()('act.goto', { n: nx + base })) + '</button>' : '') +
        '<button type="button" class="tb ghost" data-a="restart">' + escapeHtml(t()('act.restart')) + '</button></div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('button[data-a]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.a;
      if (a === 'hint') { R.hintOpen = true; render(); } else if (a === 'done') advance(); else if (a === 'skip') complete(true);
      else if (a === 'restart') restart(); else if (a === 'goto') gotoStage(parseInt(b.dataset.n, 10)); else if (a === 'show') showTarget();
    }));
    typeset(el);
    renderList();
    coach();
  }
  function firstSentence(html) { const txt = String(html).replace(/<[^>]+>/g, ''); const m = txt.match(/^(.+?[.!?])(\s|$)/); return m ? m[1] : txt; }
  function renderList() {
    const box = $(listEl); if (!box) return;
    const L = list(), r = rec(R.stage);
    box.innerHTML = '<summary>' + escapeHtml(t()('act.listTitle', { n: R.stage + base })) + ' <span class="count">' + r.done.length + '/' + L.length + '</span></summary><ol class="actlist">' +
      L.map((s, k) => { const cls = r.done.indexOf(s.id) >= 0 ? 'done' : r.skipped.indexOf(s.id) >= 0 ? 'skipped' : k === r.i ? 'current' : 'todo'; return '<li class="' + cls + '"><span>' + escapeHtml(firstSentence(textOf(s))) + '</span></li>'; }).join('') +
      '</ol><div class="tbtns"><button type="button" class="tb ghost" data-a="restart">' + escapeHtml(t()('act.restart')) + '</button></div>';
    box.querySelector('button[data-a="restart"]').addEventListener('click', restart);
  }
  const dismiss = () => { if (R.newTask) { R.newTask = false; setLook(''); } };
  document.addEventListener('pointerdown', dismiss, true);
  document.addEventListener('keydown', dismiss, true);
  return { start, event, poll, render, refresh: coach, restart, progress, skip: () => complete(true), showTarget, current: () => ({ stage: R.stage, index: rec(R.stage).i, p: R.p, step: cur(), completing: R.completing, isNew: R.newTask }), store };
}
const ICON_TARGET = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg>';
/* Short, human name of a target control (its field label, tab or button text) for the "Go to" button. */
function targetName(sel) {
  const el = document.querySelector(sel); if (!el) return '';
  let s = '';
  const f = el.closest('.field');
  if (f) { const l = f.querySelector('.fhead label'); s = l ? l.textContent : ''; }
  else if (el.tagName === 'CANVAS') s = cfg.t('ui.reg.viewport');
  else if (el.matches('input, select, textarea')) { const l = (el.id && document.querySelector('label[for="' + el.id + '"]')) || el.closest('label'); s = l ? l.textContent : (el.getAttribute('aria-label') || ''); }
  else { const lbl = el.querySelector('.lbl'); s = (lbl && lbl.textContent) || el.textContent || el.getAttribute('aria-label') || el.title || ''; }
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > 30 ? s.slice(0, 29).trim() + '…' : s;
}
/* Make a target visible: open folded <details>, unfold the results bar parts that hold it, and when it sits in a
   hidden plot panel return that panel's tab instead (with a note). first: only then are folds opened. */
function revealTarget(el, first) {
  if (first) {
    for (let d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) if (!d.open) d.open = true;
    const rb = UI.results;
    if (rb) { if (el.closest('#kpis') && !rb.isOpen('kpis')) rb.set('kpis', true); if (el.closest('#plots') && !rb.isOpen('plots')) rb.set('plots', true); }
  }
  const area = el.closest('.plotarea');
  if (area && area.hidden && area.dataset.tab) {
    const tab = document.querySelector('#plot-tabs button[data-plot="' + area.dataset.tab + '"]');
    if (tab && !tab.hidden) return { el: tab, note: cfg.t('ui.goto.openTab', { name: tab.textContent.trim() }) };
  }
  return { el, note: '' };
}

/* ------------------------------------------- course outline and stage menu */
const UI = { results: null };
/* Merge the shared strings and this module's stage names (as 'stage.n') from COURSE into the module dictionary. */
function courseInit(dicts, moduleId) {
  const C = root.COURSE; if (!C) return dicts;
  const mod = C.modules.find((m) => m.id === moduleId);
  for (const lang of Object.keys(C.i18n)) {
    const d = dicts[lang] || (dicts[lang] = {}), src = C.i18n[lang];
    for (const k in src) if (d[k] === undefined) d[k] = src[k];
    if (mod) for (let i = 0; i < mod.stages; i++) { const k = 'course.' + moduleId + '.stage.' + i; if (src[k] !== undefined) d['stage.' + i] = src[k]; }
  }
  return dicts;
}
function courseModule(id) { return root.COURSE ? root.COURSE.modules.find((m) => m.id === id) : null; }
function courseHref(fromId, toId, stage) { const a = courseModule(fromId), b = courseModule(toId); return '../'.repeat(a ? a.depth : 0) + b.page + (stage !== undefined && stage !== null ? '#stage=' + stage : ''); }
/* Progress of another module's stage, read from its activity store (null when never opened). */
function courseProgress(mod, stage) {
  try { const s = JSON.parse(localStorage.getItem(mod.store) || '{}'), r = s['s' + stage]; if (!r) return null; const n = r.n || 0; return { done: Math.min((r.done || []).length, n || 1e9), n, finished: n > 0 && r.i >= n }; } catch (e) { return null; }
}
/* #stage=n in the address: deep links into a stage, and a reload keeps the stage; onHashStage follows edits of the address. */
function onHashStage(max, fn) { window.addEventListener('hashchange', () => { const n = hashStage(max); if (n !== null) fn(n); }); }
function hashStage(max) { const m = /[#&]stage=(\d+)/.exec(location.hash || ''); if (!m) return null; const n = parseInt(m[1], 10); return n >= 0 && n <= max ? n : null; }
function setHashStage(n) { try { if (hashStage(99) !== n) history.replaceState(null, '', '#stage=' + n); } catch (e) { /* sandboxed frame */ } }
const ICON_CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>';
const ICON_PREV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 6l6 6-6 6"/></svg>';
/* Compact stage navigator: ‹ [current stage ▾] › with a menu of all modules (one sub-menu per module).
   Stages of this module call onSelect(n); stages of other modules are links to their page (#stage=n). */
function createStageNav({ el, moduleId, lastStage, getStage, onSelect, progress, base }) {
  const t = () => cfg.t;
  base = base || 0;                      // displayed number of stage 0 (IMPAK levels are 1..3)
  const C = root.COURSE || { modules: [{ id: moduleId, stages: lastStage + 1 }] };
  const nav = $(el);
  const N = { open: false, expanded: {} };
  N.expanded[moduleId] = true;
  const modTitle = (id) => t()('course.' + id + '.title');
  const stageName = (id, n) => (id === moduleId ? t()('stage.' + n) : t()('course.' + id + '.stage.' + n));
  const where = (x) => t()('ui.stage.inModule', { module: modTitle(x.mod), n: x.n + base, name: stageName(x.mod, x.n) });
  function neighbours(cur) {
    const mods = C.modules, mi = mods.findIndex((m) => m.id === moduleId);
    const prev = cur > 0 ? { mod: moduleId, n: cur - 1 } : (mi > 0 ? { mod: mods[mi - 1].id, n: mods[mi - 1].stages - 1 } : null);
    const next = cur < lastStage ? { mod: moduleId, n: cur + 1 } : (mi >= 0 && mi < mods.length - 1 ? { mod: mods[mi + 1].id, n: 0 } : null);
    return { prev, next };
  }
  const progOf = (id, n) => (id === moduleId ? progress(n) : courseProgress(courseModule(id), n));
  function badge(pr) {
    if (!pr || !(pr.done > 0)) return '';
    const full = pr.n > 0 && pr.done >= pr.n;
    return '<span class="sprog' + (full ? ' full' : '') + '"' + (pr.n ? ' title="' + escapeHtml(t()('ui.stage.progress', { d: pr.done, n: pr.n })) + '"' : '') + '>' + (full ? '✓' : pr.done + (pr.n ? '/' + pr.n : '')) + '</span>';
  }
  function go(x) {
    if (!x) return;
    if (x.mod === moduleId) { close(); onSelect(x.n); }
    else location.href = courseHref(moduleId, x.mod, x.n);
  }
  function menuHtml(cur) {
    return C.modules.map((m) => {
      const own = m.id === moduleId, open = !!N.expanded[m.id];
      let d = 0, n = 0;
      for (let i = 0; i < m.stages; i++) { const p = progOf(m.id, i); if (p) { d += p.done; n += p.n || 0; } }
      const items = [];
      for (let i = 0; i < m.stages; i++) {
        const active = own && i === cur, p = progOf(m.id, i);
        const inner = '<span class="n">' + (i + base) + '</span><span class="name">' + escapeHtml(stageName(m.id, i)) + '</span>' + (active ? '<span class="here">' + escapeHtml(t()('ui.stage.here')) + '</span>' : '') + badge(p);
        items.push(own
          ? '<button type="button" role="menuitem" class="sitem' + (active ? ' active' : '') + '" data-mod="' + m.id + '" data-n="' + i + '"' + (active ? ' aria-current="true"' : '') + '>' + inner + '</button>'
          : '<a role="menuitem" class="sitem ext" href="' + escapeHtml(courseHref(moduleId, m.id, i)) + '" data-mod="' + m.id + '" data-n="' + i + '" title="' + escapeHtml(t()('ui.stage.opensPage', { module: modTitle(m.id) })) + '">' + inner + '</a>');
      }
      return '<div class="smod' + (own ? ' own' : '') + (open ? ' open' : '') + '" data-mod="' + m.id + '">' +
        '<button type="button" class="smhead" data-mod="' + m.id + '" aria-expanded="' + open + '">' + ICON_CHEV + '<span class="smt">' + escapeHtml(modTitle(m.id)) + '</span>' + (d > 0 ? '<span class="smp">' + d + (n ? '/' + n : '') + '</span>' : '') + '</button>' +
        '<div class="sitems"' + (open ? '' : ' hidden') + '>' + items.join('') + '</div></div>';
    }).join('');
  }
  function render() {
    const cur = getStage(), nb = neighbours(cur), focusKey = nav.contains(document.activeElement) && document.activeElement.dataset ? document.activeElement.dataset.focus || ((document.activeElement.dataset.mod || '') + ':' + (document.activeElement.dataset.n || '')) : '';
    const arrow = (dir, x) => '<button type="button" class="sarrow" data-focus="' + dir + '" data-go="' + dir + '"' + (x ? ' title="' + escapeHtml(t()(dir === 'prev' ? 'ui.stage.prevTo' : 'ui.stage.nextTo', { where: where(x) })) + '"' : ' disabled title="' + escapeHtml(t()(dir === 'prev' ? 'ui.stage.start' : 'ui.stage.end')) + '"') + ' aria-label="' + escapeHtml(t()(dir === 'prev' ? 'ui.stage.prev' : 'ui.stage.next')) + '">' + (dir === 'prev' ? ICON_PREV : ICON_NEXT) + '</button>';
    nav.innerHTML = arrow('prev', nb.prev) +
      '<div class="sbox"><button type="button" class="stage active scur" id="stage-cur" data-focus="cur" aria-haspopup="menu" aria-expanded="' + N.open + '" aria-controls="stage-drop" title="' + escapeHtml(t()('ui.stage.open')) + '">' +
      '<span class="n">' + (cur + base) + '</span><span class="name">' + escapeHtml(stageName(moduleId, cur)) + '</span>' + badge(progOf(moduleId, cur)) + ICON_CHEV + '</button>' +
      '<div class="sdrop" id="stage-drop" role="menu" aria-label="' + escapeHtml(t()('ui.stage.menu')) + '"' + (N.open ? '' : ' hidden') + '>' + menuHtml(cur) + '</div></div>' +
      arrow('next', nb.next);
    nav.querySelectorAll('.sarrow').forEach((b) => b.addEventListener('click', () => go(nb[b.dataset.go])));
    $('#stage-cur', nav).addEventListener('click', () => (N.open ? close() : open()));
    $('#stage-cur', nav).addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); open(); focusItem(0, true); } });
    nav.querySelectorAll('.smhead').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); N.expanded[b.dataset.mod] = !N.expanded[b.dataset.mod]; render(); const h = nav.querySelector('.smhead[data-mod="' + b.dataset.mod + '"]'); if (h) h.focus(); }));
    nav.querySelectorAll('button.sitem').forEach((b) => b.addEventListener('click', () => go({ mod: b.dataset.mod, n: parseInt(b.dataset.n, 10) })));
    $('#stage-drop', nav).addEventListener('keydown', menuKeys);
    if (focusKey) { const f = nav.querySelector('[data-focus="' + focusKey + '"]') || nav.querySelector('[data-mod="' + focusKey.split(':')[0] + '"][data-n="' + focusKey.split(':')[1] + '"]'); if (f) f.focus(); }
  }
  function items() { return Array.from(nav.querySelectorAll('#stage-drop .smhead, #stage-drop .sitems:not([hidden]) .sitem')); }
  function focusItem(k, current) { const L = items(); if (!L.length) return; let i = k; if (current) { const a = L.findIndex((x) => x.classList.contains('active')); if (a >= 0) i = a; } L[(i + L.length) % L.length].focus(); }
  function menuKeys(e) {
    const L = items(), i = L.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); focusItem(0); }
    else if (e.key === 'End') { e.preventDefault(); focusItem(L.length - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); const c = $('#stage-cur', nav); if (c) c.focus(); }
    else if (e.key === 'Tab') close();
  }
  function open() { if (N.open) return; N.open = true; render(); }
  function close() { if (!N.open) return; N.open = false; const d = $('#stage-drop', nav); if (d) d.hidden = true; const c = $('#stage-cur', nav); if (c) c.setAttribute('aria-expanded', 'false'); }
  document.addEventListener('pointerdown', (e) => { if (N.open && !nav.contains(e.target)) close(); }, true);
  document.addEventListener('keydown', (e) => { if (N.open && e.key === 'Escape') close(); });
  return { render, open, close, get isOpen() { return N.open; }, neighbours: () => neighbours(getStage()) };
}

/* ------------------------------------------------------------ results bar */
/* Strip above the KPI tiles with toggles that fold the values (KPI tiles) and the plots, so that the
   viewport gets the space. State is shared by all modules (store 'cl.results'). When the values are folded
   the strip shows a one-line summary (setSummary). */
function createResultsBar({ el, storeKey, onChange }) {
  const t = () => cfg.t;
  const st = createStore(storeKey || 'cl.results', { kpis: true, plots: true });
  const bar = $(el);
  let summary = '';
  function apply() { document.body.classList.toggle('res-nokpis', !st.kpis); document.body.classList.toggle('res-noplots', !st.plots); }
  function tog(k) {
    const on = !!st[k], what = t()('ui.res.' + k);
    return '<button type="button" class="rtog' + (on ? ' on' : '') + '" id="tog-' + k + '" data-k="' + k + '" aria-expanded="' + on + '" aria-controls="' + k + '" title="' + escapeHtml(t()(on ? 'ui.res.hide' : 'ui.res.show', { what: what.toLowerCase() })) + '">' + ICON_CHEV + '<span>' + escapeHtml(what) + '</span></button>';
  }
  function render() {
    bar.title = t()('ui.res.tip');
    bar.innerHTML = '<span class="pdot"></span><span class="rtitle">' + escapeHtml(t()('ui.results')) + '</span><span class="rsum" id="res-sum">' + (st.kpis ? '' : summary) + '</span><span class="rtools">' + tog('kpis') + tog('plots') + '</span>';
    bar.querySelectorAll('.rtog').forEach((b) => b.addEventListener('click', () => set(b.dataset.k, !st[b.dataset.k])));
  }
  function set(k, v) { st[k] = !!v; st.save(); apply(); render(); const b = $('#tog-' + k); if (b && document.activeElement === document.body) b.focus(); if (onChange) onChange(k, st[k]); }
  function setSummary(html) { if (html === summary) return; summary = html; const s = $('#res-sum'); if (s) s.innerHTML = st.kpis ? '' : summary; }
  apply();
  const api = { render, set, apply, setSummary, isOpen: (k) => !!st[k] };
  UI.results = api;
  return api;
}

/* -------------------------------------------------------------- spotlight */
/* Dim the page except one element and ring it; follows the element while it scrolls. ms > 0: fades after ms
   or at the next click / key press; ms = 0: stays until clearSpot() (used by the tour). */
let SPOT = null;
function clearSpot() {
  if (!SPOT) return;
  cancelAnimationFrame(SPOT.raf); clearTimeout(SPOT.timer);
  SPOT.ring.remove(); if (SPOT.tag) SPOT.tag.remove();
  if (SPOT.off) { document.removeEventListener('pointerdown', SPOT.off, true); document.removeEventListener('keydown', SPOT.off, true); }
  SPOT = null;
}
function spotlight(el, { label, ms, dim, pad, onPlace } = {}) {
  clearSpot();
  if (!el) return null;
  const ring = document.createElement('div'); ring.className = 'spot' + (ms === 0 ? ' still' : ''); ring.style.setProperty('--dim', String(dim === undefined ? 0.3 : dim));
  let tag = null; if (label) { tag = document.createElement('div'); tag.className = 'spottag'; tag.textContent = label; }
  document.body.appendChild(ring); if (tag) document.body.appendChild(tag);
  const p = pad === undefined ? 6 : pad;
  const me = { ring, tag, raf: 0, el };
  SPOT = me;
  function place() {
    if (SPOT !== me) return;
    const r = el.getBoundingClientRect();
    ring.style.left = (r.left - p) + 'px'; ring.style.top = (r.top - p) + 'px'; ring.style.width = (r.width + 2 * p) + 'px'; ring.style.height = (r.height + 2 * p) + 'px';
    if (tag) {
      const tw = tag.offsetWidth, th = tag.offsetHeight, below = r.top - p - th - 10 < 4;
      tag.classList.toggle('below', below);
      tag.style.left = Math.max(6, Math.min(window.innerWidth - tw - 6, r.left + Math.min(24, r.width / 2) - 14)) + 'px';
      tag.style.top = (below ? r.bottom + p + 10 : r.top - p - th - 10) + 'px';
    }
    if (onPlace) onPlace(r);
    me.raf = requestAnimationFrame(place);
  }
  place();
  if (ms) {
    me.timer = setTimeout(clearSpot, ms);
    me.off = () => clearSpot();
    setTimeout(() => { if (SPOT === me) { document.addEventListener('pointerdown', me.off, true); document.addEventListener('keydown', me.off, true); } }, 60);
  }
  return me;
}

/* ------------------------------------------------------------------ tour */
/* stops: [{ sel, title, text }] (title/text: functions or strings). Esc closes; ← / → step. */
function createTour(stops) {
  const t = () => cfg.t;
  const T = { i: -1, call: null, block: null, key: null };
  const val = (v) => (typeof v === 'function' ? v() : v);
  const visible = (el) => !!el && el.getClientRects().length > 0;
  function show(k, dir) {
    const n = stops.length;
    while (k >= 0 && k < n && !visible($(stops[k].sel))) k += dir || 1;
    if (k < 0 || k >= n) { close(); return; }
    T.i = k; const s = stops[k], el = $(s.sel);
    try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
    if (!T.call) { T.call = document.createElement('div'); T.call.className = 'tourcall'; T.call.setAttribute('role', 'dialog'); T.call.setAttribute('aria-modal', 'true'); document.body.appendChild(T.call); }
    const last = k === n - 1;
    T.call.innerHTML = '<div class="tchead"><span class="tcn">' + escapeHtml(t()('ui.tour.of', { i: k + 1, n })) + '</span><b>' + escapeHtml(val(s.title)) + '</b><button type="button" class="tcx" data-a="close" aria-label="' + escapeHtml(t()('ui.tour.close')) + '">×</button></div>' +
      '<p>' + escapeHtml(val(s.text)) + '</p><div class="tcbtns">' + (k > 0 ? '<button type="button" class="tb" data-a="back">' + escapeHtml(t()('ui.tour.back')) + '</button>' : '') +
      '<button type="button" class="tb primary" data-a="' + (last ? 'close' : 'next') + '">' + escapeHtml(t()(last ? 'ui.tour.done' : 'ui.tour.next')) + '</button></div>';
    T.call.setAttribute('aria-label', val(s.title));
    T.call.querySelectorAll('button[data-a]').forEach((b) => b.addEventListener('click', () => { const a = b.dataset.a; if (a === 'next') show(T.i + 1, 1); else if (a === 'back') show(T.i - 1, -1); else close(); }));
    spotlight(el, { ms: 0, dim: 0.5, pad: 4, onPlace: placeCall });
    const nb = T.call.querySelector('.tb.primary'); if (nb) nb.focus({ preventScroll: true });
  }
  function placeCall(r) {
    const c = T.call; if (!c) return;
    const cw = c.offsetWidth, ch = c.offsetHeight, W = window.innerWidth, H = window.innerHeight, m = 12;
    let x, y;
    if (r.bottom + m + ch < H) { y = r.bottom + m; x = r.left; }
    else if (r.top - m - ch > 0) { y = r.top - m - ch; x = r.left; }
    else if (r.right + m + cw < W) { x = r.right + m; y = r.top; }
    else if (r.left - m - cw > 0) { x = r.left - m - cw; y = r.top; }
    else { x = (W - cw) / 2; y = (H - ch) / 2; }
    c.style.left = Math.max(8, Math.min(W - cw - 8, x)) + 'px'; c.style.top = Math.max(8, Math.min(H - ch - 8, y)) + 'px';
  }
  function start() {
    close();
    T.block = document.createElement('div'); T.block.className = 'tourblock'; document.body.appendChild(T.block);
    T.key = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'ArrowRight') { e.preventDefault(); show(T.i + 1, 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); if (T.i > 0) show(T.i - 1, -1); } };
    document.addEventListener('keydown', T.key, true);
    show(0, 1);
  }
  function close() {
    clearSpot();
    if (T.call) T.call.remove(); if (T.block) T.block.remove();
    if (T.key) document.removeEventListener('keydown', T.key, true);
    T.call = null; T.block = null; T.key = null; T.i = -1;
  }
  return { start, close, get index() { return T.i; }, get count() { return stops.length; } };
}

/* ------------------------------------------------------------ screen guide */
/* ⓘ button: a dialog naming every area of the screen (clickable map + list), the symbols and colours, the
   keyboard shortcuts, and a tour through the areas. regions: [{ id, sel, name: () => '', desc: () => '', acc }]. */
function createScreenGuide({ button, regions, extra }) {
  const t = () => cfg.t;
  const btn = $(button);
  const tour = createTour(regions.map((r) => ({ sel: r.sel, title: () => r.name(), text: () => r.desc() })));
  let dlg = null;
  const seen = createStore('cl.guide', { seen: false });
  function hint() { if (!btn) return; btn.classList.toggle('hint', !seen.seen); btn.title = t()(seen.seen ? 'ui.info' : 'ui.info.first'); btn.setAttribute('aria-label', t()('ui.info')); }
  function showRegion(r) { close(); const el = $(r.sel); if (!el) return; try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } spotlight(el, { label: r.name(), ms: 3200, dim: 0.42, pad: 3 }); }
  function build() {
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'sguide'; dlg.id = 'screen-guide';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });   // click on the backdrop
    }
    const area = (r) => '<button type="button" class="ireg" data-r="' + r.id + '" style="--acc:var(' + r.acc + ');grid-area:' + r.id + '">' + escapeHtml(r.name()) + '</button>';
    dlg.setAttribute('aria-label', t()('ui.info.title'));
    dlg.innerHTML = '<div class="sghead"><h2>' + escapeHtml(t()('ui.info.title')) + '</h2><button type="button" class="tcx" data-a="close" aria-label="' + escapeHtml(t()('ui.info.close')) + '">×</button></div>' +
      '<div class="sgbody"><p class="lead">' + escapeHtml(t()('ui.info.lead')) + '</p>' +
      '<div class="imap" role="group" aria-label="' + escapeHtml(t()('ui.info.map')) + '">' + regions.map(area).join('') + '</div>' +
      '<h3>' + escapeHtml(t()('ui.info.areas')) + '</h3><ol class="ilist">' + regions.map((r) => '<li style="--acc:var(' + r.acc + ')"><div><b>' + escapeHtml(r.name()) + '</b> ' + escapeHtml(r.desc()) + '</div><button type="button" class="tb" data-r="' + r.id + '">' + escapeHtml(t()('ui.info.show')) + '</button></li>').join('') + '</ol>' +
      '<h3>' + escapeHtml(t()('ui.info.symbols')) + '</h3><ul class="isym"><li>' + ['ui.sym.blocks', 'ui.sym.tags', 'ui.sym.colour', 'ui.sym.lines'].map((k) => escapeHtml(t()(k))).join('</li><li>') + '</li></ul>' +
      '<h3>' + escapeHtml(t()('ui.info.keys')) + '</h3><ul class="ikeys"><li>' + ['ui.key.space', 'ui.key.r', 'ui.key.dot', 'ui.key.esc'].map((k) => escapeHtml(t()(k))).join('</li><li>') + '</li></ul>' + (extra ? extra.html() : '') + '</div>' +
      '<div class="sgfoot"><button type="button" class="tb primary" data-a="tour">' + escapeHtml(t()('ui.info.tour', { n: regions.length })) + '</button><button type="button" class="tb" data-a="close">' + escapeHtml(t()('ui.info.close')) + '</button></div>';
    dlg.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => { const r = regions.find((x) => x.id === b.dataset.r); if (r) showRegion(r); }));
    dlg.querySelectorAll('[data-a="close"]').forEach((b) => b.addEventListener('click', close));
    dlg.querySelector('[data-a="tour"]').addEventListener('click', () => { close(); tour.start(); });
    if (extra && extra.wire) extra.wire(dlg, close);
  }
  function open() {
    seen.seen = true; seen.save(); hint();
    build();
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
    const p = dlg.querySelector('.tb.primary'); if (p) p.focus();
  }
  function close() { if (!dlg) return; if (typeof dlg.close === 'function' && dlg.open) dlg.close(); else dlg.removeAttribute('open'); }
  if (btn) btn.addEventListener('click', open);
  hint();
  return { open, close, tour, render: () => { hint(); if (dlg && dlg.open) build(); }, get isOpen() { return !!(dlg && dlg.open); } };
}
/* Condition builders for activity steps */
const act = {
  steadyNow: { state: (st) => !!(st && st.steady) },
  steadyNext: { ev: 'steady' },
  manual: { manual: true },
  ev: (name, test) => ({ ev: name, test }),
  field: (path, test) => ({ ev: 'field', test: (d) => d.path === path && (!test || test(d.value)) }),
  card: (id) => ({ ev: 'card', test: (d) => d.id === id }),
  pin: (id) => ({ ev: 'pin', test: (d) => d.id === id }),
  tabOpen: (name) => ({ state: (st, S) => !!S && S.activePlot === name }),
  tabSel: (name) => '#plot-tabs button[data-plot="' + name + '"]',
  cardSel: (id) => '.card[data-card="' + id + '"]',
};

/* ------------------------------------------------------ predict-first */
function createPredict({ el, narrator, onAnswered }) {
  const t = () => cfg.t;
  const P = { state: null };
  function show(card) {
    const pq = card.predict, box = $(el);
    P.state = { card, chosen: -1, revealed: false };
    box.hidden = false;
    box.innerHTML = '<h3>' + t()('predict.title') + '</h3><p>' + t()(pq.q) + '</p><div class="pqopts">' +
      ['a', 'b', 'c'].map((o, i) => '<button type="button" class="btn" data-i="' + i + '">' + t()(pq.q + '.' + o) + '</button>').join('') +
      '<button type="button" class="btn ghost" data-i="-1">' + t()('predict.skip') + '</button></div>';
    $$(el + ' button').forEach((b) => b.addEventListener('click', () => answer(parseInt(b.dataset.i, 10))));
  }
  function hide() { P.state = null; const box = $(el); if (box) { box.hidden = true; box.innerHTML = ''; } }
  function answer(i) {
    if (!P.state) return;
    P.state.chosen = i;
    $$(el + ' button').forEach((b) => { b.disabled = true; b.classList.toggle('chosen', parseInt(b.dataset.i, 10) === i); });
    if (i >= 0) { if (onAnswered) onAnswered(i); narrator.say('predict.noted', {}, true); } else hide();
  }
  function reveal() {
    const s = P.state; if (!s || s.revealed || s.chosen < 0) return;
    s.revealed = true;
    const pq = s.card.predict, right = s.chosen === pq.answer;
    narrator.say(right ? 'predict.right' : 'predict.wrong', { r: t()(pq.q + '.r') }, true);
    $$(el + ' button').forEach((b) => { const k = parseInt(b.dataset.i, 10); b.classList.toggle('right', k === pq.answer); b.classList.toggle('wrongpick', k === s.chosen && !right); });
  }
  return { show, hide, answer, reveal, get state() { return P.state; } };
}

/* -------------------------------------------------------------- pins */
function createPins({ legendSel, cmpSel, colours, getSnap, label, rows, nowValues, narrator, onChange }) {
  const t = () => cfg.t;
  const list = [];
  function pin(id) {
    const st = getSnap(); if (!st) return;
    const p = { id, label: label(), color: typeof colours === 'function' ? colours(id) : (colours[id] || colours.B), x: Float32Array.from(st.x), z: Float32Array.from(st.z), values: nowValues(st) };
    const k = list.findIndex((q) => q.id === id); if (k >= 0) list[k] = p; else list.push(p);
    list.sort((a, b) => (a.id < b.id ? -1 : 1));
    if (narrator) narrator.say('say.pinned', { id, label: p.label }, true);
    render(); if (onChange) onChange(list);
  }
  function clear() { list.length = 0; render(); if (onChange) onChange(list); }
  function render() {
    const leg = $(legendSel); if (leg) leg.innerHTML = list.map((p) => '<span title="' + escapeHtml(p.label) + '"><i style="border-top:2px dashed ' + p.color + '"></i>' + p.id + '</span>').join('');
    const cmp = $(cmpSel); if (!cmp) return;
    if (!list.length) { cmp.hidden = true; return; }
    cmp.hidden = false;
    const st = getSnap(), now = st ? nowValues(st) : null;
    const cols = list.map((p) => p.id).concat([t()('cmp.now')]);
    cmp.innerHTML = '<h3>' + t()('cmp.title') + '</h3><p class="help">' + list.map((p) => '<b style="color:' + p.color + '">' + p.id + '</b> ' + escapeHtml(p.label)).join(' · ') + '</p><table class="tbl cmp"><thead><tr><th></th>' + cols.map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map((r) => '<tr><th>' + t()(r.key) + '</th>' + list.map((p) => '<td>' + r.fmt(p.values[r.v]) + '</td>').join('') + '<td>' + (now ? r.fmt(now[r.v]) : '–') + '</td></tr>').join('') + '</tbody></table>';
  }
  return { pin, clear, render, list };
}

/* ---------------------------------------------------------- transport */
function setupTransport({ onPlay, onStep, onStop, onReset, onSnap, onSettle, onSpeed, speed }) {
  $('#btn-play').addEventListener('click', onPlay);
  $('#btn-step').addEventListener('click', onStep);
  $('#btn-stop').addEventListener('click', onStop);
  $('#btn-reset').addEventListener('click', onReset);
  $('#btn-snap').addEventListener('click', onSnap);
  $('#btn-settle').addEventListener('click', onSettle);
  const sel = $('#sel-speed'); sel.value = String(speed);
  sel.addEventListener('change', () => onSpeed(parseFloat(sel.value)));
  document.addEventListener('keydown', (e) => { const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'select' || tag === 'textarea' || tag === 'button') return; if (e.code === 'Space') { e.preventDefault(); onPlay(); } else if (e.key === 'r' || e.key === 'R') { onReset(); } else if (e.key === '.') { onStep(); } });
}
function setupTabs(tabsSel, areas, onChange) {
  $$(tabsSel + ' button').forEach((b) => b.addEventListener('click', () => {
    const key = b.dataset.plot; $$(tabsSel + ' button').forEach((x) => x.classList.toggle('active', x === b));
    for (const k in areas) { const el = $(areas[k]); if (el) el.hidden = !(Array.isArray(k.split('|')) && k.split('|').indexOf(key) >= 0); }
    onChange(key);
  }));
}

root.UIKit = { $, $$, DEG, configure, createStore, createPrefs, applyPrefsUI, setupPrefButtons, makeT, applyStaticText,
  fmtNum, fmtSI, fmtDeg, fmtS, fmtPctRel, fmtPow10, niceStep, interp, escapeHtml, lerpColor, cssVar, getPath, setPath, mergeInto, stamp,
  toast, saveFile, copyText, texToHtml, typeset, MiniPlot, createNarrator, createHost, makeGroup, renderField, sameValue, cloneValue,
  panelHead, controlsToolbar, SAFETY_WARN, safetyColour, relativeColour, safetyClass, drawColourBar, drawScaleBar, scaleBarGeom, labelClear, placeLabel, domBox, textBox, boxesOverlap, legendBottom,
  createActivity, act, targetName, revealTarget, courseInit, courseHref, courseProgress, hashStage, setHashStage, onHashStage, createStageNav, createResultsBar,
  spotlight, clearSpot, createTour, createScreenGuide,
  setupViewportInteraction, viewportCanvas, createChecklist, createPredict, createPins, setupTransport, setupTabs };
})(typeof window !== 'undefined' ? window : globalThis);

