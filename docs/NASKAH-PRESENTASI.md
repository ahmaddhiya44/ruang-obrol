# Naskah Presentasi RuangObrol

**Durasi: ±4 menit 30 detik**  
Ganti bagian `[Nama]` dengan nama kamu. Teks dalam tanda kurung siku adalah arahan, bukan kalimat yang dibaca.

## Persiapan sebelum tampil

1. Jalankan `npm start`, lalu buka `http://localhost:3000` di dua tab.
2. Masuk sebagai **Alya** di tab pertama dan **Bima** di tab kedua, keduanya di **Ruang Umum**.
3. Pastikan pesan dari tab A muncul di tab B sebelum presentasi dimulai.
4. Buka `docs/screenshots/` sebagai cadangan jika demo gagal.
5. Jika ingin menampilkan kode, siapkan `public/app.js` di baris 7 dan `server.js` di baris 434.

---

## 0:00–0:20 — Pembuka

Selamat pagi/siang, Bapak/Ibu dan teman-teman. Saya **[Nama]**. Hari ini saya akan mempresentasikan aplikasi chat real-time bernama **RuangObrol**.

Aplikasi ini dibuat untuk menerapkan komunikasi socket antara client dan server. Fokusnya bukan hanya tampilan chat, tetapi bagaimana pesan dapat berpindah dari satu browser ke browser lain secara langsung.

## 0:20–0:45 — Masalah dan solusi

Pada aplikasi chat yang hanya memakai HTTP, browser harus terus-menerus bertanya ke server apakah ada pesan baru. Cara tersebut kurang efisien.

Karena itu, saya menggunakan **WebSocket**. WebSocket adalah koneksi dua arah yang tetap terbuka di atas TCP. Dengan koneksi ini, server dapat langsung mengirim pesan ke client tanpa menunggu permintaan baru dari client.

## 0:45–1:15 — Arsitektur

Arsitekturnya terdiri dari dua sisi.

Di sisi client, ada HTML, CSS, dan JavaScript yang berjalan di browser. Di sisi server, ada **Node.js**, **Express**, dan **Socket.IO**. Express menyajikan antarmuka web, sedangkan Socket.IO menangani komunikasi real-time.

Server menyimpan daftar pengguna, daftar ruang, riwayat pesan sementara, dan status mengetik di memori. Tersedia tiga ruang, yaitu Ruang Umum, Teknologi, dan Kampus.

## 1:15–1:45 — Alur komunikasi

Saat halaman dibuka, client melakukan handshake WebSocket. Setelah terhubung, client mengirim event `session:join` berisi nama dan ruang.

Server memvalidasi data, lalu memanggil `socket.join(roomId)`. Server mengirim balik acknowledgment berisi data pengguna dan riwayat ruang.

Ketika client mengirim `chat:message`, server menyimpan pesan lalu menyiarkannya dengan:

```js
io.to(user.roomId).emit('chat:message', message);
```

Artinya, hanya client di ruang yang sama yang menerima pesan. Selain pesan, ada event `presence:update` untuk daftar online dan `typing:update` untuk indikator mengetik.

## 1:45–2:45 — Demo chat real-time

*(Beralih ke browser. Pastikan tab Alya dan Bima terlihat.)*

Sekarang saya coba langsung. Saya sudah membuka dua tab: **Alya** dan **Bima**, keduanya berada di Ruang Umum.

*(Ketik dari tab Alya, lalu Enter.)*

> Halo Bima, ini pesan real-time!

Perhatikan, pesan langsung muncul di tab Bima **tanpa refresh**. Sekarang saya balas dari tab Bima.

*(Ketik dari tab Bima, lalu Enter.)*

> Diterima tanpa refresh!

Pesan juga langsung masuk ke tab Alya. Ini menunjukkan komunikasi dua arah melalui koneksi WebSocket.

## 2:45–3:15 — Demo typing dan pindah ruang

*(Mulai mengetik di tab Bima, jangan langsung dikirim.)*

> Saya sedang mengetik sebuah pesan...

Di tab Alya muncul keterangan **“Bima sedang mengetik”**. Status ini dikirim melalui event `typing:start`, lalu server menyiarkannya ke anggota ruang yang sama.

*(Hapus input, lalu pindahkan Bima ke ruang Teknologi.)*

Selanjutnya saya pindahkan Bima ke ruang **Teknologi**. Pesan dari Ruang Umum tidak ikut masuk ke sini karena server memisahkan koneksi berdasarkan room. Jika Bima kembali ke Ruang Umum, riwayat percakapan sebelumnya masih tersedia.

## 3:15–3:45 — Bagian kode

*(Tunjukkan file kode secara singkat.)*

Di sisi client, koneksi saya batasi ke WebSocket melalui konfigurasi `transports: ['websocket']` di `public/app.js`.

Di server, bagian inti pengiriman pesan ada di `server.js`, yaitu `io.to(user.roomId).emit('chat:message', message)`.

Server juga memvalidasi nama, panjang pesan, nama yang duplikat, dan membatasi pengiriman pesan yang terlalu cepat. Di sisi tampilan, pesan dirender menggunakan `textContent`, sehingga input pengguna tidak dieksekusi sebagai HTML.

## 3:45–4:15 — Pengujian

Untuk pengujian, saya membuat **enam pengujian integrasi**, dan semuanya lulus.

Pengujian tersebut memeriksa komunikasi dua client melalui WebSocket, isolasi pesan antarrruang, validasi input, indikator mengetik, daftar online, dan perpindahan ruang.

Pengujian UI juga mendeteksi koneksi WebSocket aktif dengan URL:

```text
ws://.../socket.io/?EIO=4&transport=websocket
```

Tangkapan layar dan hasil pengujian lengkap tersedia di folder `docs`.

## 4:15–4:30 — Penutup

Jadi, kesimpulannya: **RuangObrol berhasil menerapkan komunikasi socket antara client dan server**. WebSocket memungkinkan pertukaran pesan dua arah secara instan tanpa refresh, sedangkan Socket.IO memudahkan pengelolaan room, event, acknowledgment, dan reconnection.

Keterbatasan saat ini adalah data masih disimpan di memori dan belum ada autentikasi. Untuk pengembangan berikutnya, aplikasi dapat ditambahkan database, login pengguna, serta HTTPS/WSS.

Terima kasih.

---

## Jika waktu hanya 3 menit

- Lewati bagian kode.
- Demo cukup: kirim satu pesan dari Alya, balas dari Bima, dan tampilkan indikator mengetik.
- Langsung ke hasil pengujian dan penutup.

## Jika ada pertanyaan

**Kenapa memakai WebSocket?**  
Karena chat membutuhkan komunikasi dua arah secara langsung. WebSocket menjaga koneksi tetap terbuka sehingga server dapat mendorong pesan tanpa menunggu request baru.

**TCP atau UDP?**  
WebSocket berjalan di atas TCP. Chat membutuhkan pesan yang lengkap dan berurutan, sehingga TCP lebih tepat daripada UDP.

**Kenapa Socket.IO, bukan WebSocket murni?**  
Socket.IO menyediakan room, acknowledgment, reconnection, dan API event di atas transport WebSocket. Pada proyek ini, koneksi client tetap dibatasi ke WebSocket.

**Bagaimana pesan tidak bocor ke ruang lain?**  
Server hanya menyiarkan pesan ke room terkait menggunakan `io.to(roomId).emit(...)`.

**Apa keterbatasan aplikasi?**  
Riwayat masih di memori dan hilang saat server restart. Aplikasi juga belum memiliki autentikasi serta penyimpanan database.
