'use strict';

/* global io */

const socket = io({
  autoConnect: false,
  transports: ['websocket'],
});

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

const EMOJIS = [
  '😊',
  '😂',
  '😍',
  '🤔',
  '😅',
  '👍',
  '👏',
  '🙌',
  '🔥',
  '✨',
  '💡',
  '💻',
  '🎉',
  '❤️',
  '🙏',
  '👀',
  '🚀',
  '☕',
];

const DEFAULT_HINT = '2–24 karakter, tanpa perlu daftar akun.';
const GROUP_WINDOW_MS = 4 * 60 * 1000;

const elements = {
  loginScreen: document.getElementById('login-screen'),
  loginForm: document.getElementById('login-form'),
  nameInput: document.getElementById('name-input'),
  nameHint: document.getElementById('name-hint'),
  loginAvatar: document.getElementById('login-avatar'),
  roomPicker: document.getElementById('room-picker'),
  joinBtn: document.getElementById('join-btn'),
  loginStatus: document.getElementById('login-status'),
  loginStatusText: document.getElementById('login-status-text'),

  chatScreen: document.getElementById('chat-screen'),
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
  openSidebar: document.getElementById('open-sidebar'),
  closeSidebar: document.getElementById('close-sidebar'),
  connectionChip: document.getElementById('connection-chip'),
  connectionText: document.getElementById('connection-text'),
  roomList: document.getElementById('room-list'),
  onlineCount: document.getElementById('online-count'),
  onlineList: document.getElementById('online-list'),
  profileAvatar: document.getElementById('profile-avatar'),
  profileName: document.getElementById('profile-name'),
  leaveBtn: document.getElementById('leave-btn'),

  headerEmoji: document.getElementById('header-emoji'),
  headerName: document.getElementById('header-name'),
  headerDescription: document.getElementById('header-description'),
  headerAvatars: document.getElementById('header-avatars'),
  headerOnline: document.getElementById('header-online'),
  offlineBanner: document.getElementById('offline-banner'),
  messagesWrap: document.getElementById('messages-wrap'),
  messages: document.getElementById('messages'),
  typingIndicator: document.getElementById('typing-indicator'),

  messageForm: document.getElementById('message-form'),
  messageInput: document.getElementById('message-input'),
  sendBtn: document.getElementById('send-btn'),
  charCount: document.getElementById('char-count'),
  emojiBtn: document.getElementById('emoji-btn'),
  emojiPopover: document.getElementById('emoji-popover'),

  toastContainer: document.getElementById('toast-container'),
};

const state = {
  rooms: [],
  selectedRoomId: 'umum',
  currentRoomId: null,
  currentRoom: null,
  users: [],
  messages: [],
  user: null,
  joined: false,
  connected: false,
  joining: false,
  reconnecting: false,
  switchingRoom: false,
  typingActive: false,
  typingTimer: null,
  typingRefreshTimer: null,
  typingUsers: [],
};

function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join('').toUpperCase();

  const first = Array.from(parts[0])[0] || '';
  const last = Array.from(parts[parts.length - 1])[0] || '';
  return `${first}${last}`.toUpperCase();
}

function colorForName(name) {
  let hash = 0;
  for (const character of String(name || '').toLowerCase()) {
    hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  }
  return USER_COLORS[hash % USER_COLORS.length];
}

function createAvatar(name, color, className) {
  const avatar = document.createElement('span');
  avatar.className = className;
  avatar.textContent = getInitials(name);
  avatar.style.backgroundColor = color;
  avatar.setAttribute('aria-hidden', 'true');
  return avatar;
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Penyimpanan lokal bisa diblokir oleh mode privat; aplikasi tetap berjalan.
  }
}

function updateAvatarPreview() {
  const name = elements.nameInput.value.trim();
  elements.loginAvatar.textContent = getInitials(name);
  elements.loginAvatar.style.backgroundColor = name ? colorForName(name) : 'var(--ink)';
}

function setLoginError(message) {
  elements.nameHint.textContent = message;
  elements.nameHint.classList.add('is-error');
}

function clearLoginError() {
  elements.nameHint.textContent = DEFAULT_HINT;
  elements.nameHint.classList.remove('is-error');
}

function ensureSelectedRoom() {
  if (!state.rooms.length) return;
  const stillExists = state.rooms.some((room) => room.id === state.selectedRoomId);
  if (!stillExists) state.selectedRoomId = state.rooms[0].id;
}

