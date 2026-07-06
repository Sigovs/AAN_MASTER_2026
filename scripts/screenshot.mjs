// Phase 6 QA self-verification. Serves the prototype and captures:
//  - fold matrix: hero full/compact at 1920x1080, 1440x900, 390x844 (viewport)
//  - 3-skin full pages (index + design-system)
//  - header transparent-at-top vs frosted-after-scroll
//  - mobile 390 + 768 (both pages)
//  - reduced-motion emulated pass
//  - skip-link focused (keyboard reveal)
// Output → ./screenshots/ (gitignored).
//
//   node scripts/screenshot.mjs
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const PORT = 5175;
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.md': 'text/plain',
};

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const data = await readFile(join(ROOT, normalize(p)));
    res.writeHead(200, { 'content-type': TYPES[extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('404');
  }
});
await new Promise((r) => server.listen(PORT, r));
await mkdir('screenshots', { recursive: true });

const base = `http://localhost:${PORT}`;
const shots = [];
const browser = await chromium.launch();

async function settle(page, skin) {
  if (skin) await page.evaluate((s) => document.documentElement.setAttribute('data-skin', s), skin);
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(500);
}
async function shoot(page, name, fullPage = false) {
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage });
  shots.push(`${name}.png`);
}
async function setHero(page, mode) {
  await page.evaluate((m) => {
    const h = document.querySelector('.hero');
    h.classList.remove('hero--full', 'hero--compact');
    h.classList.add('hero--' + m);
  }, mode);
  await page.waitForTimeout(300);
}

// Fold matrix — full & compact at three sizes (viewport-only).
const sizes = [[1920, 1080], [1440, 900], [390, 844]];
for (const [w, h] of sizes) {
  for (const mode of ['full', 'compact']) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
    await settle(page, 'obsidian');
    await setHero(page, mode);
    await shoot(page, `fold-${mode}-${w}x${h}`);
    await page.close();
  }
}

