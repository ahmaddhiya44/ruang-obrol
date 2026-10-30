'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { io: createClient } = require('socket.io-client');
const { createChatServer, MAX_MESSAGE_LENGTH } = require('../server');

async function setupServer(t) {
  const server = createChatServer({ historyLimit: 30 });
  await new Promise((resolve, reject) => {
    server.httpServer.once('error', reject);
    server.httpServer.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.httpServer.address();
  const url = `http://127.0.0.1:${port}`;
  const clients = new Set();

  t.after(async () => {
    for (const client of clients) client.disconnect();
    await server.close();
  });

  async function connectClient() {
    const client = createClient(url, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: 3000,
    });
    clients.add(client);

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Koneksi Socket.IO timeout')), 4000);
      client.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      client.once('connect_error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    return client;
  }

  return { server, url, connectClient };
}

function emitWithAck(client, event, payload) {
  return new Promise((resolve, reject) => {
    client.timeout(4000).emit(event, payload, (error, response) => {
      if (error) {
        reject(new Error(`Ack timeout untuk event "${event}"`));
        return;
      }
      resolve(response);
    });
  });
}

function waitForEvent(client, event, predicate = () => true, timeout = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(event, listener);
      reject(new Error(`Event "${event}" tidak diterima dalam ${timeout} ms`));
    }, timeout);

    const listener = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      client.off(event, listener);
      resolve(payload);
    };

    client.on(event, listener);
  });
}

function expectSilence(client, event, duration = 300) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(event, listener);
      resolve();
    }, duration);

    const listener = (payload) => {
      clearTimeout(timer);
      client.off(event, listener);
      reject(new Error(`Tidak boleh menerima event "${event}": ${JSON.stringify(payload)}`));
    };

    client.on(event, listener);
  });
}