function renderRoomPicker() {
  if (!state.rooms.length) {
    elements.roomPicker.replaceChildren();
    for (let index = 0; index < 3; index += 1) {
      const skeleton = document.createElement('div');
      skeleton.className = 'room-skeleton';
      elements.roomPicker.append(skeleton);
    }
    updateJoinButton();
    return;
  }

  ensureSelectedRoom();
  const fragment = document.createDocumentFragment();

  for (const room of state.rooms) {
    const label = document.createElement('label');
    label.className = 'room-option';
    if (room.id === state.selectedRoomId) label.classList.add('is-selected');

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'room';
    input.value = room.id;
    input.checked = room.id === state.selectedRoomId;

    const emoji = document.createElement('span');
    emoji.className = 'room-option-emoji';
    emoji.textContent = room.emoji;
    emoji.setAttribute('aria-hidden', 'true');

    const name = document.createElement('span');
    name.className = 'room-option-name';
    name.textContent = room.name;

    const online = document.createElement('span');
    online.className = 'room-option-online';
    online.textContent = `${room.online} online`;

    label.append(input, emoji, name, online);
    fragment.append(label);
  }

  elements.roomPicker.replaceChildren(fragment);
  updateJoinButton();
}

function updateSelectedRoomStyles() {
  for (const option of elements.roomPicker.querySelectorAll('.room-option')) {
    const input = option.querySelector('input');
    option.classList.toggle('is-selected', Boolean(input && input.checked));
  }
}

function updateJoinButton() {
  elements.joinBtn.disabled = !state.connected || state.rooms.length === 0 || state.joining;
}

function updateConnectionUI() {
  const offline = !state.connected;
  const busy = state.joined && (state.reconnecting || !state.connected);

  elements.connectionChip.dataset.state = offline ? 'offline' : 'online';
  elements.connectionText.textContent = offline ? 'Terputus · mencoba…' : 'Terhubung · WebSocket';

  if (state.joined) {
    elements.offlineBanner.hidden = !busy;
  } else {
    elements.offlineBanner.hidden = true;
  }

  if (!state.connected) {
    elements.loginStatus.dataset.state = 'offline';
    elements.loginStatusText.textContent = 'Server tidak terhubung. Mencoba lagi…';
  } else {
    elements.loginStatus.dataset.state = 'online';
    elements.loginStatusText.textContent = 'Server terhubung · WebSocket';
  }

  updateJoinButton();
  updateComposerState();
}

function updateComposerState() {
  const disabled = !state.connected || !state.joined || state.reconnecting;
  elements.messageInput.disabled = disabled;
  elements.emojiBtn.disabled = disabled;
  elements.sendBtn.disabled = disabled || !elements.messageInput.value.trim();
}

function showToast(message, { error = false, duration = 4200 } = {}) {
  const toast = document.createElement('div');
  toast.className = `toast${error ? ' is-error' : ''}`;
  toast.textContent = message;
  elements.toastContainer.append(toast);

  while (elements.toastContainer.childElementCount > 3) {
    elements.toastContainer.firstElementChild?.remove();
  }

  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 220);
  }, duration);
}

function scrollMessagesToBottom() {
  window.requestAnimationFrame(() => {
    elements.messagesWrap.scrollTop = elements.messagesWrap.scrollHeight;
  });
}

function isNearBottom() {
  const remaining =
    elements.messagesWrap.scrollHeight -
    elements.messagesWrap.scrollTop -
    elements.messagesWrap.clientHeight;
  return remaining < 140;
}

