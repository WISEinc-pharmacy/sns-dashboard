// ローカル検証: 認証ゲート版。未ログインで loginGate が表示され、JSエラーが出ないことを確認。
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
  page.on('console', (m) => { if (m.type() === 'error' && !/firestore|network|ERR_|401|403|Failed to load/i.test(m.text())) errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const loginVisible = await page.locator('#loginGate:not(.hidden)').count();
  const loginBtn = await page.locator('#loginBtn').count();
  await page.screenshot({ path: path.join(ROOT, 'verify_screenshot.png') });
  await browser.close();
  server.close();
  console.log(`loginGateVisible=${loginVisible} loginBtn=${loginBtn}`);
  console.log(errors.length ? 'JS ERRORS:\n' + errors.join('\n') : 'no blocking JS errors');
  process.exitCode = errors.length || !loginVisible ? 1 : 0;
});
