'use strict';

/**
 * Mengambil tangkapan layar sekaligus menjalankan pemeriksaan UI end-to-end.
 * Script memakai Google Chrome/Chromium yang sudah terpasang di komputer.
 *
 *   npm run screenshots
 */

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { createChatServer } = require('../server');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const screenshotDirectory = path.join(__dirname, '..', 'docs', 'screenshots');

function findChrome() {
  const executable = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!executable) {
    throw new Error(
      'Google Chrome/Chromium tidak ditemukan. Set CHROME_PATH ke executable browser.',
    );
  }
  return executable;
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.httpServer.once('error', reject);
    server.httpServer.listen(0, '127.0.0.1', resolve);
  });
  return server.httpServer.address().port;
}

async function login(page, baseUrl, name) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('#login-status[data-state="online"]');
  await page.waitForSelector('.room-option');
  await page.fill('#name-input', name);
  await page.locator('.room-option input[value="umum"]').check();
  await page.click('#join-btn');
  await page.waitForSelector('#chat-screen:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('.online-user').length > 0);
}

async function sendMessage(page, text) {
  await page.fill('#message-input', text);
  await page.press('#message-input', 'Enter');
  await page.waitForFunction(
    (expectedText) =>
      [...document.querySelectorAll('.bubble-text')].some(
        (element) => element.textContent === expectedText,
      ),
    text,
  );
}

async function run() {
  fs.mkdirSync(screenshotDirectory, { recursive: true });

  const server = createChatServer();
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({
    executablePath: findChrome(),
    headless: true,
  });

  const problems = [];
  const sockets = [];
  const contexts = [];

  try {
    const contextA = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
    });
    contexts.push(contextA);
    const pageA = await contextA.newPage();
    pageA.on('websocket', (socket) => sockets.push(socket.url()));
    pageA.on('pageerror', (error) => problems.push(`Page error A: ${error.message}`));
    pageA.on('console', (message) => {
      if (message.type() === 'error') problems.push(`Console error A: ${message.text()}`);
    });

    await pageA.goto(baseUrl, { waitUntil: 'networkidle' });
    await pageA.waitForSelector('#login-status[data-state="online"]');
    await pageA.waitForSelector('.room-option');
    await pageA.fill('#name-input', 'Alya Putri');
    await pageA.locator('.room-option input[value="umum"]').check();
    await pageA.evaluate(() => document.activeElement?.blur());
    await pageA.waitForTimeout(450);
    await pageA.screenshot({
      path: path.join(screenshotDirectory, '01-halaman-login.png'),
    });

    const contextB = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
    });
    contexts.push(contextB);
    const pageB = await contextB.newPage();

    const contextC = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
    });
    contexts.push(contextC);
    const pageC = await contextC.newPage();

    await login(pageA, baseUrl, 'Alya Putri');
    await login(pageB, baseUrl, 'Bima Saputra');
    await login(pageC, baseUrl, 'Citra Maharani');

    await sendMessage(pageA, 'Halo semua! Selamat datang di RuangObrol 👋');
    await sendMessage(pageB, 'Hai Alya! Akhirnya bisa chat tanpa refresh.');
    await sendMessage(pageC, 'WebSocket-nya keren, pesannya langsung muncul ⚡');
    await sendMessage(pageA, 'Iya! Bisa pindah ruang juga lewat sidebar.');
    await sendMessage(pageB, 'Mantap. Nanti aku coba kirim pesan dari HP juga.');

    await pageA.waitForFunction(() => document.querySelectorAll('.online-user').length === 3);
    await pageB.waitForFunction(() => document.querySelectorAll('.online-user').length === 3);

    // Buat indikator mengetik muncul di layar Alya.
    await pageB.click('#message-input');
    await pageB.type('#message-input', 'Aku sedang mengetik pesan baru', { delay: 25 });
    await pageA.waitForFunction(
      () => document.querySelector('#typing-indicator')?.textContent.includes('mengetik'),
      null,
      { timeout: 3000 },
    );
    await pageA.waitForTimeout(250);
    await pageA.screenshot({
      path: path.join(screenshotDirectory, '02-ruang-chat.png'),
    });

    await pageB.fill('#message-input', '');
    await pageB.waitForTimeout(350);
    await pageB.screenshot({
      path: path.join(screenshotDirectory, '03-tampilan-client-kedua.png'),
    });

    await pageA.setViewportSize({ width: 390, height: 844 });
    await pageA.waitForTimeout(450);
    await pageA.screenshot({
      path: path.join(screenshotDirectory, '04-tampilan-mobile.png'),
    });

    // Pemeriksaan UI tambahan: menu mobile dan perpindahan ruang.
    await pageA.click('#open-sidebar');
    await pageA.waitForFunction(() =>
      document.querySelector('#chat-screen')?.classList.contains('sidebar-open'),
    );
    await pageA.waitForTimeout(250);
    await pageA.screenshot({
      path: path.join(screenshotDirectory, '05-menu-mobile.png'),
    });
    await pageA.click('#close-sidebar');
    await pageA.waitForFunction(
      () => !document.querySelector('#chat-screen')?.classList.contains('sidebar-open'),
    );

    await pageA.setViewportSize({ width: 1440, height: 900 });
    await pageA.click('.room-item[data-room-id="teknologi"]');
    await pageA.waitForFunction(
      () => document.querySelector('#header-name')?.textContent === 'Teknologi',
    );
    await pageA.click('.room-item[data-room-id="umum"]');
    await pageA.waitForFunction(
      () => document.querySelector('#header-name')?.textContent === 'Ruang Umum',
    );

    if (!sockets.some((socketUrl) => socketUrl.includes('/socket.io/'))) {
      problems.push('Tidak ada koneksi WebSocket Socket.IO yang terdeteksi.');
    }

    await pageA.screenshot({
      path: path.join(screenshotDirectory, '06-perpindahan-ruang.png'),
    });

    if (problems.length) {
      throw new Error(`Pemeriksaan UI gagal:\n- ${problems.join('\n- ')}`);
    }

    console.log('✓ UI login, chat, typing, mobile menu, dan perpindahan ruang berjalan.');
    console.log('✓ Koneksi WebSocket terdeteksi:', sockets[0]);
    console.log('✓ Tangkapan layar tersimpan di docs/screenshots/');
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
