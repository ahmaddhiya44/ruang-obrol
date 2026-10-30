'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { Server } = require('socket.io');

const ROOM_DEFINITIONS = [
  {
    id: 'umum',
    name: 'Ruang Umum',
    emoji: '💬',
    description: 'Obrolan santai untuk semua orang.',
  },
  {
    id: 'teknologi',
    name: 'Teknologi',
    emoji: '💻',
    description: 'Diskusi kode, gadget, dan ide digital.',
  },
  {
    id: 'kampus',
    name: 'Kampus',
    emoji: '🎓',
    description: 'Info tugas, kelas, dan kehidupan kampus.',
  },
];

const USER_COLORS = [
  '#e85d3f',
  '#2a7f62',
  '#3f6fd8',
  '#9c4fbc',
  '#b37b16',
  '#b84a73',
  '#177e89',
  '#d1495b',
];

const MAX_NAME_LENGTH = 24;
const MAX_MESSAGE_LENGTH = 500;
const MESSAGE_COOLDOWN_MS = 250;
const TYPING_TIMEOUT_MS = 2500;

/**
 * Membersihkan nama dari karakter kontrol dan spasi berlebih.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeName(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
}

/**
 * Membersihkan isi pesan. Baris baru dipertahankan agar pesan multiline
 * tetap nyaman dibaca, tetapi karakter kontrol lain dibuang.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeMessage(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u2028\u2029]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Warna avatar ditentukan dari nama agar konsisten antara preview di
 * halaman login dan avatar setelah bergabung.
 * @param {string} name
 * @returns {string}
 */
function colorForName(name) {
  let hash = 0;
  for (const character of name.toLowerCase()) {
    hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  }
  return USER_COLORS[hash % USER_COLORS.length];
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    color: user.color,
    joinedAt: user.joinedAt,
  };
}

