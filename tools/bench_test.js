// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Ahmad Razin Zainal Abidin and Universiti Teknologi Malaysia
/* Browser check of learning from the benchmark parks in dist/index.html (Playwright): the Standings summary and the
 * full study (chart tooltip, keyboard, Escape, hover kept across the monthly re-render), the News digest one quarter
 * late, the benchmarks' choices after a deal, the final debrief and the transcript, dark theme and a 390 px phone.
 * Usage: node tools/bench_test.js [ms|en] [outdir] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
(async () => {
  const lang = process.argv[2] || 'ms', out = process.argv[3] || path.join(__dirname, '..', 'screenshots'); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(); const errors = []; let fails = 0;
  const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
  async function open(vp, theme) {
    const ctx = await browser.newContext({ viewport: vp }); const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(FILE); await page.waitForTimeout(600);
    if (lang === 'en') { await page.click('#btn-lang').catch(() => {}); await page.waitForTimeout(200); }
    if (theme === 'dark') { await page.click('#btn-theme'); await page.waitForTimeout(150); }
    await page.click('[data-a="solo"][data-level="2"]'); await page.waitForTimeout(500);
    return { ctx, page };
  }
  const setT = (page, k, extra) => page.evaluate(async ([k, extra]) => {
    const G = window.IMPAK, st = G.store(), g = st.game, sc = G.scenG(g);
    const closed = {}; for (const p of G.pausePoints(sc)) if (p.t <= k + 1e-9) closed[p.id] = true;
    await st.gmUpdate(Object.assign({ status: 'paused', accMs: k * g.msPerMonth, closed, startedAt: 0 }, extra || {}));
    st._cache = null; return G.compute().T;
  }, [k, extra || null]);
  const tab = async (page, k) => { await page.click('#plot-tabs button[data-plot="' + k + '"]'); await page.waitForTimeout(250); };

  /* 1. Standings: learn section, chart, tooltip, keyboard */
  let { ctx, page } = await open({ width: 1440, height: 900 });
  const T = await setT(page, 25.5); ok(Math.abs(T - 25.5) < 1e-6, 'clock set to month 25.5 (' + T + ')');
  await tab(page, 'stand'); await page.waitForTimeout(300);
  const learn = await page.evaluate(() => { const s = document.querySelector('#r-tab .bl'); return s ? s.innerText : ''; });
  ok(/benchmark/i.test(learn) && /(Dis T2|Dec Y2)/.test(learn) && /(impact setahun|impact a year)/.test(learn), 'Standings summary: lag line and the impact insight');
  await page.click('#r-tab [data-act="bench-open"]'); await page.waitForTimeout(350);
  ok(await page.evaluate(() => document.activeElement && document.activeElement.dataset.act === 'bench-close'), 'study opens with focus on Close');
  const box = await page.locator('#r-over .bch svg').boundingBox();
  await page.mouse.move(box.x + box.width * 0.32, box.y + box.height * 0.5); await page.waitForTimeout(300);
  const tip1 = await page.evaluate(() => { const t = document.querySelector('#r-over .bch-tip'); return t && !t.hidden ? t.innerText : ''; });
  ok(tip1.split('\n').length >= 3, 'tooltip shows the month and the series: ' + tip1.replace(/\n/g, ' | ').slice(0, 160));
  await page.screenshot({ path: path.join(out, 'B-study-' + lang + '.png') });
  await page.locator('#r-over .bstudy').screenshot({ path: path.join(out, 'B-study-full-' + lang + '.png') });
  await page.mouse.move(5, 5);
  await page.focus('#r-over .bch'); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  const tip2 = await page.evaluate(() => document.querySelector('#r-over .bch-tip').innerText.split('\n')[0]);
  ok(/^(Mac T1|Mar Y1)$/.test(tip2), 'keyboard steps to month 3: ' + tip2);
  await page.click('#r-over [data-act="bench-pick"][data-k="ai-rocket"]'); await page.waitForTimeout(250);
  const pick = await page.evaluate(() => document.querySelector('#r-over .bl-prof b').textContent);
  ok(pick === 'Rocket', 'bench-pick switches the study to Rocket');
  // the tooltip survives the monthly re-render
  const box2 = await page.locator('#r-over .bch svg').boundingBox();
  await page.mouse.move(box2.x + box2.width * 0.30, box2.y + box2.height * 0.5); await page.waitForTimeout(100);
  await setT(page, 26.5); await page.waitForTimeout(700);
  const tip3 = await page.evaluate(() => { const t = document.querySelector('#r-over .bch-tip'); return t && !t.hidden ? t.innerText.split('\n')[0] : ''; });
  ok(!!tip3, 'hover kept after the month changes: ' + tip3);
  await page.mouse.move(5, 5); await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  ok(await page.evaluate(() => !document.querySelector('#r-over .bstudy')), 'Escape closes the study');
  await page.click('#r-tab [data-act="bench-open"]'); await page.waitForTimeout(300);
  await page.click('#r-over [data-act="bench-news"]'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => !document.querySelector('#r-over .bstudy') && /Rocket/.test(document.querySelector('#r-tab .bn-head').textContent)), 'study links to the benchmark news');

  /* 2. News: follow Garden */
  await tab(page, 'news');
  await page.click('#r-tab [data-act="news-src"][data-k="ai-garden"]'); await page.waitForTimeout(250);
  const news = await page.evaluate(() => document.querySelector('#r-tab').innerText);
  ok(/(Suku 4, Tahun 2|Quarter 4, Year 2)/.test(news) && !/(Suku 1, Tahun 3|Quarter 1, Year 3)/.test(news), 'news digest stops at the last full quarter before the current one');
  ok(/(Kenapa|Why):/.test(news), 'news gives the principle behind first moves');
  await page.locator('#r-tab').screenshot({ path: path.join(out, 'B-news-' + lang + '.png') });

  /* 3. Deal reveal with the benchmarks' choices */
  const evId = await page.evaluate(() => { const G = window.IMPAK, g = G.store().game, sc = G.scenG(g); return sc.events.filter((e) => e.month <= 26).slice(-1)[0].id; });
  await setT(page, 26.5, { lastReveal: evId }); await page.waitForTimeout(400);
  const deal = await page.evaluate(() => { const d = document.querySelector('#r-over .bdeal'); return d ? d.innerText : ''; });
  ok(/Garden/.test(deal) && /(wajar|sound)/.test(deal), 'deal reveal lists the benchmark choices: ' + deal.replace(/\n/g, ' | ').slice(0, 160));
  await page.locator('#r-over .deal').screenshot({ path: path.join(out, 'B-deal-' + lang + '.png') });

  /* 4. Final card and transcript */
  await page.evaluate(async () => { const G = window.IMPAK, st = G.store(), g = st.game, sc = G.scenG(g); const closed = {}; for (const p of G.pausePoints(sc)) closed[p.id] = true; await st.gmUpdate({ status: 'ended', closed, lastReveal: null, accMs: sc.months * g.msPerMonth }); st._cache = null; G.APP.ui.seenReveal = null; });
  await page.waitForTimeout(900);
  const fin = await page.evaluate(() => { const d = document.querySelector('#r-over .debrief'); return d ? d.innerText : ''; });
  ok(/(Cara pendahulu membina park|How the leading benchmark built its park)/i.test(fin), 'final debrief has the leading-benchmark section');
  await page.evaluate(() => { const d = document.querySelector('#r-over .debrief'); if (d) d.scrollIntoView(); });
  await page.locator('#r-over .debrief').screenshot({ path: path.join(out, 'B-debrief-' + lang + '.png') });
  const [popup] = await Promise.all([ctx.waitForEvent('page'), page.click('#r-over [data-act="transcript"]')]);
  await popup.waitForLoadState(); await popup.waitForTimeout(300);
  const tr = await popup.evaluate(() => document.body.innerText);
  ok(/Cara pendahulu membina park/.test(tr) || /How the leading benchmark built its park/.test(tr), 'transcript has the section');
  await popup.pdf({ path: path.join(out, 'B-transcript-' + lang + '.pdf'), format: 'A4', printBackground: true });
  await ctx.close();

  /* 5. Dark theme and phone width */
  ({ ctx, page } = await open({ width: 1280, height: 860 }, 'dark'));
  await setT(page, 40.5); await tab(page, 'stand'); await page.waitForTimeout(300);
  await page.click('#r-tab [data-act="bench-open"]'); await page.waitForTimeout(350);
  const b2 = await page.locator('#r-over .bch svg').boundingBox(); await page.mouse.move(b2.x + b2.width * 0.5, b2.y + b2.height * 0.4); await page.waitForTimeout(150);
  await page.locator('#r-over .bch').screenshot({ path: path.join(out, 'B-chart-dark-' + lang + '.png') });
  await ctx.close();
  ({ ctx, page } = await open({ width: 390, height: 844 }));
  await setT(page, 40.5); await tab(page, 'stand'); await page.waitForTimeout(300);
  await page.click('#r-tab [data-act="bench-open"]'); await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(out, 'B-study-phone-' + lang + '.png') });
  const over = await page.evaluate(() => { const s = document.querySelector('#r-over .bstudy'); return s.scrollWidth - s.clientWidth; });
  ok(over <= 1, 'no horizontal overflow on a phone (' + over + ' px)');
  await ctx.close();

  console.log(errors.length ? errors.join('\n') : 'no console errors');
  console.log(fails ? fails + ' FAILURES' : 'all browser checks passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
