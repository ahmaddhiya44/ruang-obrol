'use strict';

/**
 * Membuat naskah presentasi RuangObrol dalam format DOCX.
 *
 *   npm run docx
 *
 * Hasil: docs/NASKAH-PRESENTASI.docx
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} = require('docx');

const OUTPUT = path.join(__dirname, '..', 'docs', 'NASKAH-PRESENTASI.docx');

const COLOR = {
  ink: '14162B',
  body: '292B3D',
  muted: '747486',
  coral: 'E85232',
  coralBright: 'FF6B4A',
  cream: 'FBF8F1',
  paper: 'F3EFE6',
  mint: '2A7F62',
  mintSoft: 'EEF7F2',
  line: 'E5DFD3',
  white: 'FFFFFF',
};

const BODY_FONT = 'Calibri';
const DISPLAY_FONT = 'Georgia';
const MONO_FONT = 'Consolas';
const CONTENT_WIDTH = 9638; // A4 dikurangi margin 2 cm kiri dan kanan (dalam twip)

const noBorders = {
  top: { style: BorderStyle.NIL },
  bottom: { style: BorderStyle.NIL },
  left: { style: BorderStyle.NIL },
  right: { style: BorderStyle.NIL },
  insideHorizontal: { style: BorderStyle.NIL },
  insideVertical: { style: BorderStyle.NIL },
};

function bodyRun(text, options = {}) {
  return new TextRun({
    text,
    font: BODY_FONT,
    size: 22,
    color: COLOR.body,
    ...options,
  });
}

function bodyText(text, options = {}) {
  return new Paragraph({
    spacing: { line: 300, after: options.after ?? 110 },
    keepLines: true,
    ...options,
    children: options.runs || [bodyRun(text)],
  });
}

function sectionHeading(time, title) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    spacing: { before: 280, after: 100 },
    children: [
      new TextRun({
        text: time.toUpperCase(),
        font: BODY_FONT,
        size: 17,
        bold: true,
        color: COLOR.coral,
        characterSpacing: 18,
      }),
      new TextRun({
        text: '   /   ',
        font: BODY_FONT,
        size: 17,
        color: 'C9C3B7',
      }),
      new TextRun({
        text: title,
        font: DISPLAY_FONT,
        size: 30,
        bold: true,
        color: COLOR.ink,
      }),
    ],
  });
}

function stageDirection(text) {
  return new Paragraph({
    spacing: { before: 30, after: 100, line: 280 },
    keepLines: true,
    children: [
      new TextRun({
        text: 'ARAH   ',
        font: BODY_FONT,
        size: 15,
        bold: true,
        color: COLOR.coral,
        characterSpacing: 14,
      }),
      new TextRun({
        text,
        font: BODY_FONT,
        size: 19,
        italics: true,
        color: COLOR.muted,
      }),
    ],
  });
}

function spokenText(text) {
  return new Paragraph({
    spacing: { before: 20, after: 105, line: 310 },
    keepLines: true,
    children: [bodyRun(text, { size: 22, color: COLOR.body })],
  });
}

function typedMessage(text) {
  return new Paragraph({
    spacing: { before: 40, after: 100, line: 260 },
    indent: { left: 150, right: 150 },
    shading: {
      type: ShadingType.CLEAR,
      color: 'auto',
      fill: COLOR.mintSoft,
    },
    border: {
      left: { style: BorderStyle.SINGLE, size: 18, color: COLOR.mint },
      top: { style: BorderStyle.NIL },
      bottom: { style: BorderStyle.NIL },
      right: { style: BorderStyle.NIL },
    },
    keepLines: true,
    children: [
      new TextRun({
        text: 'KETIK   ',
        font: BODY_FONT,
        size: 14,
        bold: true,
        color: COLOR.mint,
        characterSpacing: 12,
      }),
      new TextRun({
        text,
        font: MONO_FONT,
        size: 19,
        color: COLOR.ink,
      }),
    ],
  });
}

function codeLine(text) {
  return new Paragraph({
    spacing: { before: 30, after: 20, line: 255 },
    indent: { left: 130, right: 130 },
    shading: {
      type: ShadingType.CLEAR,
      color: 'auto',
      fill: COLOR.paper,
    },
    keepLines: true,
    children: [
      new TextRun({
        text,
        font: MONO_FONT,
        size: 18,
        color: COLOR.ink,
      }),
    ],
  });
}

function quoteBox(children) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: COLOR.cream },
            borders: {
              top: { style: BorderStyle.NIL },
              bottom: { style: BorderStyle.NIL },
              right: { style: BorderStyle.NIL },
              left: { style: BorderStyle.SINGLE, size: 22, color: COLOR.coralBright },
            },
            margins: { top: 180, bottom: 170, left: 280, right: 260 },
            children,
          }),
        ],
      }),
    ],
  });
}

function segment(time, title, blocks) {
  const children = blocks.map((block) => {
    if (block.type === 'stage') return stageDirection(block.text);
    if (block.type === 'type') return typedMessage(block.text);
    if (block.type === 'code') return codeLine(block.text);
    return spokenText(block.text);
  });

  return [sectionHeading(time, title), quoteBox(children)];
}

function callout(title, text, { fill = COLOR.paper, accent = COLOR.coral } = {}) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill },
            borders: {
              top: { style: BorderStyle.NIL },
              bottom: { style: BorderStyle.NIL },
              right: { style: BorderStyle.NIL },
              left: { style: BorderStyle.SINGLE, size: 22, color: accent },
            },
            margins: { top: 170, bottom: 170, left: 260, right: 240 },
            children: [
              new Paragraph({
                spacing: { after: 55 },
                children: [
                  new TextRun({
                    text: title.toUpperCase(),
                    font: BODY_FONT,
                    size: 16,
                    bold: true,
                    color: accent,
                    characterSpacing: 16,
                  }),
                ],
              }),
              ...text.map((item) =>
                new Paragraph({
                  spacing: { after: 45, line: 275 },
                  keepLines: true,
                  children: [bodyRun(item, { size: 20 })],
                }),
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

function simpleTable(rows, { widths, header = true, fontSize = 19 } = {}) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.line },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.line },
      left: { style: BorderStyle.NIL },
      right: { style: BorderStyle.NIL },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: COLOR.line },
      insideVertical: { style: BorderStyle.NIL },
    },
    rows: rows.map((row, rowIndex) => {
      const isHeader = header && rowIndex === 0;
      return new TableRow({
        tableHeader: isHeader,
        children: row.map((cell, cellIndex) =>
          new TableCell({
            width: widths ? { size: widths[cellIndex], type: WidthType.PERCENTAGE } : undefined,
            shading: isHeader
              ? { type: ShadingType.CLEAR, color: 'auto', fill: COLOR.ink }
              : rowIndex % 2 === 0
                ? { type: ShadingType.CLEAR, color: 'auto', fill: COLOR.cream }
                : undefined,
            margins: { top: 100, bottom: 100, left: 130, right: 130 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { after: 0, line: 260 },
                children: [
                  new TextRun({
                    text: String(cell),
                    font: BODY_FONT,
                    size: fontSize,
                    bold: isHeader,
                    color: isHeader ? COLOR.white : COLOR.body,
                  }),
                ],
              }),
            ],
          }),
        ),
      });
    }),
  });
}

function numberedPoint(number, title, detail) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 0, right: 100 },
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: String(number).padStart(2, '0'),
                    font: DISPLAY_FONT,
                    size: 28,
                    bold: true,
                    color: COLOR.coralBright,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 92, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 80, right: 0 },
            children: [
              new Paragraph({
                spacing: { after: 20, line: 270 },
                children: [
                  new TextRun({
                    text: title,
                    font: BODY_FONT,
                    size: 20,
                    bold: true,
                    color: COLOR.ink,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 0, line: 270 },
                children: [bodyRun(detail, { size: 19, color: COLOR.muted })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function infoRow(label, value) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 27, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NIL },
          left: { style: BorderStyle.NIL },
          right: { style: BorderStyle.NIL },
          bottom: { style: BorderStyle.SINGLE, size: 3, color: COLOR.line },
        },
        margins: { top: 95, bottom: 95, left: 0, right: 100 },
        children: [
          new Paragraph({
            spacing: { after: 0 },
            children: [
              new TextRun({
                text: label.toUpperCase(),
                font: BODY_FONT,
                size: 15,
                bold: true,
                color: COLOR.muted,
                characterSpacing: 12,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 73, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NIL },
          left: { style: BorderStyle.NIL },
          right: { style: BorderStyle.NIL },
          bottom: { style: BorderStyle.SINGLE, size: 3, color: COLOR.line },
        },
        margins: { top: 95, bottom: 95, left: 120, right: 0 },
        children: [
          new Paragraph({
            spacing: { after: 0 },
            children: [
              new TextRun({
                text: value,
                font: BODY_FONT,
                size: 20,
                color: COLOR.body,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

const header = new Header({
  children: [
    new Paragraph({
      spacing: { after: 80 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.line },
      },
      tabStops: [{ type: 'right', position: CONTENT_WIDTH }],
      children: [
        new TextRun({
          text: 'RUANGOBROL',
          font: BODY_FONT,
          size: 15,
          bold: true,
          color: COLOR.ink,
          characterSpacing: 18,
        }),
        new TextRun({
          text: '\tNASKAH PRESENTASI',
          font: BODY_FONT,
          size: 14,
          color: COLOR.muted,
          characterSpacing: 12,
        }),
      ],
    }),
  ],
});

const footer = new Footer({
  children: [
    new Paragraph({
      spacing: { before: 60 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.line },
      },
      tabStops: [{ type: 'right', position: CONTENT_WIDTH }],
      children: [
        new TextRun({
          text: 'Pemahaman socket · bobot 20%',
          font: BODY_FONT,
          size: 14,
          color: COLOR.muted,
        }),
        new TextRun({
          children: ['\tHalaman ', PageNumber.CURRENT, ' dari ', PageNumber.TOTAL_PAGES],
          font: BODY_FONT,
          size: 14,
          color: COLOR.muted,
        }),
      ],
    }),
  ],
});

const emptyHeader = new Header({ children: [new Paragraph({ children: [] })] });
const emptyFooter = new Footer({ children: [new Paragraph({ children: [] })] });

const children = [];

// ---------------------------------------------------------------------------
// Sampul
// ---------------------------------------------------------------------------

children.push(
  new Paragraph({
    spacing: { before: 700, after: 260 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 18, color: COLOR.coralBright },
    },
    children: [
      new TextRun({
        text: 'NASKAH PRESENTASI  ·  PEMROGRAMAN SOCKET',
        font: BODY_FONT,
        size: 17,
        bold: true,
        color: COLOR.coral,
        characterSpacing: 24,
      }),
    ],
  }),
  new Paragraph({
    spacing: { before: 300, after: 100 },
    children: [
      new TextRun({
        text: 'RuangObrol',
        font: DISPLAY_FONT,
        size: 72,
        bold: true,
        color: COLOR.ink,
      }),
    ],
  }),
  new Paragraph({
    spacing: { after: 220, line: 300 },
    children: [
      new TextRun({
        text: 'Aplikasi Chat Real-Time Berbasis WebSocket & Socket.IO',
        font: BODY_FONT,
        size: 30,
        color: COLOR.body,
      }),
    ],
  }),
  new Paragraph({
    spacing: { after: 480, line: 310 },
    children: [
      new TextRun({
        text:
          'Naskah presentasi 4 menit 40 detik dengan penekanan pada pemahaman konsep socket, ' +
          'alur komunikasi client-server, demo aplikasi, dan hasil pengujian.',
        font: BODY_FONT,
        size: 21,
        color: COLOR.muted,
      }),
    ],
  }),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: {
              type: ShadingType.CLEAR,
              color: 'auto',
              fill: COLOR.coralBright,
            },
            margins: { top: 150, bottom: 150, left: 200, right: 200 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 0 },
                children: [
                  new TextRun({
                    text: 'PEMAHAMAN SOCKET',
                    font: BODY_FONT,
                    size: 19,
                    bold: true,
                    color: COLOR.white,
                    characterSpacing: 20,
                  }),
                  new TextRun({
                    text: '   ·   BOBOT 20%',
                    font: BODY_FONT,
                    size: 19,
                    bold: true,
                    color: 'FFE0D8',
                    characterSpacing: 20,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  }),
  new Paragraph({ spacing: { after: 400 }, children: [] }),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      infoRow('Nama', '[ .................................................. ]'),
      infoRow('NIM', '[ .................................................. ]'),
      infoRow('Mata Kuliah', 'Pemrograman Socket'),
      infoRow('Dosen Pengampu', '[ .................................................. ]'),
      infoRow('Tanggal', '24 Oktober 2026'),
    ],
  }),
  new Paragraph({
    spacing: { before: 280 },
    children: [
      new TextRun({
        text: 'Ganti bagian di dalam tanda kurung siku sebelum digunakan.',
        font: BODY_FONT,
        size: 15,
        italics: true,
        color: COLOR.muted,
      }),
    ],
  }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ---------------------------------------------------------------------------
// Persiapan dan peta waktu
// ---------------------------------------------------------------------------

children.push(
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 100, after: 100 },
    children: [
      new TextRun({
        text: 'Persiapan & Alur Waktu',
        font: DISPLAY_FONT,
        size: 40,
        bold: true,
        color: COLOR.ink,
      }),
    ],
  }),
  new Paragraph({
    spacing: { after: 220, line: 300 },
    children: [
      bodyRun(
        'Gunakan naskah ini sebagai panduan, bukan untuk dibaca kata per kata. ' +
          'Latih alurnya minimal dua kali, terutama bagian demo dan perpindahan ruang.',
        { color: COLOR.muted },
      ),
    ],
  }),
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 120, after: 90 },
    children: [
      new TextRun({
        text: 'Persiapan sebelum tampil',
        font: BODY_FONT,
        size: 24,
        bold: true,
        color: COLOR.ink,
      }),
    ],
  }),
);

const preparationItems = [
  'Jalankan npm start, lalu buka http://localhost:3000 di dua tab.',
  'Masuk sebagai Alya di tab pertama dan Bima di tab kedua, keduanya di Ruang Umum.',
  'Pastikan pesan dari satu tab sudah muncul di tab lain sebelum presentasi dimulai.',
  'Buka folder docs/screenshots sebagai cadangan jika demo gagal.',
  'Siapkan public/app.js baris 7 dan server.js baris 434 jika akan menunjukkan kode.',
  'Tutup tab lain yang tidak diperlukan agar layar tetap bersih.',
];

preparationItems.forEach((item) => {
  children.push(
    new Paragraph({
      spacing: { after: 55, line: 280 },
      indent: { left: 330 },
      children: [
        new TextRun({
          text: '☐  ',
          font: BODY_FONT,
          size: 22,
          color: COLOR.coralBright,
        }),
        bodyRun(item, { size: 20 }),
      ],
    }),
  );
});

children.push(
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [
      new TextRun({
        text: 'Peta waktu 4 menit 40 detik',
        font: BODY_FONT,
        size: 24,
        bold: true,
        color: COLOR.ink,
      }),
    ],
  }),
  simpleTable(
    [
      ['Waktu', 'Bagian', 'Fokus', 'Durasi'],
      ['0:00–0:20', 'Pembuka', 'Nama, tujuan, dan fokus aplikasi', '20 dtk'],
      ['0:20–1:10', 'Konsep socket', 'Definisi, TCP, handshake, room, broadcast', '50 dtk'],
      ['1:10–1:40', 'Arsitektur', 'Client, Express, Socket.IO, state server', '30 dtk'],
      ['1:40–2:05', 'Alur komunikasi', 'Join, acknowledgment, emit, typing', '25 dtk'],
      ['2:05–3:05', 'Demo chat', 'Dua client bertukar pesan tanpa refresh', '60 dtk'],
      ['3:05–3:30', 'Demo lanjutan', 'Indikator mengetik dan isolasi ruang', '25 dtk'],
      ['3:30–3:55', 'Kode inti', 'WebSocket transport, join, broadcast', '25 dtk'],
      ['3:55–4:20', 'Pengujian', 'Enam tes, URL WebSocket, screenshot', '25 dtk'],
      ['4:20–4:40', 'Penutup', 'Kesimpulan dan keterbatasan', '20 dtk'],
    ],
    { widths: [13, 21, 53, 13], fontSize: 18 },
  ),
  new Paragraph({ spacing: { after: 260 }, children: [] }),
  callout(
    'Fokus penilaian: pemahaman socket (20%)',
    [
      'Jangan hanya menyebut nama event. Jelaskan bahwa socket adalah endpoint komunikasi, ' +
        'WebSocket menjaga koneksi tetap terbuka di atas TCP, dan server mengelola satu socket ' +
        'per client.',
      'Saat demo, hubungkan perilaku aplikasi dengan konsep: socket.join(roomId) memasukkan ' +
        'client ke room, sedangkan io.to(roomId).emit(...) mengirim pesan hanya kepada socket ' +
        'di room tersebut.',
    ],
    { fill: COLOR.mintSoft, accent: COLOR.mint },
  ),
  new Paragraph({ children: [new PageBreak()] }),
);

// ---------------------------------------------------------------------------
// Naskah
// ---------------------------------------------------------------------------

children.push(
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({
        text: 'Naskah Presentasi',
        font: DISPLAY_FONT,
        size: 40,
        bold: true,
        color: COLOR.ink,
      }),
    ],
  }),
  new Paragraph({
    spacing: { after: 180, line: 290 },
    children: [
      bodyRun(
        'Teks di dalam kotak adalah kalimat yang diucapkan. Label ARAH dan KETIK hanya petunjuk ' +
          'panggung dan tidak perlu dibacakan.',
        { color: COLOR.muted, size: 20 },
      ),
    ],
  }),
);

const segments = [
  {
    time: '0:00–0:20',
    title: 'Pembuka',
    blocks: [
      {
        text:
          'Selamat pagi/siang, Bapak/Ibu dan teman-teman. Saya [Nama]. Hari ini saya akan ' +
          'mempresentasikan aplikasi chat real-time bernama RuangObrol.',
      },
      {
        text:
          'Aplikasi ini dibuat untuk menerapkan komunikasi socket antara client dan server. ' +
          'Fokusnya bukan hanya tampilan chat, tetapi bagaimana pesan dapat berpindah dari satu ' +
          'browser ke browser lain secara langsung.',
      },
    ],
  },
  {
    time: '0:20–1:10',
    title: 'Konsep Socket — Bagian Penilaian 20%',
    blocks: [
      {
        type: 'stage',
        text: 'Berhenti sejenak. Bagian ini paling menentukan penilaian pemahaman socket.',
      },
      {
        text:
          'Sebelum masuk ke aplikasi, saya jelaskan dulu konsep socket yang menjadi dasar proyek ini.',
      },
      {
        text:
          'Socket adalah endpoint komunikasi antara dua proses di jaringan. Pada proyek ini, satu ' +
          'socket di server terhubung dengan satu socket di browser. Bedanya dengan HTTP biasa: ' +
          'HTTP membuat koneksi untuk satu request, lalu koneksi itu selesai. WebSocket ' +
          'mempertahankan koneksi tersebut, sehingga client dan server bisa saling mengirim data ' +
          'kapan saja. Jadi bukan hanya client yang bertanya, server juga bisa langsung mendorong ' +
          'pesan ke client.',
      },
      {
        text:
          'WebSocket berjalan di atas TCP. Saya memilih TCP karena chat membutuhkan data yang ' +
          'lengkap, berurutan, dan tidak hilang. UDP tidak menjamin hal itu. Prosesnya dimulai ' +
          'dari handshake HTTP dengan header Upgrade: websocket, kemudian koneksi berubah menjadi ' +
          'kanal dua arah penuh atau full-duplex.',
      },
      {
        text:
          'Di server, setiap client memiliki objek socket dengan socket.id. Socket.IO adalah ' +
          'library di atas WebSocket yang membantu mengelola event. Room bukan koneksi baru, ' +
          'tetapi pengelompokan logis di server. Saat client bergabung, server memanggil ' +
          'socket.join(roomId). Saat mengirim pesan, server memakai io.to(roomId).emit, sehingga ' +
          'pesan hanya dikirim ke socket yang berada di room tersebut. Ketika client terputus, ' +
          'server menghapus socket itu dan memberi tahu anggota room lainnya.',
      },
    ],
  },
  {
    time: '1:10–1:40',
    title: 'Arsitektur',
    blocks: [
      {
        text:
          'Arsitekturnya terdiri dari dua sisi. Di sisi client ada HTML, CSS, dan JavaScript yang ' +
          'berjalan di browser. Di sisi server ada Node.js, Express, dan Socket.IO. Express ' +
          'menyajikan antarmuka web, sedangkan Socket.IO menangani komunikasi real-time.',
      },
      {
        text:
          'Server menyimpan daftar pengguna, daftar ruang, riwayat pesan sementara, dan status ' +
          'mengetik di memori. Tersedia tiga ruang: Ruang Umum, Teknologi, dan Kampus.',
      },
    ],
  },
  {
    time: '1:40–2:05',
    title: 'Alur Komunikasi',
    blocks: [
      {
        text:
          'Saat halaman dibuka, client melakukan handshake WebSocket. Setelah terhubung, client ' +
          'mengirim event session:join berisi nama dan ruang. Server memvalidasi data, lalu ' +
          'memanggil socket.join(roomId). Server mengirim balik acknowledgment berisi data ' +
          'pengguna dan riwayat ruang.',
      },
      {
        text:
          'Ketika client mengirim chat:message, server menyimpan pesan lalu menyiarkannya dengan:',
      },
      { type: 'code', text: "io.to(user.roomId).emit('chat:message', message);" },
      {
        text:
          'Artinya, hanya client di ruang yang sama yang menerima pesan. Ada juga ' +
          'presence:update untuk daftar online dan typing:update untuk indikator mengetik.',
      },
    ],
  },
  {
    time: '2:05–3:05',
    title: 'Demo Chat Real-Time',
    blocks: [
      { type: 'stage', text: 'Beralih ke browser. Pastikan tab Alya dan Bima terlihat.' },
      {
        text:
          'Sekarang saya coba langsung. Saya sudah membuka dua tab: Alya dan Bima, keduanya ' +
          'berada di Ruang Umum.',
      },
      { type: 'stage', text: 'Ketik dari tab Alya, lalu tekan Enter.' },
      { type: 'type', text: 'Halo Bima, ini pesan real-time!' },
      {
        text:
          'Perhatikan, pesan langsung muncul di tab Bima tanpa refresh. Sekarang saya balas dari ' +
          'tab Bima.',
      },
      { type: 'stage', text: 'Ketik dari tab Bima, lalu tekan Enter.' },
      { type: 'type', text: 'Diterima tanpa refresh!' },
      {
        text:
          'Pesan juga langsung masuk ke tab Alya. Ini menunjukkan komunikasi dua arah melalui ' +
          'koneksi WebSocket yang sama.',
      },
    ],
  },
  {
    time: '3:05–3:30',
    title: 'Demo Typing dan Pindah Ruang',
    blocks: [
      {
        type: 'stage',
        text: 'Mulai mengetik di tab Bima. Jangan langsung mengirim pesan.',
      },
      { type: 'type', text: 'Saya sedang mengetik sebuah pesan...' },
      {
        text:
          'Di tab Alya muncul keterangan “Bima sedang mengetik”. Status ini dikirim melalui event ' +
          'typing:start, lalu server menyiarkannya ke anggota ruang yang sama.',
      },
      { type: 'stage', text: 'Hapus input, lalu pindahkan Bima ke ruang Teknologi.' },
      {
        text:
          'Selanjutnya saya pindahkan Bima ke ruang Teknologi. Pesan dari Ruang Umum tidak ikut ' +
          'masuk ke sini karena server memisahkan koneksi berdasarkan room. Jika Bima kembali ke ' +
          'Ruang Umum, riwayat percakapan sebelumnya masih tersedia.',
      },
    ],
  },
  {
    time: '3:30–3:55',
    title: 'Bagian Kode',
    blocks: [
      { type: 'stage', text: 'Tunjukkan file kode secara singkat, maksimal 25 detik.' },
      {
        text:
          'Di sisi client, koneksi saya batasi ke WebSocket melalui konfigurasi ' +
          "transports: ['websocket'] di public/app.js.",
      },
      {
        text:
          'Di server, bagian inti pengiriman pesan ada di server.js, yaitu ' +
          "io.to(user.roomId).emit('chat:message', message).",
      },
      {
        text:
          'Server juga memvalidasi nama, panjang pesan, nama yang duplikat, dan membatasi ' +
          'pengiriman pesan yang terlalu cepat. Di sisi tampilan, pesan dirender menggunakan ' +
          'textContent, sehingga input pengguna tidak dieksekusi sebagai HTML.',
      },
    ],
  },
  {
    time: '3:55–4:20',
    title: 'Pengujian',
    blocks: [
      {
        text:
          'Untuk pengujian, saya membuat enam pengujian integrasi, dan semuanya lulus. Pengujian ' +
          'tersebut memeriksa komunikasi dua client melalui WebSocket, isolasi pesan antarruang, ' +
          'validasi input, indikator mengetik, daftar online, dan perpindahan ruang.',
      },
      {
        text:
          'Pengujian UI juga mendeteksi koneksi WebSocket aktif dengan URL:',
      },
      { type: 'code', text: 'ws://.../socket.io/?EIO=4&transport=websocket' },
      {
        text:
          'Tangkapan layar dan hasil pengujian lengkap tersedia di folder docs.',
      },
    ],
  },
  {
    time: '4:20–4:40',
    title: 'Penutup',
    blocks: [
      {
        text:
          'Jadi, kesimpulannya: RuangObrol berhasil menerapkan komunikasi socket antara client dan ' +
          'server. WebSocket memungkinkan pertukaran pesan dua arah secara instan tanpa refresh, ' +
          'sedangkan Socket.IO memudahkan pengelolaan room, event, acknowledgment, dan ' +
          'reconnection.',
      },
      {
        text:
          'Keterbatasan saat ini adalah data masih disimpan di memori dan belum ada autentikasi. ' +
          'Untuk pengembangan berikutnya, aplikasi dapat ditambahkan database, login pengguna, ' +
          'serta HTTPS/WSS.',
      },
      { text: 'Terima kasih.' },
    ],
  },
];

for (const item of segments) {
  children.push(...segment(item.time, item.title, item.blocks));
}

// ---------------------------------------------------------------------------
// Lampiran: poin socket, versi singkat, Q&A
// ---------------------------------------------------------------------------

children.push(
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({
        text: 'Lampiran Presentasi',
        font: DISPLAY_FONT,
        size: 40,
        bold: true,
        color: COLOR.ink,
      }),
    ],
  }),
  new Paragraph({
    spacing: { after: 180, line: 290 },
    children: [
      bodyRun(
        'Gunakan bagian ini untuk latihan cepat dan antisipasi pertanyaan penguji.',
        { color: COLOR.muted, size: 20 },
      ),
    ],
  }),
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 120, after: 90 },
    children: [
      new TextRun({
        text: '10 poin socket yang wajib disebut',
        font: BODY_FONT,
        size: 24,
        bold: true,
        color: COLOR.ink,
      }),
    ],
  }),
);

const socketPoints = [
  ['Definisi socket', 'Endpoint komunikasi antara dua proses di jaringan.'],
  [
    'WebSocket vs HTTP',
    'HTTP selesai setelah satu request; WebSocket mempertahankan koneksi dua arah.',
  ],
  ['WebSocket di atas TCP', 'TCP menjamin data lengkap dan berurutan.'],
  ['Kenapa bukan UDP', 'Chat tidak boleh kehilangan atau menukar urutan pesan.'],
  [
    'Handshake',
    'Dimulai dari HTTP dengan Upgrade: websocket, lalu menjadi kanal full-duplex.',
  ],
  ['socket.id', 'Setiap koneksi client memiliki identitas socket di server.'],
  ['socket.join(roomId)', 'Memasukkan socket ke room logis.'],
  ['io.to(roomId).emit', 'Mengirim pesan hanya kepada socket di room tersebut.'],
  ['Room bukan koneksi baru', 'Room adalah pengelompokan logis untuk routing pesan.'],
  [
    'Disconnect',
    'Server menghapus socket, memperbarui presence, dan mengirim pesan keluar.',
  ],
];

socketPoints.forEach(([title, detail], index) => {
  children.push(numberedPoint(index + 1, title, detail));
});

children.push(
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 90 },
    children: [
      new TextRun({
        text: 'Versi 3 menit',
        font: BODY_FONT,
        size: 24,
        bold: true,
        color: COLOR.ink,
      }),
    ],
  }),
  callout(
    'Jika waktu terbatas',
    [
      'Tetap sampaikan konsep socket selama ±40 detik. Lewati bagian kode.',
      'Demo cukup satu pesan dari Alya, balasan dari Bima, dan indikator mengetik.',
      'Langsung ke hasil pengujian dan penutup.',
    ],
    { fill: COLOR.cream, accent: COLOR.coral },
  ),
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 100 },
    children: [
      new TextRun({
        text: 'Pertanyaan yang mungkin muncul',
        font: BODY_FONT,
        size: 24,
        bold: true,
        color: COLOR.ink,
      }),
    ],
  }),
  simpleTable(
    [
      ['Pertanyaan', 'Jawaban'],
      [
        'Kenapa memakai WebSocket, bukan HTTP biasa?',
        'HTTP berorientasi request-response. Untuk chat, client harus terus bertanya. WebSocket menjaga koneksi tetap terbuka sehingga server dapat mendorong pesan secara langsung.',
      ],
      [
        'TCP atau UDP?',
        'WebSocket berjalan di atas TCP. Chat membutuhkan pesan yang lengkap dan berurutan, sehingga TCP lebih tepat daripada UDP.',
      ],
      [
        'Kenapa memakai Socket.IO, bukan WebSocket murni?',
        'Socket.IO menyediakan room, acknowledgment, reconnection, dan API event di atas transport WebSocket. Pada proyek ini koneksi client tetap dibatasi ke WebSocket.',
      ],
      [
        'Bagaimana pesan tidak bocor ke ruang lain?',
        'Server hanya menyiarkan pesan ke room terkait menggunakan io.to(roomId).emit(...).',
      ],
      [
        'Bagaimana mencegah XSS?',
        'Server memvalidasi dan membersihkan input, lalu client merender pesan memakai textContent, bukan innerHTML.',
      ],
      [
        'Apa keterbatasan aplikasi?',
        'Riwayat masih di memori dan hilang saat server restart. Belum ada autentikasi dan database. Untuk produksi perlu HTTPS/WSS.',
      ],
    ],
    { widths: [30, 70], fontSize: 18 },
  ),
  new Paragraph({
    spacing: { before: 260 },
    border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.line },
    },
    children: [
      new TextRun({
        text:
          'Dokumen ini dibuat untuk presentasi RuangObrol. Screenshot, laporan lengkap, dan hasil ' +
          'pengujian tersedia di folder docs.',
        font: BODY_FONT,
        size: 15,
        italics: true,
        color: COLOR.muted,
      }),
    ],
  }),
);

const doc = new Document({
  creator: 'RuangObrol',
  title: 'Naskah Presentasi RuangObrol',
  subject: 'Presentasi aplikasi chat real-time berbasis WebSocket',
  description:
    'Naskah presentasi 4 menit 40 detik dengan penekanan pada pemahaman socket (bobot 20%).',
  keywords: 'socket, WebSocket, Socket.IO, chat real-time, presentasi',
  styles: {
    default: {
      document: {
        run: { font: BODY_FONT, size: 22, color: COLOR.body },
        paragraph: { spacing: { line: 300, after: 100 } },
      },
    },
    paragraphStyles: [
      {
        id: 'Heading1',
        name: 'Heading 1',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: {
          font: DISPLAY_FONT,
          size: 40,
          bold: true,
          color: COLOR.ink,
        },
        paragraph: {
          spacing: { before: 240, after: 120 },
          outlineLevel: 0,
        },
      },
      {
        id: 'Heading2',
        name: 'Heading 2',
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: {
          font: BODY_FONT,
          size: 26,
          bold: true,
          color: COLOR.ink,
        },
        paragraph: {
          spacing: { before: 220, after: 100 },
          outlineLevel: 1,
        },
      },
    ],
  },
  sections: [
    {
      properties: {
        titlePage: true,
        page: {
          size: { width: 11906, height: 16838 },
          margin: {
            top: 1134,
            right: 1134,
            bottom: 1134,
            left: 1134,
            header: 500,
            footer: 500,
          },
        },
      },
      headers: {
        default: header,
        first: emptyHeader,
      },
      footers: {
        default: footer,
        first: emptyFooter,
      },
      children,
    },
  ],
});

Packer.toBuffer(doc)
  .then((buffer) => {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, buffer);
    const size = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
    console.log(`✓ DOCX dibuat: ${OUTPUT}`);
    console.log(`✓ Ukuran: ${size} KB`);
  })
  .catch((error) => {
    console.error('Gagal membuat DOCX:', error);
    process.exitCode = 1;
  });
