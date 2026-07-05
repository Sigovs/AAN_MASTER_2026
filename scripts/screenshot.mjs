// Self-verification: serve the prototype and capture full-page screenshots of
// index.html + design-system.html across all three skins, plus hero-compact,
// a mobile pass, and viewport-only fold checks. Output → ./screenshots/.
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
    const file = join(ROOT, normalize(p));
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream' });
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
async function shoot(page, name, fullPage = true) {
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage });
  shots.push(`${name}.png`);
}

const skins = ['obsidian', 'gallery', 'aurum'];
for (const [file, prefix] of [['index.html', 'index'], ['design-system.html', 'ds']]) {
  for (const skin of skins) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/${file}`, { waitUntil: 'networkidle' });
    await settle(page, skin);
    await shoot(page, `${prefix}-${skin}`);
    await page.close();
  }
}

// index — hero compact (full page)
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const h = document.querySelector('.hero');
    h.classList.remove('hero--full');
    h.classList.add('hero--compact');
  });
  await settle(page, 'obsidian');
  await shoot(page, 'index-hero-compact');
  await page.close();
}

// Fold checks (viewport-only) — full should show ZERO bleed; compact should peek.
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await settle(page, 'obsidian');
  await shoot(page, 'index-fold-full', false);
  await page.evaluate(() => {
    const h = document.querySelector('.hero');
    h.classList.remove('hero--full');
    h.classList.add('hero--compact');
  });
  await page.waitForTimeout(300);
  await shoot(page, 'index-fold-compact', false);
  await page.close();
}

// Header states — transparent at top vs frosted after scroll.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await settle(page, 'obsidian');
  await shoot(page, 'header-top-transparent', false);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(500);
  await shoot(page, 'header-scrolled-frosted', false);
  await page.close();
}

// Mobile pass — 390px wide
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await settle(page, 'obsidian');
  await shoot(page, 'index-mobile-390');
  await page.close();
}

await browser.close();
server.close();
console.log('SCREENSHOTS:\n' + shots.join('\n'));
