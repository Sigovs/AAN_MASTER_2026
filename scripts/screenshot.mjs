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
  for (const skin of ['obsidian', 'gallery', 'aurum']) {
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
  for (const [sel, name] of [['#iconography', `icons-${skin}`], ['#foundations', `foundations-contrast-${skin}`]]) {
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
for (const skin of ['obsidian', 'gallery', 'aurum']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(`${base}/design-system.html`, { waitUntil: 'networkidle' });
  await settle(page, skin);
  const nav = await page.$('.ds-nav');
  if (nav) await nav.screenshot({ path: `screenshots/ds-sidebar-${skin}.png` });
  shots.push(`ds-sidebar-${skin}.png`);
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

await browser.close();
server.close();
console.log('SCREENSHOTS:\n' + shots.join('\n'));