function makeSystemMessage(roomId, text) {
  return {
    id: crypto.randomUUID(),
    type: 'system',
    roomId,
    text,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Membuat instance server chat tanpa langsung menjalankannya.
 * Pemisahan ini memudahkan pengujian otomatis dengan port acak.
 *
 * @param {{ historyLimit?: number }} [options]
 */
function createChatServer(options = {}) {
  const historyLimit = Math.max(1, options.historyLimit || 80);
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    maxHttpBufferSize: 100_000,
    pingTimeout: 20_000,
    pingInterval: 25_000,
  });

  /** @type {Map<string, {id: string, name: string, emoji: string, description: string, messages: object[]}>} */
  const rooms = new Map(
    ROOM_DEFINITIONS.map((definition) => [
      definition.id,
      {
        ...definition,
        messages: [
          makeSystemMessage(
            definition.id,
            `Selamat datang di ${definition.name}. Mulai percakapan pertama!`,
          ),
        ],
      },
    ]),
  );

  /** @type {Map<string, {id: string, name: string, color: string, roomId: string, joinedAt: number}>} */
  const users = new Map();
  /** @type {Set<string>} */
  const typingUsers = new Set();
  /** @type {Map<string, NodeJS.Timeout>} */
  const typingTimers = new Map();

  app.disable('x-powered-by');
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/api/health', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'ruangobrol',
      rooms: rooms.size,
      online: users.size,
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  function roomUsers(roomId) {
    return [...users.values()]
      .filter((user) => user.roomId === roomId)
      .sort((first, second) => first.joinedAt - second.joinedAt)
      .map(publicUser);
  }

  function serializeRoom(room) {
    return {
      id: room.id,
      name: room.name,
      emoji: room.emoji,
      description: room.description,
      online: roomUsers(room.id).length,
    };
  }

  function buildRoomList() {
    return [...rooms.values()].map(serializeRoom);
  }

  function appendMessage(room, message) {
    room.messages.push(message);
    if (room.messages.length > historyLimit) {
      room.messages.splice(0, room.messages.length - historyLimit);
    }
  }

  function broadcastPresence(roomId) {
    io.to(roomId).emit('presence:update', {
      roomId,
      users: roomUsers(roomId),
    });
    io.emit('rooms:update', buildRoomList());
  }

  function broadcastTyping(roomId) {
    const activeUsers = [...typingUsers]
      .map((socketId) => users.get(socketId))
      .filter((user) => user && user.roomId === roomId)
      .map(publicUser);

    io.to(roomId).emit('typing:update', {
      roomId,
      users: activeUsers,
    });
  }

  function clearTyping(socket, shouldBroadcast = true) {
    const timer = typingTimers.get(socket.id);
    if (timer) {
      clearTimeout(timer);
      typingTimers.delete(socket.id);
    }

    const wasTyping = typingUsers.delete(socket.id);
    const user = users.get(socket.id);
    if (wasTyping && shouldBroadcast && user) {
      broadcastTyping(user.roomId);
    }
  }

  function startTyping(socket) {
    const user = users.get(socket.id);
    if (!user) return;

    const wasTyping = typingUsers.has(socket.id);
    typingUsers.add(socket.id);

    const existingTimer = typingTimers.get(socket.id);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      typingUsers.delete(socket.id);
      typingTimers.delete(socket.id);
      const currentUser = users.get(socket.id);
      if (currentUser) broadcastTyping(currentUser.roomId);
    }, TYPING_TIMEOUT_MS);

    // Jangan menahan proses Node.js hanya karena indikator mengetik.
    timer.unref?.();
    typingTimers.set(socket.id, timer);

    if (!wasTyping) broadcastTyping(user.roomId);
  }

  function stopTyping(socket) {
    clearTyping(socket);
  }

  function reply(ack, payload) {
    if (typeof ack === 'function') ack(payload);
  }

  io.on('connection', (socket) => {
    socket.emit('rooms:list', buildRoomList());

    socket.on('session:join', (payload = {}, ack) => {
      if (users.has(socket.id)) {
        reply(ack, { ok: false, error: 'Sesi ini sudah bergabung ke sebuah ruang.' });
        return;
      }

      if (!payload || typeof payload !== 'object') {
        reply(ack, { ok: false, error: 'Data bergabung tidak valid.' });
        return;
      }

      const name = normalizeName(payload.name);
      const roomId = typeof payload.roomId === 'string' ? payload.roomId : 'umum';
      const room = rooms.get(roomId);

      if (name.length < 2) {
        reply(ack, { ok: false, error: 'Nama minimal terdiri dari 2 karakter.' });
        return;
      }

      if (!room) {
        reply(ack, { ok: false, error: 'Ruang obrolan tidak ditemukan.' });
        return;
      }

      const duplicateName = [...users.values()].some(
        (user) => user.roomId === roomId && user.name.toLowerCase() === name.toLowerCase(),
      );

      if (duplicateName) {
        reply(ack, {
          ok: false,
          error: 'Nama tersebut sudah dipakai di ruang ini. Gunakan nama lain.',
        });
        return;
      }

      const user = {
        id: socket.id,
        name,
        color: colorForName(name),
        roomId,
        joinedAt: Date.now(),
      };

      users.set(socket.id, user);
      socket.join(roomId);

      const joinMessage = makeSystemMessage(roomId, `${name} bergabung ke ruang ini.`);
      appendMessage(room, joinMessage);

      reply(ack, {
        ok: true,
        user: publicUser(user),
        room: serializeRoom(room),
        rooms: buildRoomList(),
        users: roomUsers(roomId),
        history: room.messages.slice(),
      });

      // Pengirim sudah menerima riwayat lengkap lewat ack, jadi system message
      // hanya dikirim ke anggota lain agar tidak tampil dua kali.
      socket.to(roomId).emit('chat:message', joinMessage);
      broadcastPresence(roomId);
    });

    socket.on('room:switch', (payload = {}, ack) => {
      const user = users.get(socket.id);
      if (!user) {
        reply(ack, { ok: false, error: 'Kamu belum bergabung ke ruang obrolan.' });
        return;
      }

      const roomId = payload && typeof payload.roomId === 'string' ? payload.roomId : '';
      if (!rooms.has(roomId)) {
        reply(ack, { ok: false, error: 'Ruang obrolan tidak ditemukan.' });
        return;
      }

      if (roomId === user.roomId) {
        reply(ack, {
          ok: true,
          room: serializeRoom(rooms.get(roomId)),
          rooms: buildRoomList(),
          users: roomUsers(roomId),
          history: rooms.get(roomId).messages.slice(),
        });
        return;
      }

      const duplicateName = [...users.values()].some(
        (otherUser) =>
          otherUser.id !== user.id &&
          otherUser.roomId === roomId &&
          otherUser.name.toLowerCase() === user.name.toLowerCase(),
      );

      if (duplicateName) {
        reply(ack, {
          ok: false,
          error: 'Nama kamu sudah dipakai di ruang tujuan. Pilih nama lain saat masuk.',
        });
        return;
      }

      const previousRoomId = user.roomId;
      clearTyping(socket);
      socket.leave(previousRoomId);

      const leaveMessage = makeSystemMessage(
        previousRoomId,
        `${user.name} berpindah ke ruang lain.`,
      );
      appendMessage(rooms.get(previousRoomId), leaveMessage);
      io.to(previousRoomId).emit('chat:message', leaveMessage);

      user.roomId = roomId;
      socket.join(roomId);

      const room = rooms.get(roomId);
      const joinMessage = makeSystemMessage(roomId, `${user.name} bergabung ke ruang ini.`);
      appendMessage(room, joinMessage);

      reply(ack, {
        ok: true,
        room: serializeRoom(room),
        rooms: buildRoomList(),
        users: roomUsers(roomId),
        history: room.messages.slice(),
      });

      socket.to(roomId).emit('chat:message', joinMessage);
      broadcastPresence(previousRoomId);
      broadcastPresence(roomId);
    });

    socket.on('chat:message', (payload = {}, ack) => {
      const user = users.get(socket.id);
      if (!user) {
        reply(ack, { ok: false, error: 'Kamu belum bergabung ke ruang obrolan.' });
        return;
      }

      const text = normalizeMessage(payload && payload.text);
      if (!text) {
        reply(ack, { ok: false, error: 'Pesan tidak boleh kosong.' });
        return;
      }

      if (text.length > MAX_MESSAGE_LENGTH) {
        reply(ack, {
          ok: false,
          error: `Pesan maksimal ${MAX_MESSAGE_LENGTH} karakter.`,
        });
        return;
      }

      const now = Date.now();
      if (now - (socket.data.lastMessageAt || 0) < MESSAGE_COOLDOWN_MS) {
        reply(ack, { ok: false, error: 'Pesan dikirim terlalu cepat. Coba lagi sebentar.' });
        return;
      }
      socket.data.lastMessageAt = now;

      stopTyping(socket);

      const message = {
        id: crypto.randomUUID(),
        type: 'user',
        roomId: user.roomId,
        userId: user.id,
        name: user.name,
        color: user.color,
        text,
        timestamp: new Date(now).toISOString(),
      };

      appendMessage(rooms.get(user.roomId), message);
      io.to(user.roomId).emit('chat:message', message);
      reply(ack, { ok: true, id: message.id, timestamp: message.timestamp });
    });

    socket.on('typing:start', () => {
      if (users.has(socket.id)) startTyping(socket);
    });

    socket.on('typing:stop', () => {
      if (users.has(socket.id)) stopTyping(socket);
    });

    socket.on('disconnect', () => {
      const user = users.get(socket.id);
      if (!user) return;

      clearTyping(socket);
      users.delete(socket.id);

      const leaveMessage = makeSystemMessage(user.roomId, `${user.name} keluar dari ruang.`);
      appendMessage(rooms.get(user.roomId), leaveMessage);
      io.to(user.roomId).emit('chat:message', leaveMessage);
      broadcastPresence(user.roomId);
    });
  });

  function close() {
    for (const timer of typingTimers.values()) clearTimeout(timer);
    typingTimers.clear();
    typingUsers.clear();

    return new Promise((resolve) => {
      io.close(() => resolve());
    });
  }

  return { app, httpServer, io, close };
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';
  const server = createChatServer();

  server.httpServer.listen(port, host, () => {
    console.log('');
    console.log('  RuangObrol — chat real-time via WebSocket');
    console.log(`  Buka di browser: http://localhost:${port}`);
    console.log(`  Health check  : http://localhost:${port}/api/health`);
    console.log('');
    console.log('  Tekan Ctrl+C untuk menghentikan server.');
    console.log('');
  });

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  createChatServer,
  ROOM_DEFINITIONS,
  MAX_MESSAGE_LENGTH,
};