function sameDay(firstTimestamp, secondTimestamp) {
  const first = new Date(firstTimestamp);
  const second = new Date(secondTimestamp);
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function formatDateLabel(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(date, today)) return 'Hari ini';
  if (sameDay(date, yesterday)) return 'Kemarin';

  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function formatFullDate(timestamp) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function createDateDivider(timestamp) {
  const divider = document.createElement('div');
  divider.className = 'date-divider';
  divider.textContent = formatDateLabel(timestamp);
  return divider;
}

function shouldGroupWithPrevious(message, previous) {
  if (!previous || message.type !== 'user' || previous.type !== 'user') return false;
  if (message.userId !== previous.userId) return false;
  if (!sameDay(message.timestamp, previous.timestamp)) return false;

  const difference = new Date(message.timestamp) - new Date(previous.timestamp);
  return difference >= 0 && difference < GROUP_WINDOW_MS;
}

function createMessageNode(message, previous) {
  if (message.type === 'system') {
    const systemMessage = document.createElement('div');
    systemMessage.className = 'system-message';
    const text = document.createElement('span');
    text.textContent = message.text;
    systemMessage.append(text);
    return systemMessage;
  }

  const isOwn = message.userId === state.user?.id;
  const grouped = shouldGroupWithPrevious(message, previous);

  const article = document.createElement('article');
  article.className = 'message';
  if (isOwn) article.classList.add('is-own');
  if (grouped) article.classList.add('is-grouped');
  article.dataset.messageId = message.id;

  if (!isOwn) {
    if (grouped) {
      const spacer = document.createElement('span');
      spacer.className = 'avatar-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      article.append(spacer);
    } else {
      article.append(createAvatar(message.name, message.color, 'message-avatar'));
    }
  }

  const body = document.createElement('div');
  body.className = 'message-body';

  if (!isOwn && !grouped) {
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const name = document.createElement('strong');
    name.textContent = message.name;
    meta.append(name);
    body.append(meta);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const text = document.createElement('p');
  text.className = 'bubble-text';
  text.textContent = message.text;

  const time = document.createElement('time');
  time.className = 'bubble-time';
  time.dateTime = message.timestamp;
  time.textContent = formatTime(message.timestamp);
  time.title = formatFullDate(message.timestamp);

  bubble.append(text, time);
  body.append(bubble);
  article.append(body);

  return article;
}

function renderMessages() {
  const fragment = document.createDocumentFragment();
  let previous = null;

  for (const message of state.messages) {
    if (!previous || !sameDay(previous.timestamp, message.timestamp)) {
      fragment.append(createDateDivider(message.timestamp));
    }
    fragment.append(createMessageNode(message, previous));
    previous = message;
  }

  if (!state.messages.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-chat';
    empty.innerHTML =
      '<strong>Belum ada pesan</strong><span>Jadilah yang pertama memulai percakapan di ruang ini.</span>';
    fragment.append(empty);
  }

  elements.messages.replaceChildren(fragment);
  scrollMessagesToBottom();
}

function appendMessage(message) {
  const previous = state.messages[state.messages.length - 1] || null;

  if (!previous || !sameDay(previous.timestamp, message.timestamp)) {
    elements.messages.append(createDateDivider(message.timestamp));
  }

  elements.messages.append(createMessageNode(message, previous));
  state.messages.push(message);
}

function renderSidebarRooms() {
  const fragment = document.createDocumentFragment();

  for (const room of state.rooms) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'room-item';
    button.dataset.roomId = room.id;
    if (room.id === state.currentRoomId) {
      button.classList.add('is-active');
      button.setAttribute('aria-current', 'page');
    }

    const emoji = document.createElement('span');
    emoji.className = 'room-item-emoji';
    emoji.textContent = room.emoji;
    emoji.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('span');
    copy.className = 'room-item-copy';
    const name = document.createElement('strong');
    name.textContent = room.name;
    const description = document.createElement('small');
    description.textContent = room.description;
    copy.append(name, description);

    const count = document.createElement('span');
    count.className = 'room-item-count';
    count.textContent = String(room.online);

    button.append(emoji, copy, count);
    button.addEventListener('click', () => switchRoom(room.id));
    fragment.append(button);
  }

  elements.roomList.replaceChildren(fragment);
}

function renderOnlineUsers() {
  elements.onlineCount.textContent = String(state.users.length);
  elements.onlineList.replaceChildren();

  if (!state.users.length) {
    const empty = document.createElement('p');
    empty.className = 'online-empty';
    empty.textContent = 'Belum ada orang lain di sini.';
    elements.onlineList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const user of state.users) {
    const row = document.createElement('div');
    row.className = 'online-user';

    row.append(createAvatar(user.name, user.color, 'avatar avatar--online'));

    const name = document.createElement('span');
    name.className = 'online-name';
    name.textContent = user.name;
    if (user.id === state.user?.id) {
      const you = document.createElement('em');
      you.textContent = ' (Kamu)';
      name.append(you);
    }

    const pip = document.createElement('i');
    pip.className = 'online-pip';
    pip.setAttribute('aria-hidden', 'true');

    row.append(name, pip);
    fragment.append(row);
  }

  elements.onlineList.append(fragment);
}

function renderHeaderPresence() {
  elements.headerOnline.textContent = `${state.users.length} online`;

  const visibleUsers = state.users.slice(0, 3);
  const extra = state.users.length - visibleUsers.length;
  const fragment = document.createDocumentFragment();

  for (const user of visibleUsers) {
    const avatar = document.createElement('span');
    avatar.className = 'mini-avatar';
    avatar.textContent = getInitials(user.name);
    avatar.style.backgroundColor = user.color;
    avatar.title = user.name;
    fragment.append(avatar);
  }

  if (extra > 0) {
    const more = document.createElement('span');
    more.className = 'mini-avatar mini-avatar--more';
    more.textContent = `+${extra}`;
    fragment.append(more);
  }

  elements.headerAvatars.replaceChildren(fragment);
}

function renderHeader() {
  if (!state.currentRoom) return;

  elements.headerEmoji.textContent = state.currentRoom.emoji;
  elements.headerName.textContent = state.currentRoom.name;
  elements.headerDescription.textContent = state.currentRoom.description;
  document.title = `${state.currentRoom.name} · RuangObrol`;
  renderHeaderPresence();
}

function renderProfile() {
  if (!state.user) return;
  elements.profileName.textContent = state.user.name;
  elements.profileAvatar.textContent = getInitials(state.user.name);
  elements.profileAvatar.style.backgroundColor = state.user.color;
}

function renderTypingIndicator() {
  const names = state.typingUsers.map((user) => user.name);
  elements.typingIndicator.replaceChildren();

  if (!names.length) return;

  const dots = document.createElement('span');
  dots.className = 'typing-dots';
  dots.setAttribute('aria-hidden', 'true');
  dots.innerHTML = '<i></i><i></i><i></i>';

  let label;
  if (names.length === 1) {
    label = `${names[0]} sedang mengetik`;
  } else if (names.length === 2) {
    label = `${names[0]} dan ${names[1]} sedang mengetik`;
  } else {
    label = `${names.length} orang sedang mengetik`;
  }

  const text = document.createElement('span');
  text.textContent = label;
  elements.typingIndicator.append(dots, text);
}

function setTypingUsers(users) {
  state.typingUsers = users.filter((user) => user.id !== state.user?.id);
  renderTypingIndicator();

  window.clearTimeout(state.typingRefreshTimer);
  if (state.typingUsers.length) {
    state.typingRefreshTimer = window.setTimeout(() => {
      state.typingUsers = [];
      renderTypingIndicator();
    }, 4000);
  }
}

function stopTyping(emit = true) {
  if (state.typingActive && emit && socket.connected) {
    socket.emit('typing:stop');
  }
  state.typingActive = false;
  window.clearTimeout(state.typingTimer);
  state.typingTimer = null;
}

function closeSidebar() {
  elements.chatScreen.classList.remove('sidebar-open');
  elements.openSidebar.setAttribute('aria-expanded', 'false');
}

function openSidebar() {
  elements.chatScreen.classList.add('sidebar-open');
  elements.openSidebar.setAttribute('aria-expanded', 'true');
}

function hideEmojiPicker() {
  elements.emojiPopover.hidden = true;
  elements.emojiBtn.setAttribute('aria-expanded', 'false');
}

function toggleEmojiPicker() {
  const willOpen = elements.emojiPopover.hidden;
  elements.emojiPopover.hidden = !willOpen;
  elements.emojiBtn.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) {
    elements.emojiPopover.querySelector('button')?.focus();
  }
}

