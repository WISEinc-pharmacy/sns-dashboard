// ローカル検証: 静的サーバを立ててヘッドレスブラウザで表示確認+スクリーンショット
// 使い方: node scripts/verify_local.mjs（要: AI_secretary_reikaのplaywright）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const { chromium } = require('C:/Users/WISE-Yamauchi/node_modules/playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const cards = await page.locator('#cards .card').count();
  const hasSvg = await page.locator('#chart svg').count();
  const rows = await page.locator('#contents-table tbody tr').count();
  const updated = await page.locator('#updated').textContent();
  await page.screenshot({ path: path.join(ROOT, 'verify_screenshot.png'), fullPage: true });
  await page.locator('.tab[data-tab="lme"]').click();
  await page.waitForTimeout(300);
  const lmeRows = await page.locator('#contents-table tbody tr').count();
  await browser.close();
  server.close();
  console.log(`cards=${cards} chartSvg=${hasSvg} youtubeRows=${rows} lmeRows=${lmeRows} updated="${updated}"`);
  console.log(errors.length ? 'JS ERRORS:\n' + errors.join('\n') : 'no JS errors');
  process.exitCode = errors.length || cards < 4 || !hasSvg ? 1 : 0;
});