// 3-skin full pages.
for (const [file, prefix] of [['index.html', 'index'], ['design-system.html', 'ds']]) {
  for (const skin of ['obsidian', 'gallery', 'midnight']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/${file}`, { waitUntil: 'networkidle' });
    await settle(page, skin);
    await shoot(page, `${prefix}-${skin}`, true);
    await page.close();
  }
}

// Header states.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await settle(page, 'obsidian');
  await shoot(page, 'header-top-transparent');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(500);
  await shoot(page, 'header-scrolled-frosted');
  await page.close();
}

// Mobile passes — 390 + 768 (both pages, obsidian).
for (const w of [390, 768]) {
  for (const [file, prefix] of [['index.html', 'index'], ['design-system.html', 'ds']]) {
    const page = await browser.newPage({ viewport: { width: w, height: w === 390 ? 844 : 1024 } });
    await page.goto(`${base}/${file}`, { waitUntil: 'networkidle' });
    await settle(page, 'obsidian');
    await shoot(page, `${prefix}-mobile-${w}`, true);
    await page.close();
  }
}

// Reduced-motion emulated pass (index, full page).
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await settle(page, 'obsidian');
  await shoot(page, 'index-reduced-motion', true);
  await ctx.close();
}

// Skip-link focused (keyboard reveal).
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await settle(page, 'obsidian');
  await page.keyboard.press('Tab'); // first focusable = skip link
  await page.waitForTimeout(200);
  await shoot(page, 'skip-link-focused');
  await page.close();
}

// Iconography + live-contrast verification (element clips, obsidian + gallery).
for (const skin of ['obsidian', 'gallery']) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.goto(`${base}/design-system.html`, { waitUntil: 'networkidle' });
  await settle(page, skin);
  for (const [sel, name] of [['#iconography', `icons-${skin}`], ['#colors', `foundations-contrast-${skin}`]]) {
    const el = await page.$(sel);
    if (el) await el.screenshot({ path: `screenshots/${name}.png` });
    shots.push(`${name}.png`);
  }
  await page.close();
}

// Index featured cards (icon pins) — obsidian.
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await settle(page, 'obsidian');
  const el = await page.$('#featured');
  if (el) await el.screenshot({ path: 'screenshots/featured-icons.png' });
  shots.push('featured-icons.png');
  await page.close();
}

// DS sidebar overhaul — grouped nav in three skins.
for (const skin of ['obsidian', 'gallery', 'midnight']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(`${base}/design-system.html`, { waitUntil: 'networkidle' });
  await settle(page, skin);
  const nav = await page.$('.ds-nav');
  if (nav) await nav.screenshot({ path: `screenshots/ds-sidebar-${skin}.png` });
  shots.push(`ds-sidebar-${skin}.png`);
  await page.close();
}

// DS sidebar — scrolled into Components (accordion follows the active section).
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(`${base}/design-system.html`, { waitUntil: 'networkidle' });
  await settle(page, 'obsidian');
  await page.evaluate(() => document.getElementById('forms').scrollIntoView());
  await page.waitForTimeout(500);
  const nav = await page.$('.ds-nav');
  if (nav) await nav.screenshot({ path: 'screenshots/ds-sidebar-scrolled.png' });
  shots.push('ds-sidebar-scrolled.png');
  await page.close();
}

// DS sidebar — filtered search state.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(`${base}/design-system.html`, { waitUntil: 'networkidle' });
  await settle(page, 'obsidian');
  await page.fill('#ds-nav-search', 'car');
  await page.waitForTimeout(200);
  const nav = await page.$('.ds-nav');
  if (nav) await nav.screenshot({ path: 'screenshots/ds-sidebar-filtered.png' });
  shots.push('ds-sidebar-filtered.png');
  await page.close();
}

// DS viewport previews — Vehicle Card + Forms + Quick-search in MOBILE.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  await page.goto(`${base}/design-system.html`, { waitUntil: 'networkidle' });
  await settle(page, 'obsidian');
  const vcBtn = await page.$('#vehicle-card [data-viewport-set="mobile"]');
  if (vcBtn) { await vcBtn.click(); await page.waitForTimeout(400); }
  const vcVp = await page.$('#vehicle-card .ds-viewport');
  if (vcVp) await vcVp.screenshot({ path: 'screenshots/vp-vehicle-mobile.png' });
  shots.push('vp-vehicle-mobile.png');
  const formBtns = await page.$$('#forms [data-viewport-set="mobile"]');
  for (const b of formBtns) await b.click();
  await page.waitForTimeout(400);
  const formVps = await page.$$('#forms .ds-viewport');
  if (formVps[0]) await formVps[0].screenshot({ path: 'screenshots/vp-form-mobile.png' });
  if (formVps[1]) await formVps[1].screenshot({ path: 'screenshots/vp-quicksearch-mobile.png' });
  shots.push('vp-form-mobile.png', 'vp-quicksearch-mobile.png');
  await page.close();
}

// ============================================================================
// LAYOUT INVARIANT SCAN — programmatic assertions at 1920 + 390 on BOTH pages.
// Fails loudly (non-zero exit). See CLAUDE.md "Layout invariants". A run isn't
// done while any invariant fails.
// ============================================================================
const failures = [];
const fail = (inv, msg) => failures.push(`[${inv}] ${msg}`);
const INV_PAGES = ['index.html', 'design-system.html'];
const INV_SIZES = [[1920, 1080], [390, 844]];

// Invariants 1 (overflow), 2 (rhythm), 3 (imgs) — one pass per page × size.
for (const file of INV_PAGES) {
  for (const [w, h] of INV_SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${base}/${file}`, { waitUntil: 'networkidle' });
    await settle(page, 'obsidian');
    const r = await page.evaluate((vw) => {
      const res = { overflow: null, rhythm: [], imgs: [] };
      const isClipped = (el) => {
        let a = el.parentElement;
        while (a) { const ox = getComputedStyle(a).overflowX; if (ox === 'hidden' || ox === 'auto' || ox === 'scroll' || ox === 'clip') return true; a = a.parentElement; }
        return false;
      };
      // 1. horizontal page overflow
      const sw = document.documentElement.scrollWidth;
      if (sw > vw + 1) {
        const off = [];
        for (const el of document.body.querySelectorAll('*')) {
          const b = el.getBoundingClientRect();
          if (b.right > vw + 1 && getComputedStyle(el).position !== 'fixed' && !isClipped(el))
            off.push((el.tagName + '.' + (el.className || '').toString().split(' ')[0]).slice(0, 40) + ':' + Math.round(b.right));
        }
        res.overflow = { sw, offenders: [...new Set(off)].slice(0, 6) };
      }
      // 2. section rhythm — every .section + the footer: bottom > top
      for (const el of document.querySelectorAll('section.section, .site-footer')) {
        const c = getComputedStyle(el);
        let pt = parseFloat(c.paddingTop), pb = parseFloat(c.paddingBottom);
        if (el.classList.contains('site-footer')) { const lg = el.querySelector('.site-footer__legal'); if (lg) pb = parseFloat(getComputedStyle(lg).paddingBottom); }
        if (pt > 0 && pb > 0 && pb <= pt) res.rhythm.push(`${el.id || el.className.split(' ')[0]} pt=${Math.round(pt)} pb=${Math.round(pb)}`);
      }
      // 3. every rendered <img> has real dimensions (nothing invisible)
      for (const img of document.querySelectorAll('img')) {
        if (img.getClientRects().length === 0) continue; // display:none — legitimately hidden
        const b = img.getBoundingClientRect();
        if (b.width < 1 || b.height < 1) res.imgs.push((img.getAttribute('alt') || img.currentSrc || 'img').slice(0, 40) + ` ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      return res;
    }, w);
    if (r.overflow) fail('1', `${file}@${w}: scrollWidth=${r.overflow.sw} > ${w} — ${r.overflow.offenders.join(', ')}`);
    for (const v of r.rhythm) fail('2', `${file}@${w}: ${v} (bottom not > top)`);
    for (const v of r.imgs) fail('3', `${file}@${w}: ${v}`);
    await page.close();
  }
}

// Invariant 4 — hero fold contracts (index, both modes, both sizes).
for (const [w, h] of INV_SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await settle(page, 'obsidian');
  for (const mode of ['full', 'compact']) {
    await setHero(page, mode);
    const m = await page.evaluate(() => {
      const hero = document.querySelector('.hero');
      const next = document.querySelector('#quick-search');
      return { vh: window.innerHeight, heroH: hero.getBoundingClientRect().height, nextTop: next.getBoundingClientRect().top };
    });
    if (mode === 'full') {
      if (m.heroH < m.vh - 2) fail('4', `index@${w} full: hero ${Math.round(m.heroH)} < viewport ${m.vh} (should fill)`);
      if (m.nextTop < m.vh - 2) fail('4', `index@${w} full: next section top ${Math.round(m.nextTop)} < ${m.vh} — fold bleed`);
    } else {
      if (m.heroH >= m.vh) fail('4', `index@${w} compact: hero ${Math.round(m.heroH)} >= viewport ${m.vh} (should be shorter)`);
      if (m.nextTop >= m.vh) fail('4', `index@${w} compact: next section top ${Math.round(m.nextTop)} >= ${m.vh} (should peek)`);
    }
  }
  await page.close();
}

// Invariant 5 — live AA contrast rows green in every skin (DS page).
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/design-system.html`, { waitUntil: 'networkidle' });
  for (const skin of ['obsidian', 'gallery', 'midnight']) {
    await page.click(`[data-skin-set="${skin}"]`);
    await page.waitForTimeout(300);
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('[data-contrast]')].map((e) => ({
        label: e.getAttribute('data-fg') + ' on ' + e.getAttribute('data-bg'),
        ratio: (e.querySelector('[data-contrast-ratio]') || {}).textContent,
        pass: e.classList.contains('is-pass'),
      }))
    );
    if (!rows.length) fail('5', `${skin}: no contrast rows found`);
    for (const row of rows) if (!row.pass) fail('5', `${skin}: ${row.label} = ${row.ratio}`);
  }
  await page.close();
}

// Invariant 6 — no desktop grid gaps leaking into a mobile field stack: within
// any stacked field container at 390, adjacent field gaps must not exceed
// 2× $form-row-gap (20px → 40px). Catches "flex-basis-as-height in a column".
const FORM_ROW_GAP = 20;
for (const file of INV_PAGES) {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto(`${base}/${file}`, { waitUntil: 'networkidle' });
  await settle(page, 'obsidian');
  const bad = await page.evaluate((maxGap) => {
    const out = [];
    for (const stack of document.querySelectorAll('.filters, .form-stack, .filters__actions')) {
      const cs = getComputedStyle(stack);
      if (cs.display !== 'flex' || cs.flexDirection !== 'column') continue; // only vertical stacks
      const fields = [...stack.children].filter((c) => c.matches('.filters__field, .form-field, .form-row, .filters__actions'));
      for (let i = 1; i < fields.length; i++) {
        const gap = fields[i].getBoundingClientRect().top - fields[i - 1].getBoundingClientRect().bottom;
        if (gap > maxGap) out.push(`${(stack.className || '').split(' ')[0]} gap ${Math.round(gap)} > ${maxGap}`);
      }
    }
    return out;
  }, FORM_ROW_GAP * 2);
  for (const v of bad) fail('6', `${file}@390: ${v}`);
  await page.close();
}

await browser.close();
server.close();
console.log('SCREENSHOTS:\n' + shots.join('\n'));

// ---- Invariant report -------------------------------------------------------
const INVARIANTS = [
  ['1', 'No horizontal page overflow'],
  ['2', 'Section rhythm (bottom padding > top)'],
  ['3', 'Every <img> renders with real dimensions'],
  ['4', 'Hero fold contracts hold (full = no bleed, compact = peek)'],
  ['5', 'Live AA contrast rows green in every skin'],
  ['6', 'Mobile field stacks: no gap > 2× $form-row-gap'],
];
console.log('\n===== LAYOUT INVARIANT SCAN  (1920 + 390, both pages) =====');
for (const [num, name] of INVARIANTS) {
  const fs = failures.filter((f) => f.startsWith(`[${num}]`));
  console.log(`  ${fs.length === 0 ? 'PASS' : 'FAIL'}  ${num}. ${name}`);
  for (const f of fs) console.log(`         ${f.replace(/^\[\d\]\s*/, '')}`);
}
if (failures.length) {
  console.error(`\n✗ INVARIANT SCAN FAILED — ${failures.length} violation(s). A run isn't done while any invariant fails.`);
  process.exitCode = 1;
} else {
  console.log(`\n✓ All ${INVARIANTS.length} layout invariants PASS.`);
}