function insertEmoji(emoji) {
  const input = elements.messageInput;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.setRangeText(emoji, start, end, 'end');
  input.focus();
  hideEmojiPicker();
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function buildEmojiPicker() {
  const fragment = document.createDocumentFragment();
  for (const emoji of EMOJIS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = emoji;
    button.setAttribute('aria-label', `Sisipkan emoji ${emoji}`);
    button.addEventListener('click', () => insertEmoji(emoji));
    fragment.append(button);
  }
  elements.emojiPopover.replaceChildren(fragment);
}

function autoGrowInput() {
  const input = elements.messageInput;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 136)}px`;
}

function updateCharCount() {
  const length = elements.messageInput.value.length;
  elements.charCount.textContent = `${length}/500`;
  elements.charCount.classList.toggle('is-visible', length > 0);
  elements.charCount.classList.toggle('is-near-limit', length > 440);
}

function handleInput() {
  autoGrowInput();
  updateCharCount();
  updateComposerState();

  const hasText = Boolean(elements.messageInput.value.trim());
  if (hasText && !state.typingActive && socket.connected) {
    socket.emit('typing:start');
    state.typingActive = true;
  }

  window.clearTimeout(state.typingTimer);
  if (hasText) {
    state.typingTimer = window.setTimeout(() => stopTyping(), 1600);
  } else {
    stopTyping();
  }
}

function submitMessage(event) {
  event.preventDefault();

  if (!socket.connected || !state.joined || state.reconnecting) {
    showToast('Belum terhubung ke server. Tunggu sebentar, ya.', { error: true });
    return;
  }

  const text = elements.messageInput.value.trim();
  if (!text) return;

  if (text.length > 500) {
    showToast('Pesan maksimal 500 karakter.', { error: true });
    return;
  }

  const originalText = elements.messageInput.value;
  stopTyping();

  elements.messageInput.value = '';
  autoGrowInput();
  updateCharCount();
  updateComposerState();

  socket.emit('chat:message', { text }, (response) => {
    if (!response || !response.ok) {
      showToast(response?.error || 'Pesan gagal dikirim. Coba lagi.', { error: true });
      if (!elements.messageInput.value.trim()) {
        elements.messageInput.value = originalText;
        autoGrowInput();
        updateCharCount();
        updateComposerState();
        elements.messageInput.focus();
      }
    }
  });
}

function applySession(response, isRejoin) {
  state.joined = true;
  state.reconnecting = false;
  state.user = response.user;
  state.currentRoomId = response.room.id;
  state.currentRoom = response.room;
  state.selectedRoomId = response.room.id;
  state.rooms = response.rooms;
  state.users = response.users;
  state.messages = response.history;
  state.typingUsers = [];

  writeStorage('ruangobrol:name', response.user.name);
  writeStorage('ruangobrol:room', response.room.id);

  elements.chatScreen.hidden = false;
  elements.loginScreen.hidden = true;
  document.body.classList.add('is-chatting');

  renderHeader();
  renderSidebarRooms();
  renderOnlineUsers();
  renderProfile();
  renderMessages();
  renderTypingIndicator();
  updateConnectionUI();
  hideEmojiPicker();

  if (isRejoin) {
    showToast('Koneksi kembali pulih. Kamu sudah masuk lagi.');
  } else {
    window.setTimeout(() => elements.messageInput.focus(), 250);
  }

  closeSidebar();
}

function requestJoin(name, roomId, isRejoin = false) {
  if (state.joining) return;
  state.joining = true;

  if (!isRejoin) {
    elements.joinBtn.classList.add('is-loading');
    elements.joinBtn.querySelector('span').textContent = 'Menghubungkan…';
  } else {
    state.reconnecting = true;
    updateConnectionUI();
  }
  updateJoinButton();

  socket.timeout(7000).emit('session:join', { name, roomId }, (timeoutError, response) => {
    state.joining = false;

    if (!isRejoin) {
      elements.joinBtn.classList.remove('is-loading');
      elements.joinBtn.querySelector('span').textContent = 'Masuk ke ruang';
      updateJoinButton();
    }

    if (timeoutError) {
      if (isRejoin) {
        state.reconnecting = false;
        updateConnectionUI();
      }
      showToast('Server tidak merespons. Periksa koneksi lalu coba lagi.', { error: true });
      return;
    }

    if (!response || !response.ok) {
      const message = response?.error || 'Tidak dapat bergabung ke ruang.';
      if (isRejoin) {
        state.reconnecting = false;
        updateConnectionUI();
        elements.offlineBanner.hidden = false;
      } else {
        setLoginError(message);
        showToast(message, { error: true });
      }
      return;
    }

    applySession(response, isRejoin);
  });
}

function switchRoom(roomId) {
  if (!state.joined || state.switchingRoom) return;
  if (!socket.connected) {
    showToast('Koneksi terputus. Tunggu hingga tersambung kembali.', { error: true });
    return;
  }
  if (roomId === state.currentRoomId) {
    closeSidebar();
    return;
  }

  state.switchingRoom = true;
  stopTyping();
  socket.timeout(7000).emit('room:switch', { roomId }, (timeoutError, response) => {
    state.switchingRoom = false;

    if (timeoutError) {
      showToast('Perpindahan ruang terlalu lama. Coba lagi.', { error: true });
      return;
    }

    if (!response || !response.ok) {
      showToast(response?.error || 'Tidak dapat berpindah ruang.', { error: true });
      return;
    }

    state.currentRoomId = response.room.id;
    state.currentRoom = response.room;
    state.selectedRoomId = response.room.id;
    state.rooms = response.rooms;
    state.users = response.users;
    state.messages = response.history;
    state.typingUsers = [];

    renderHeader();
    renderSidebarRooms();
    renderOnlineUsers();
    renderMessages();
    renderTypingIndicator();
    closeSidebar();
    elements.messageInput.focus();
  });
}

function handleLoginSubmit(event) {
  event.preventDefault();

  if (!state.connected) {
    showToast('Server belum tersambung. Coba lagi sebentar.', { error: true });
    return;
  }

  const name = elements.nameInput.value.trim();
  const roomId = new FormData(elements.loginForm).get('room');

  if (name.length < 2) {
    setLoginError('Nama minimal terdiri dari 2 karakter.');
    elements.nameInput.focus();
    return;
  }

  if (!roomId || !state.rooms.some((room) => room.id === roomId)) {
    showToast('Pilih ruang obrolan terlebih dahulu.', { error: true });
    return;
  }

  clearLoginError();
  state.selectedRoomId = String(roomId);
  requestJoin(name, state.selectedRoomId, false);
}

function registerSocketEvents() {
  socket.on('connect', () => {
    state.connected = true;

    if (state.joined && state.user && state.currentRoomId) {
      state.reconnecting = true;
      updateConnectionUI();
      requestJoin(state.user.name, state.currentRoomId, true);
    } else {
      updateConnectionUI();
    }
  });

  socket.on('disconnect', () => {
    state.connected = false;
    state.reconnecting = false;
    state.typingActive = false;
    window.clearTimeout(state.typingTimer);
    updateConnectionUI();
  });

  socket.on('connect_error', () => {
    state.connected = false;
    updateConnectionUI();
  });

  socket.on('rooms:list', (rooms) => {
    state.rooms = rooms;
    ensureSelectedRoom();
    if (!state.joined) renderRoomPicker();
  });

  socket.on('rooms:update', (rooms) => {
    state.rooms = rooms;
    ensureSelectedRoom();
    if (state.joined) {
      renderSidebarRooms();
    } else {
      renderRoomPicker();
    }
  });

  socket.on('presence:update', (payload) => {
    if (!state.joined || !payload || payload.roomId !== state.currentRoomId) return;
    state.users = payload.users;
    renderOnlineUsers();
    renderHeaderPresence();
  });

  socket.on('chat:message', (message) => {
    if (!state.joined || !message || message.roomId !== state.currentRoomId) return;

    const wasNearBottom = isNearBottom();
    const isOwn = message.userId === state.user?.id;
    appendMessage(message);

    if (isOwn || wasNearBottom) scrollMessagesToBottom();
  });

  socket.on('typing:update', (payload) => {
    if (!state.joined || !payload || payload.roomId !== state.currentRoomId) return;
    setTypingUsers(payload.users);
  });
}

function registerInterfaceEvents() {
  elements.nameInput.addEventListener('input', () => {
    updateAvatarPreview();
    clearLoginError();
  });

  elements.roomPicker.addEventListener('change', (event) => {
    if (!(event.target instanceof HTMLInputElement) || event.target.name !== 'room') return;
    state.selectedRoomId = event.target.value;
    updateSelectedRoomStyles();
  });

  elements.loginForm.addEventListener('submit', handleLoginSubmit);
  elements.messageForm.addEventListener('submit', submitMessage);

  elements.messageInput.addEventListener('input', handleInput);
  elements.messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      elements.messageForm.requestSubmit();
    }
  });

  elements.emojiBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleEmojiPicker();
  });

  document.addEventListener('click', (event) => {
    if (!elements.emojiPopover.hidden && !event.target.closest('.emoji-wrap')) {
      hideEmojiPicker();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideEmojiPicker();
      closeSidebar();
    }
  });

  elements.openSidebar.addEventListener('click', openSidebar);
  elements.closeSidebar.addEventListener('click', closeSidebar);
  elements.sidebarBackdrop.addEventListener('click', closeSidebar);

  window.addEventListener('resize', () => {
    if (window.innerWidth > 840) closeSidebar();
  });

  elements.leaveBtn.addEventListener('click', () => {
    stopTyping();
    state.joined = false;
    socket.disconnect();
    window.location.reload();
  });
}

function initialize() {
  buildEmojiPicker();
  registerSocketEvents();
  registerInterfaceEvents();

  const savedName = readStorage('ruangobrol:name');
  const savedRoom = readStorage('ruangobrol:room');

  if (savedName) elements.nameInput.value = savedName.slice(0, 24);
  if (savedRoom) state.selectedRoomId = savedRoom;

  updateAvatarPreview();
  updateConnectionUI();
  updateCharCount();
  updateComposerState();

  socket.connect();
}

initialize();
