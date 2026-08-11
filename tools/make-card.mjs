/**
 * Renders the social share card by photographing the game itself.
 *
 *   node tools/make-card.mjs
 *
 * Slack, Discord and the rest will not render SVG in a link preview, so this
 * one image is the single generated binary in the repository. It is produced
 * from our own renderer by our own tool, so it stays honest and it stays up to
 * date: change the title screen, run this, and the card follows.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 8163);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };

const server = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const rel = normalize(url === '/' ? '/index.html' : url).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, rel));
    res.writeHead(200, { 'Content-Type': MIME[extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const { chromium } = await import(process.env.PW_MODULE || 'playwright');
/* `PW_BROWSER` for the same reason `verify.mjs` has it: on a machine where the
 * browsers were installed somewhere other than Playwright's default, the launch
 * fails with an install prompt that does not apply. This tool needed it the
 * first time the title art changed and the card had to be rebuilt. */
const browser = await chromium.launch(
  process.env.PW_BROWSER ? { executablePath: process.env.PW_BROWSER } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

await page.evaluate(() => {
  // Let the title screen settle on a frame where the cast is on screen.
  window.sfb3.toTitle();
  for (let i = 0; i < 40; i++) window.sfb3.step();
  window.sfb3.render();

  const game = document.getElementById('game');
  const card = document.createElement('canvas');
  card.width = 1200;
  card.height = 630;
  card.id = 'card';
  card.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(card);

  const g = card.getContext('2d');
  g.imageSmoothingEnabled = false;
  const grad = g.createLinearGradient(0, 0, 0, 630);
  grad.addColorStop(0, '#101830');
  grad.addColorStop(1, '#20402a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1200, 630);

  // The game, pixel-doubled and centred, with room to breathe.
  const scale = 2;
  const w = game.width * scale;
  const h = game.height * scale;
  const x = Math.round((1200 - w) / 2);
  const y = Math.round((630 - h) / 2) + 10;
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(x - 8, y - 8, w + 16, h + 16);
  g.drawImage(game, x, y, w, h);
  g.strokeStyle = '#8fe04a';
  g.lineWidth = 4;
  g.strokeRect(x - 8, y - 8, w + 16, h + 16);
});

const card = await page.$('#card');
await card.screenshot({ path: join(ROOT, 'card.png') });
await browser.close();
server.close();

const bytes = (await readFile(join(ROOT, 'card.png'))).length;
console.log(`\n  card.png kirjoitettu, ${Math.round(bytes / 1024)} kt (1200x630)\n`);