test('server menyajikan antarmuka web dan health check', async (t) => {
  const { url } = await setupServer(t);

  const healthResponse = await fetch(`${url}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.match(healthResponse.headers.get('content-type'), /application\/json/);

  const health = await healthResponse.json();
  assert.equal(health.status, 'ok');
  assert.equal(health.rooms, 3);
  assert.equal(health.online, 0);

  const pageResponse = await fetch(`${url}/`);
  assert.equal(pageResponse.status, 200);
  assert.match(pageResponse.headers.get('content-type'), /text\/html/);

  const html = await pageResponse.text();
  assert.match(html, /RuangObrol/);
  assert.match(html, /\/socket\.io\/socket\.io\.js/);
  assert.match(html, /id="login-form"/);
  assert.match(html, /id="messages"/);
});

test('dua client dapat bertukar pesan secara real-time melalui WebSocket', async (t) => {
  const { connectClient } = await setupServer(t);
  const alya = await connectClient();
  const bima = await connectClient();

  assert.equal(alya.io.engine.transport.name, 'websocket');
  assert.equal(bima.io.engine.transport.name, 'websocket');

  const alyaJoin = await emitWithAck(alya, 'session:join', {
    name: 'Alya',
    roomId: 'umum',
  });
  assert.equal(alyaJoin.ok, true);
  assert.equal(alyaJoin.user.name, 'Alya');
  assert.equal(alyaJoin.room.id, 'umum');
  assert.ok(Array.isArray(alyaJoin.history));

  const bimaJoin = await emitWithAck(bima, 'session:join', {
    name: 'Bima',
    roomId: 'umum',
  });
  assert.equal(bimaJoin.ok, true);
  assert.deepEqual(
    bimaJoin.users.map((user) => user.name).sort(),
    ['Alya', 'Bima'],
  );

  const alyaReceives = waitForEvent(
    alya,
    'chat:message',
    (message) => message.type === 'user' && message.text === 'Halo, Bima!',
  );
  const bimaReceives = waitForEvent(
    bima,
    'chat:message',
    (message) => message.type === 'user' && message.text === 'Halo, Bima!',
  );

  const sendResult = await emitWithAck(alya, 'chat:message', {
    text: 'Halo, Bima!',
  });
  assert.equal(sendResult.ok, true);

  const [receivedBySender, receivedByOther] = await Promise.all([alyaReceives, bimaReceives]);
  assert.equal(receivedBySender.id, receivedByOther.id);
  assert.equal(receivedByOther.name, 'Alya');
  assert.equal(receivedByOther.roomId, 'umum');
  assert.equal(receivedByOther.userId, alyaJoin.user.id);

  const replyPromise = waitForEvent(
    alya,
    'chat:message',
    (message) => message.type === 'user' && message.text === 'Halo juga!',
  );
  const replyResult = await emitWithAck(bima, 'chat:message', { text: 'Halo juga!' });
  assert.equal(replyResult.ok, true);

  const reply = await replyPromise;
  assert.equal(reply.name, 'Bima');
});

test('pesan tidak bocor ke ruang lain dan riwayat tersedia setelah pindah ruang', async (t) => {
  const { connectClient } = await setupServer(t);
  const alya = await connectClient();
  const citra = await connectClient();

  await emitWithAck(alya, 'session:join', { name: 'Alya', roomId: 'umum' });
  await emitWithAck(citra, 'session:join', { name: 'Citra', roomId: 'teknologi' });

  const ownMessage = waitForEvent(
    alya,
    'chat:message',
    (message) => message.type === 'user' && message.text === 'Pesan khusus ruang umum',
  );
  const noLeak = expectSilence(citra, 'chat:message');

  await emitWithAck(alya, 'chat:message', { text: 'Pesan khusus ruang umum' });
  await ownMessage;
  await noLeak;

  const switchResult = await emitWithAck(citra, 'room:switch', { roomId: 'umum' });
  assert.equal(switchResult.ok, true);
  assert.equal(switchResult.room.id, 'umum');
  assert.ok(
    switchResult.history.some(
      (message) => message.type === 'user' && message.text === 'Pesan khusus ruang umum',
    ),
    'Riwayat ruang tujuan harus memuat pesan sebelumnya',
  );
  assert.deepEqual(
    switchResult.users.map((user) => user.name).sort(),
    ['Alya', 'Citra'],
  );
});

test('server memvalidasi nama, ruang, pesan kosong, dan pesan terlalu panjang', async (t) => {
  const { connectClient } = await setupServer(t);
  const client = await connectClient();
  const unjoined = await connectClient();

  const emptyName = await emitWithAck(client, 'session:join', { name: ' ', roomId: 'umum' });
  assert.equal(emptyName.ok, false);
  assert.match(emptyName.error, /minimal/i);

  const invalidRoom = await emitWithAck(client, 'session:join', {
    name: 'Dewi',
    roomId: 'ruang-yang-tidak-ada',
  });
  assert.equal(invalidRoom.ok, false);
  assert.match(invalidRoom.error, /tidak ditemukan/i);

  const unjoinedMessage = await emitWithAck(unjoined, 'chat:message', { text: 'Halo?' });
  assert.equal(unjoinedMessage.ok, false);
  assert.match(unjoinedMessage.error, /belum bergabung/i);

  const joinResult = await emitWithAck(client, 'session:join', {
    name: 'Dewi',
    roomId: 'umum',
  });
  assert.equal(joinResult.ok, true);

  const emptyMessage = await emitWithAck(client, 'chat:message', { text: '   ' });
  assert.equal(emptyMessage.ok, false);

  const tooLong = await emitWithAck(client, 'chat:message', {
    text: 'x'.repeat(MAX_MESSAGE_LENGTH + 1),
  });
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.error, new RegExp(String(MAX_MESSAGE_LENGTH)));

  const duplicate = await emitWithAck(unjoined, 'session:join', {
    name: 'dewi',
    roomId: 'umum',
  });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /sudah dipakai/i);

  const safeText = 'Teks <b>tebal</b> & simbol aman.';
  const echoes = waitForEvent(
    client,
    'chat:message',
    (message) => message.type === 'user' && message.text === safeText,
  );
  const safeSend = await emitWithAck(client, 'chat:message', { text: safeText });
  assert.equal(safeSend.ok, true);
  assert.equal((await echoes).text, safeText);
});

test('indikator mengetik dan daftar online ikut diperbarui saat client keluar', async (t) => {
  const { connectClient } = await setupServer(t);
  const alya = await connectClient();
  const bima = await connectClient();

  await emitWithAck(alya, 'session:join', { name: 'Alya', roomId: 'umum' });
  await emitWithAck(bima, 'session:join', { name: 'Bima', roomId: 'umum' });

  const typingOn = waitForEvent(
    alya,
    'typing:update',
    (payload) => payload.users.some((user) => user.name === 'Bima'),
  );
  bima.emit('typing:start');
  const typingEvent = await typingOn;
  assert.equal(typingEvent.roomId, 'umum');

  const typingOff = waitForEvent(
    alya,
    'typing:update',
    (payload) => payload.users.length === 0,
  );
  bima.emit('typing:stop');
  await typingOff;

  const leaveMessage = waitForEvent(
    alya,
    'chat:message',
    (message) => message.type === 'system' && message.text.includes('Bima keluar'),
  );
  const presenceAfterLeave = waitForEvent(
    alya,
    'presence:update',
    (payload) => payload.users.length === 1 && payload.users[0].name === 'Alya',
  );

  bima.disconnect();
  const [message, presence] = await Promise.all([leaveMessage, presenceAfterLeave]);
  assert.match(message.text, /Bima keluar dari ruang/);
  assert.equal(presence.users[0].name, 'Alya');
});

test('client dapat berpindah ruang dan presence kedua ruang diperbarui', async (t) => {
  const { connectClient } = await setupServer(t);
  const alya = await connectClient();
  const bima = await connectClient();

  await emitWithAck(alya, 'session:join', { name: 'Alya', roomId: 'umum' });
  await emitWithAck(bima, 'session:join', { name: 'Bima', roomId: 'teknologi' });

  const presenceInUmum = waitForEvent(
    alya,
    'presence:update',
    (payload) => payload.users.length === 2,
  );
  const switchResult = await emitWithAck(bima, 'room:switch', { roomId: 'umum' });
  assert.equal(switchResult.ok, true);

  const presence = await presenceInUmum;
  assert.deepEqual(
    presence.users.map((user) => user.name).sort(),
    ['Alya', 'Bima'],
  );

  const duplicateSwitch = await emitWithAck(
    alya,
    'session:join',
    { name: 'Alya', roomId: 'teknologi' },
  );
  assert.equal(duplicateSwitch.ok, false, 'Socket yang sudah bergabung tidak dapat join ulang');
});
