process.on('unhandledRejection', (reason) => {
    console.error('❌ UNHANDLED REJECTION:', reason)
    process.exit(1) // Penting agar systemd tahu bot error dan restart
})

process.on('uncaughtException', (err) => {
    console.error('❌ UNCAUGHT EXCEPTION:', err)
    process.exit(1)
})
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
const crypto = require('crypto');
const { Telegraf, Scenes, session } = require('telegraf');
const topUpQueue = require('./queue');
const { initGenerateBug, handleGenerateURI } = require('./generate');
const { Api } = require('./modules/apiHandler');
const { generateQR, checkPaymentByAmount, generateReceiptPDF } = require('./lib/qris');
const {
  saveUserAccount,
  updateUserAccountCreation,
  updateAccountRenewal,
  showRenewableAccountsByServer
} = require('./lib/userTracking');


const app = express();
const axios = require('axios');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { createssh, createvmess, createvless, createtrojan } = require('./modules/create');
const { trialssh, trialvmess, trialvless, trialtrojan } = require('./modules/trial');
const { renewssh, renewvmess, renewvless, renewtrojan } = require('./modules/renew');
const { hapusAkun } = require('./modules/delete');

const fs = require('fs');
const vars = JSON.parse(fs.readFileSync('./.vars.json', 'utf8'));

const PAYDISINI_KEY = vars.OKE_API_KEY; // Sudah di-set di VPS
const BOT_TOKEN = vars.BOT_TOKEN; // Sudah di-set di VPS
const port = vars.PORT || 50123; // Sudah di-set di VPS
const ADMIN = vars.USER_ID; // Sudah di-set di VPS
const NAMA_STORE = vars.NAMA_STORE || 'NEWBIE-STORE'; // Sudah di-set di VPS
const GROUP_ID = vars.IDGRUP || '-1001992207638'; // Tambahkan grup ID di sini
const ADMIN_TELE = vars.ADMINTELE || 'newbie_store242'; // Sudah di-set di VPS
const ADMIN_WA = vars.ADMINWA || '6282326322300'; // Tambahkan grup ID di sini
const GRUP_TELE = vars.LINK_GRUP || 'https://newbielearning'; // Sudah di-set di VPS
const SALURAN_WA = vars.LINK_SALURAN || 'https://saluran.nevpn.site'; // Tambahkan grup ID di sini
const bot = new Telegraf(BOT_TOKEN, {
    handlerTimeout: 180_000 
});


const adminIds = ADMIN;
console.log('Bot initialized');

const db = new sqlite3.Database('./sellvpn.db', (err) => {
  if (err) {
    console.error('Kesalahan koneksi SQLite3:', err.message);
  } else {
    console.log('Terhubung ke SQLite3');
  }
});

// ✅ Server Table (tambahkan server_type)
const createServerTable = `CREATE TABLE IF NOT EXISTS Server (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT,
  auth TEXT,
  harga INTEGER,
  harga_reseller INTEGER,
  nama_server TEXT,
  quota INTEGER,
  iplimit INTEGER,
  batas_create_akun INTEGER,
  total_create_akun INTEGER,
  server_type TEXT
)`;
db.run(createServerTable, (err) => {
  if (err) console.error('Gagal membuat tabel server:', err.message);
});

// Cek dan buat tabel deposit_bonus_rules jika belum ada
const createUsersTable = `CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE,
  username TEXT,
  saldo INTEGER DEFAULT 0,
  role TEXT DEFAULT 'member',
  last_topup_date TEXT,
  transaction_count INTEGER DEFAULT 0,
  total_accounts_created INTEGER DEFAULT 0,
  last_account_creation_date TEXT,
  last_transaction_date TEXT,
  accounts_created_30days INTEGER DEFAULT 0,
  trial_count INTEGER DEFAULT 0,
  last_trial_date TEXT DEFAULT NULL,
  sudah_dapat_bonus_first INTEGER DEFAULT 0,
  is_blocked INTEGER DEFAULT 0,
  CONSTRAINT unique_user_id UNIQUE (user_id)
)`;
db.run(createUsersTable, (err) => {
  if (err) console.error('Gagal membuat tabel users:', err.message);
});

// User Accounts Table
const createUserAccountsTable = `CREATE TABLE IF NOT EXISTS user_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  username TEXT,
  jenis TEXT,
  server_id INTEGER,
  expired TEXT,
  created_at TEXT,
  price INTEGER,
  duration_days INTEGER
)`;
db.run(createUserAccountsTable, (err) => {
  if (err) console.error('Gagal membuat tabel user_accounts:', err.message);
});

// Bonus Rules Table
const createBonusRulesTable = `CREATE TABLE IF NOT EXISTS deposit_bonus_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis_bonus TEXT CHECK(jenis_bonus IN ('first', 'period')) NOT NULL,
  min_deposit INTEGER NOT NULL,
  bonus_percent INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  start_date TEXT,
  end_date TEXT
)`;
db.run(createBonusRulesTable, (err) => {
  if (err) console.error('Gagal membuat tabel deposit_bonus_rules:', err.message);
});

// ✅ Penyesuaian kolom tabel users jika belum ada
async function ensureUserTableColumns() {
  const expectedColumns = {
    username: "TEXT",
    role: "TEXT DEFAULT 'member'",
    last_topup_date: "TEXT",
    transaction_count: "INTEGER DEFAULT 0",
    total_accounts_created: "INTEGER DEFAULT 0",
    last_account_creation_date: "TEXT",
    last_transaction_date: "TEXT",
    accounts_created_30days: "INTEGER DEFAULT 0",
    trial_count: "INTEGER DEFAULT 0",
    last_trial_date: "TEXT DEFAULT NULL",
    sudah_dapat_bonus_first: "INTEGER DEFAULT 0",
	is_blocked: "INTEGER DEFAULT 0"
  };

  db.all(`PRAGMA table_info(users);`, (err, rows) => {
    if (err) return console.error('Gagal membaca struktur tabel users:', err);
    const existingColumns = rows.map(row => row.name);
    for (const [column, definition] of Object.entries(expectedColumns)) {
      if (!existingColumns.includes(column)) {
        const alterSQL = `ALTER TABLE users ADD COLUMN ${column} ${definition}`;
        db.run(alterSQL, (err) => {
          if (err) {
            console.error(`Gagal menambahkan kolom ${column}:`, err.message);
          } else {
            console.log(`✅ Kolom '${column}' berhasil ditambahkan ke tabel users`);
          }
        });
      }
    }
  });
}
function ensureServerTableColumns() {
  const expectedColumns = {
    domain: "TEXT",
    auth: "TEXT",
    harga: "INTEGER DEFAULT 0",
    harga_reseller: "INTEGER DEFAULT 0",
    nama_server: "TEXT",
    quota: "INTEGER DEFAULT 0",
    iplimit: "INTEGER DEFAULT 0",
    batas_create_akun: "INTEGER DEFAULT 0",
    total_create_akun: "INTEGER DEFAULT 0",
    server_type: "TEXT" // ✅ tambah ini
  };

  db.all(`PRAGMA table_info(Server);`, (err, rows) => {
    if (err) return console.error('❌ Gagal membaca struktur tabel Server:', err);

    const existingColumns = rows.map(row => row.name);

    for (const [column, definition] of Object.entries(expectedColumns)) {
      if (!existingColumns.includes(column)) {
        const alterSQL = `ALTER TABLE Server ADD COLUMN ${column} ${definition}`;
        db.run(alterSQL, (err) => {
          if (err) console.error(`❌ Gagal menambahkan kolom ${column}:`, err.message);
          else console.log(`✅ Kolom '${column}' berhasil ditambahkan ke tabel Server`);
        });
      }
    }
  });
}
ensureUserTableColumns();
ensureServerTableColumns();
function updateTotalCreatedAccounts() {
  db.serialize(() => {
    // 1. Hapus akun yang sudah expired
    db.run(`DELETE FROM user_accounts WHERE DATE(expired) < DATE('now')`, function (err) {
      if (err) {
        console.error('❌ Gagal menghapus akun yang sudah expired:', err.message);
        return;
      }
      console.log(`🧹 ${this.changes} akun expired dihapus.`);

      // 2. Ambil semua server
      db.all(`SELECT id, nama_server FROM Server`, [], (err, servers) => {
        if (err) {
          console.error('❌ Gagal mengambil data server:', err.message);
          return;
        }

        // 3. Untuk setiap server, hitung akun aktif dan update ke kolom total_create_akun
        servers.forEach((server) => {
          db.get(
            `SELECT COUNT(*) AS total FROM user_accounts WHERE server_id = ? AND DATE(expired) >= DATE('now')`,
            [server.id],
            (err2, result) => {
              if (err2) {
                console.error(`❌ Gagal hitung akun aktif server ${server.id}:`, err2.message);
                return;
              }

              const total = result.total;

              db.run(
                `UPDATE Server SET total_create_akun = ? WHERE id = ?`,
                [total, server.id],
                (err3) => {
                  if (err3) {
                    console.error(`❌ Gagal update total_create_akun server ${server.id}:`, err3.message);
                  } else {
                    console.log(`📊 Server ${server.nama_server || server.id}: total akun aktif = ${total}`);
                  }
                }
              );
            }
          );
        });
      });
    });
  });
}

updateTotalCreatedAccounts();

const userState = {};
console.log('User state initialized');

const userSessions = {}; // Simpan message_id terakhir untuk setiap user

const userMessages = {}; // Menyimpan message_id terakhir untuk setiap user
bot.command(['start', 'menu'], async (ctx) => {
  console.log('Start or Menu command received');

  const userId = ctx.from.id;
  const username = ctx.from.username ? ctx.from.username : "Tidak ada username";

  // Hapus pesan lama jika ada
  if (userMessages[userId]) {
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, userMessages[userId]);
      console.log(`Pesan lama (${userMessages[userId]}) dihapus untuk user ${userId}`);
    } catch (error) {
      console.warn(`Gagal menghapus pesan lama: ${error.message}`);
    }
  }

  // Simpan atau update data pengguna
  db.serialize(() => {
       // Coba insert user baru, jika sudah ada, abaikan (INSERT OR IGNORE)
       db.run(
         'INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)',
         [userId, username],
         (err) => {
           if (err) {
             console.error('Kesalahan saat menyimpan user:', err.message);
           } else {
             console.log(`User ID ${userId} berhasil disimpan atau sudah ada.`);
           }
         }
       );

       // Update username jika NULL atau berbeda
       db.run(
         `UPDATE users 
          SET username = ? 
          WHERE user_id = ? 
          AND (username IS NULL OR username != ?)`,
         [username, userId, username],
         (err) => {
           if (err) {
             console.error('Kesalahan saat mengupdate username:', err.message);
           } else {
             console.log(`Username untuk User ID ${userId} berhasil diupdate (jika diperlukan).`);
           }
         }
       );
     });
	 

  // Kirim pesan menu (seperti sebelumnya)
  const jumlahServer = await getJumlahServer();
  const jumlahPengguna = await getJumlahPengguna();

  const keyboard = [
    [
      { text: 'GRUP TELEGRAM', url: `${GRUP_TELE}` },
      { text: 'CHANNEL WHATSAPP', url: `${SALURAN_WA}` },
    ],
    [
      { text: 'MAIN MENU♻️', callback_data: 'main_menu_refresh' }
    ]
  ];

const messageText = `
█▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀█
█░░╦─╦╔╗╦─╔╗╔╗╔╦╗╔╗░░█
█░░║║║╠─║─║─║║║║║╠─░░█
█░░╚╩╝╚╝╚╝╚╝╚╝╩─╩╚╝░░█
█▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█
 Username: <b>${username}</b>
 ID Anda: <b>${userId}</b>
──────────────────────────
𝙿𝚊𝚑𝚊𝚖𝚒 𝚍𝚞𝚕𝚞 𝚝𝚞𝚝𝚘𝚛𝚒𝚊𝚕𝚗𝚢𝚊.
𝙹𝚒𝚔𝚊 𝚜𝚞𝚍𝚊𝚑, 𝚔𝚕𝚒𝚔 𝙼𝚊𝚒𝚗𝙼𝚎𝚗𝚞♻️
──────────────────────────
🟢𝙹𝚒𝚔𝚊 𝚒𝚗𝚐𝚒𝚗 𝚖𝚎𝚗𝚓𝚊𝚍𝚒 𝚛𝚎𝚜𝚎𝚕𝚕𝚎𝚛
𝚜𝚒𝚕𝚊𝚑𝚔𝚊𝚗 𝚝𝚘𝚙𝚞𝚙 𝚖𝚒𝚗𝚒𝚖𝚊𝚕 𝟸𝟻.𝟶𝟶𝟶
𝙷𝚊𝚛𝚐𝚊 𝚞𝚗𝚝𝚞𝚔 𝚛𝚎𝚜𝚎𝚕𝚕𝚎𝚛
𝙻𝚎𝚋𝚒𝚑 𝚖𝚞𝚛𝚊𝚑 𝚑𝚒𝚗𝚐𝚐𝚊 𝟻𝟶%
──────────────────────────
Hᴀʀɢᴀ Sᴇʀᴠᴇʀ Tᴇʀᴍᴜʀᴀʜ✴️
──────────────────────────
×͜×𝐂𝐎𝐍𝐓𝐀𝐂𝐓 𝐀𝐃𝐌𝐈𝐍×͜×
☏ <a href="https://t.me/${ADMIN_TELE}">Telegram</a>
☏ <a href="https://wa.me/${ADMIN_WA}">WhatsApp</a>
──────────────────────────
<b>Sɪʟᴀᴋᴀɴ ᴘɪʟɪʜ ᴏᴘsɪ ʟᴀʏᴀɴᴀɴ:</b>
`;

  try {
    const sentMessage = await ctx.reply(messageText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    // Simpan message_id baru untuk nanti dihapus saat /menu dipanggil lagi
    userMessages[userId] = sentMessage.message_id;
    console.log(`Pesan baru disimpan dengan ID: ${sentMessage.message_id}`);
  } catch (error) {
    console.error('Error saat mengirim menu utama:', error);
  }
});

async function getUserSaldo(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT saldo FROM users WHERE user_id = ?',
      [userId],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.saldo : 0);
        }
      }
    );
  });
}

function rupiah(n) {
  const x = Number(n || 0);
  return `Rp ${x.toLocaleString('id-ID')}`;
}

// Fungsi untuk mendapatkan jumlah server
async function getJumlahServer() {
  // Implementasi query ke database atau sumber data lainnya
  return 10; // Contoh nilai
}

// Fungsi untuk mendapatkan jumlah pengguna
async function getJumlahPengguna() {
  // Implementasi query ke database atau sumber data lainnya
  return 100; // Contoh nilai
}

const resetAccountsCreated30Days = async () => {
  try {
    const today = new Date();
    const dayOfMonth = today.getDate(); // Ambil tanggal: 1-31

    if (dayOfMonth !== 1) {
      console.log('⏩ Bukan tanggal 1, reset dilewati.');
      return;
    }

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET accounts_created_30days = 0',
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    console.log('✅ Kolom accounts_created_30days berhasil di-reset untuk semua pengguna.');
  } catch (error) {
    console.error('🚫 Gagal mereset accounts_created_30days:', error);
  }
};

const oneDayInMs = 24 * 60 * 60 * 1000;
setInterval(() => {
  resetAccountsCreated30Days();
}, oneDayInMs);

async function cekDanHitungBonusDeposit(userId, nominalDeposit) {
  return new Promise((resolve) => {
    db.all(`SELECT * FROM deposit_bonus_rules WHERE is_active = 1`, async (err, rules) => {
      if (err || !rules || rules.length === 0) return resolve(0);

      let maxBonus = 0;

      for (const rule of rules) {
        if (parseInt(nominalDeposit) < rule.min_deposit) continue;

        // Bonus tipe "first"
        if (rule.jenis_bonus === 'first') {
          const user = await new Promise((res) =>
            db.get(`SELECT sudah_dapat_bonus_first FROM users WHERE user_id = ?`, [userId], (err, row) => res(row))
          );

          if (!user || user.sudah_dapat_bonus_first) continue;

          const bonus = Math.floor((nominalDeposit * rule.bonus_percent) / 100);
          if (bonus > maxBonus) maxBonus = bonus;
        }

        // Bonus tipe "period"
        if (rule.jenis_bonus === 'period') {
          const now = new Date().toISOString().split('T')[0];
          if (rule.start_date <= now && now <= rule.end_date) {
            const bonus = Math.floor((nominalDeposit * rule.bonus_percent) / 100);
            if (bonus > maxBonus) maxBonus = bonus;
          }
        }
      }

      resolve(maxBonus);
    });
  });
}


async function getAccountCreationRanking() {
  try {
    const users = await new Promise((resolve, reject) => {
      db.all(
        'SELECT user_id, username, accounts_created_30days FROM users ORDER BY accounts_created_30days DESC LIMIT 3',
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });

    if (users.length === 0) {
      return null; // Tidak ada data ranking
    }

    return users;
  } catch (error) {
    console.error('🚫 Kesalahan saat mengambil data ranking:', error);
    return null;
  }
}

// Fungsi untuk memeriksa dan mengupdate role pengguna berdasarkan transaksi
async function checkAndUpdateUserRole(userId) {
  try {
    // Ambil data pengguna dari database
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT saldo, role FROM users WHERE user_id = ?', [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    if (!user) {
      console.error('🚫 Pengguna tidak ditemukan.');
      return;
    }

    const { saldo, role } = user;

    // Jika saldo >= 25.000 dan role bukan reseller, ubah role ke reseller
    if (saldo >= 25000 && role !== 'reseller') {
      await new Promise((resolve, reject) => {
        db.run('UPDATE users SET role = ? WHERE user_id = ?', ['reseller', userId], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      console.log(`✅ Role pengguna ${userId} diubah menjadi reseller.`);

      // **Ambil username pengguna**
      const chat = await bot.telegram.getChat(userId);
      const username = chat.username ? `@${chat.username}` : `User ID: ${userId}`;

      // **Kirim notifikasi ke pengguna**
		await bot.telegram.sendMessage(
		  userId,
		  `🎉 <b>Selamat! Anda sekarang menjadi reseller.</b>\n\n` +
		  `<b>──────────────────────</b>\n` +
		  `➥ <b>Role Baru:</b> Reseller\n` +
		  `➥ <b>Tanggal:</b> ${new Date().toLocaleString('id-ID')}\n` +
		  `<b>──────────────────────</b>`,
		  { parse_mode: 'HTML' }
		);

		// Notifikasi ke admin
		await bot.telegram.sendMessage(
		  ADMIN,
		  `🎉 <b>Notifikasi Upgrade Reseller</b>\n\n` +
		  `<b>──────────────────────</b>\n` +
		  `➥ <b>Username:</b> <a href="tg://user?id=${userId}">${username}</a>\n` +
		  `➥ <b>User ID:</b> ${userId}\n` +
		  `➥ <b>Role Baru:</b> Reseller\n` +
		  `➥ <b>Tanggal:</b> ${new Date().toLocaleString('id-ID')}\n` +
		  `<b>──────────────────────</b>`,
		  { parse_mode: 'HTML' }
		);

		// Notifikasi ke grup
		await bot.telegram.sendMessage(
		  GROUP_ID,
		  `🎉 <b>Notifikasi Upgrade Reseller</b>\n\n` +
		  `<b>──────────────────────</b>\n` +
		  `➥ <b>Username:</b> <a href="tg://user?id=${userId}">${username}</a>\n` +
		  `➥ <b>User ID:</b> ${userId}\n` +
		  `➥ <b>Role Baru:</b> Reseller\n` +
		  `➥ <b>Tanggal:</b> ${new Date().toLocaleString('id-ID')}\n` +
		  `<b>──────────────────────</b>`,
		  { parse_mode: 'HTML' }
		);

    }
  } catch (error) {
    console.error('🚫 Gagal memeriksa dan mengupdate role pengguna:', error);
  }
}



async function sendUserNotificationTopup(userId, reference, amount, uniqueAmount, brandname, buyerref, receipt) {
const userMessage = 
`<b>──────────────────────</b>\n` +
`<b>⟨ STATUS TOPUP SUCCESS ⟩</b>\n` +
`<b>──────────────────────</b>\n` +
`➥ <b>Saldo Ditambahkan:</b> Rp${(amount || 0).toLocaleString('id-ID')}\n` +
`➥ <b>Kode Transaksi:</b> ${reference}\n` +
`➥ <b>Total Pembayaran:</b> Rp${(uniqueAmount || 0).toLocaleString('id-ID')}\n` +
`➥ <b>Tanggal:</b> ${new Date().toLocaleString('id-ID')}\n` +
`<b>──────────────────────</b>\n` +
`Terima kasih telah melakukan top-up di ${NAMA_STORE}!`;

  try {
    await bot.telegram.sendMessage(userId, userMessage, { parse_mode: 'HTML' });
    console.log(`✅ Notifikasi top-up berhasil dikirim ke pengguna ${userId}`);
  } catch (error) {
    console.error('🚫 Gagal mengirim notifikasi top-up ke pengguna:', error.message);
  }

  // ✅ Kirim bukti PDF hanya jika tersedia
  if (receipt && receipt.success && receipt.filePath) {
    try {
      await bot.telegram.sendDocument(userId, {
        source: receipt.filePath,
        filename: receipt.fileName || `bukti_topup_${reference}.pdf`
      });
    } catch (err) {
      console.error('🚫 Gagal mengirim file PDF:', err.message);
    }
  }
}


async function sendAdminNotificationTopup(username, userId, reference, amount, uniqueAmount) {
const adminMessage =
`<b>──────────────────────</b>\n` +
`<b>⟨ NOTIFIKASI TOPUP ⟩</b>\n` +
`<b>──────────────────────</b>\n` +
`➥ <b>Username:</b> <a href="tg://user?id=${userId}">${username}</a>\n` +
`➥ <b>User ID:</b> ${userId}\n` +
`➥ <b>Jumlah Top-up:</b> Rp${amount.toLocaleString('id-ID')}\n` +
`➥ <b>Kode Transaksi:</b> ${reference}\n` +
`➥ <b>Tanggal:</b> ${new Date().toLocaleString('id-ID')}\n` +
`<b>──────────────────────</b>`;


  try {
    await bot.telegram.sendMessage(ADMIN, adminMessage, { parse_mode: 'HTML' });
    console.log(`✅ Notifikasi top-up berhasil dikirim ke admin`);
  } catch (error) {
    console.error('🚫 Gagal mengirim notifikasi top-up ke admin:', error.message);
  }
}

async function sendGroupNotificationTopup(username, userId, reference, amount, uniqueAmount) {
const groupMessage =
`<b>──────────────────────</b>\n` +
`<b>⟨ NOTIFIKASI TOPUP ⟩</b>\n` +
`<b>──────────────────────</b>\n` +
`➥ <b>Username:</b> <a href="tg://user?id=${userId}">${username}</a>\n` +
`➥ <b>User ID:</b> ${userId}\n` +
`➥ <b>Jumlah Top-up:</b> Rp${amount.toLocaleString('id-ID')}\n` +
`➥ <b>Kode Transaksi:</b> ${reference}\n` +
`➥ <b>Tanggal:</b> ${new Date().toLocaleString('id-ID')}\n` +
`<b>──────────────────────</b>`;


  try {
    await bot.telegram.sendMessage(GROUP_ID, groupMessage, { parse_mode: 'HTML' });
    console.log(`✅ Notifikasi top-up berhasil dikirim ke grup`);
  } catch (error) {
    console.error('🚫 Gagal mengirim notifikasi top-up ke grup:', error.message);
  }
}

// Fungsi untuk mencatat transaksi pengguna
async function recordUserTransaction(userId) {
  const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

  await new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET last_transaction_date = ?, transaction_count = transaction_count + 1 WHERE user_id = ?',
      [currentDate, userId],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });

  // 
}

async function checkAndDowngradeReseller(userId) {
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT role, last_transaction_date, transaction_count FROM users WHERE user_id = ?', [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    if (!user || user.role !== 'reseller') {
      return; // Hanya proses untuk reseller
    }

    const { last_transaction_date, transaction_count } = user;

    // Hitung selisih hari sejak transaksi terakhir
    const currentDate = new Date();
    const lastTransactionDate = new Date(last_transaction_date);
    const diffTime = currentDate - lastTransactionDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Selisih dalam hari

    // Jika lebih dari 30 hari dan transaksi kurang dari 5, downgrade ke member
    if (diffDays > 30 && transaction_count < 5) {
      await new Promise((resolve, reject) => {
        db.run('UPDATE users SET role = ? WHERE user_id = ?', ['member', userId], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      console.log(`✅ Role pengguna ${userId} diturunkan ke member.`);

      // Kirim notifikasi ke pengguna
      await bot.telegram.sendMessage(userId, 'ℹ️ Role Anda telah diturunkan menjadi member karena tidak memenuhi syarat transaksi.', { parse_mode: 'Markdown' });

      // Kirim notifikasi ke admin
      await bot.telegram.sendMessage(ADMIN, `ℹ️ Pengguna dengan ID ${userId} telah diturunkan ke member.`, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('🚫 Gagal memeriksa dan menurunkan role reseller:', error);
  }
}


async function getServerList(userId) {
  const user = await new Promise((resolve, reject) => {
    db.get('SELECT role FROM users WHERE user_id = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  const role = user ? user.role : 'member';

  // ⛔ Menu lama (SSH/VMESS/VLESS/TROJAN/...) TIDAK boleh menampilkan server UDPZI
  const servers = await new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM Server
       WHERE (server_type IS NULL OR server_type = '' OR LOWER(server_type) = 'xray')
       ORDER BY nama_server ASC`,
      [],
      (err, rows) => (err ? reject(err) : resolve(rows))
    );
  });

  return servers.map(server => ({
    ...server,
    harga: role === 'reseller' ? server.harga_reseller : server.harga
  }));
}

async function getUdpziServerList(userId) {
  const user = await new Promise((resolve, reject) => {
    db.get('SELECT role FROM users WHERE user_id = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  const role = user ? user.role : 'member';

  const servers = await new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM Server
       WHERE LOWER(COALESCE(server_type, '')) = 'udpzi'
       ORDER BY nama_server ASC`,
      [],
      (err, rows) => (err ? reject(err) : resolve(rows))
    );
  });

  return servers.map(server => ({
    ...server,
    harga: role === 'reseller' ? server.harga_reseller : server.harga
  }));
}



bot.command('admin', async (ctx) => {
  console.log('Admin menu requested');
  
  if (!adminIds.includes(ctx.from.id)) {
    await ctx.reply('🚫 Anda tidak memiliki izin untuk mengakses menu admin.');
    return;
  }

  await sendAdminMenu(ctx);
});

bot.action('main_menu_refresh', async (ctx) => {
  console.log('Tombol MAIN MENU♻️ diklik oleh:', ctx.from.id);

  try {
    console.log('Mencoba menghapus pesan...');
    await ctx.deleteMessage();
    console.log('Pesan berhasil dihapus.');
  } catch (deleteError) {
    console.warn('Tidak dapat menghapus pesan:', deleteError.message);
  }

  try {
    console.log('Mencoba menampilkan menu utama...');
    await sendMainMenu(ctx);
    console.log('Menu utama berhasil ditampilkan.');
  } catch (menuError) {
    console.error('Gagal menampilkan menu utama:', menuError);
    await ctx.reply('🚫 Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi.', { parse_mode: 'Markdown' });
  }
});

bot.action('refresh_menu', async (ctx) => {
  try {
    // Hapus pesan menu saat ini
    await ctx.deleteMessage();
    console.log('Menu dihapus dan akan ditampilkan ulang.');

    // Tampilkan ulang menu utama
    await sendMainMenu(ctx);
  } catch (error) {
    console.error('Gagal menghapus pesan atau menampilkan ulang menu:', error);
    await ctx.reply('🚫 Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi.', { parse_mode: 'Markdown' });
  }
});


   async function sendMainMenu(ctx) {
  const userId = ctx.from.id;
  const isAdmin = adminIds.includes(userId);

  const keyboard = [
    [ { text: '🟣 UDPZI', callback_data: 'udpzi_menu' } ],
    [
	  { text: 'CREATE ACCOUNT', callback_data: 'service_create' },
      { text: 'CREATE TRIAL', callback_data: 'service_trial' }
    ],
    [
	  { text: 'DELETE ACCOUNT', callback_data: 'hapus_akun_menu' },
      { text: 'RENEW ACCOUNT', callback_data: 'service_renew' }
    ],
    [
      { text: 'TOPUP SALDO [QRIS]', callback_data: 'topup_saldo' },
    ],
    [
      { text: 'REFRESH', callback_data: 'refresh_menu' }
    ],
  ];

  // Add admin buttons if user is admin
  if (isAdmin) {
    keyboard.push([
      { text: '⚙️ ADMIN', callback_data: 'admin_menu' },
      { text: '💹 CEK SALDO', callback_data: 'cek_saldo_semua' }
    ]);
  }

  const uptime = os.uptime();
  const days = Math.floor(uptime / (60 * 60 * 24));

  // Get server count
  let jumlahServer = 0;
  try {
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) AS count FROM Server', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    jumlahServer = row.count;
  } catch (err) {
    console.error('Kesalahan saat mengambil jumlah server:', err.message);
  }

  // Get user count
  let jumlahPengguna = 0;
  try {
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) AS count FROM users', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    jumlahPengguna = row.count;
  } catch (err) {
    console.error('Kesalahan saat mengambil jumlah pengguna:', err.message);
  }

  const username = ctx.from.username ? `@${ctx.from.username}` : "Tidak ada username";

  // Get user balance and role
  let saldo = 0;
  let role = 'member'; // Default role is 'member'
  try {
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT saldo, role FROM users WHERE user_id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (row) {
      saldo = row.saldo;
      role = row.role || 'member';
    }
  } catch (err) {
    console.error('Kesalahan saat mengambil saldo atau role pengguna:', err.message);
  }

 // Get ranking data
const ranking = await getAccountCreationRanking();
let rankingText = '';
if (ranking && ranking.length > 0) {
  rankingText = ranking.map((user, index) => {
    if (index === 0) return `🥇 ${user.username}: ${user.accounts_created_30days} akun`;
    if (index === 1) return `🥈 ${user.username}: ${user.accounts_created_30days} akun`;
    if (index === 2) return `🥉 ${user.username}: ${user.accounts_created_30days} akun`;
    return `➥ ${user.username}: ${user.accounts_created_30days} akun`;
  }).join('\n');
} else {
  rankingText = '⚠️ Tidak ada data ranking.';
}

let trialHariIni = 0;
try {
  const today = new Date().toISOString().slice(0, 10); // format YYYY-MM-DD

  const row = await new Promise((resolve, reject) => {
    db.get(
      'SELECT trial_count, last_trial_date FROM users WHERE user_id = ?',
      [userId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

  if (row) {
    const lastTrialDate = row.last_trial_date;
    trialHariIni = (lastTrialDate === today) ? row.trial_count : 0;
  }
} catch (err) {
  console.error('⚠️ Kesalahan saat membaca trial count pengguna:', err.message);
}

  // Get total accounts in last 30 days and global
  let totalAkun30Hari = 0;
  let totalAkunGlobal = 0;
  try {
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT SUM(accounts_created_30days) as total_30days, SUM(total_accounts_created) as total_global FROM users', [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    totalAkun30Hari = row.total_30days || 0;
    totalAkunGlobal = row.total_global || 0;
  } catch (error) {
    console.error('🚫 Kesalahan saat mengambil total akun:', error);
  }

  // Format balance with commas
  const formattedSaldo = saldo.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const messageText = `
█▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀█
█░░╦─╦╔╗╦─╔╗╔╗╔╦╗╔╗░░█
█░░║║║╠─║─║─║║║║║╠─░░█
█░░╚╩╝╚╝╚╝╚╝╚╝╩─╩╚╝░░█
█▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄█

👋 <b>Username:</b> <i>${username}</i>  
🆔 <b>ID Anda:</b> <code>${userId}</code>  
⭕ <b>Status:</b> ${role === 'reseller' ? 'Reseller 🛍️' : '👤 Member'}  
💵 <b>Saldo:</b> Rp ${formattedSaldo}

<b>┅┅┅┅┅┅┅ INFO PANEL ┅┅┅┅┅┅┅</b>  
🌐 <b>Server Tersedia:</b> ${jumlahServer}  
👥 <b>Total Pengguna:</b> ${jumlahPengguna}  
📊 <b>Akun (30 Hari):</b> ${totalAkun30Hari}  
🌍 <b>Akun Global:</b> ${totalAkunGlobal}  

<b>┅┅┅┅┅┅ TRIAL HARI INI ┅┅┅┅┅┅┅</b>  
❇️ <b>Max 2x Sehari</b>  
🔁 <b>Trial Anda:</b> ${trialHariIni}/2  

<b>┅┅┅┅┅┅ TOP 3 CREATOR ┅┅┅┅┅┅┅</b>  
🏆 <b>(30 Hari Terakhir)</b>  
${rankingText}  

<b>┅┅┅┅┅┅ KONTAK ADMIN ┅┅┅┅┅┅┅</b>
☏ <a href="https://t.me/${ADMIN_TELE}">Telegram</a>  
☏ <a href="https://wa.me/${ADMIN_WA}">WhatsApp</a>  
<b>┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅┅</b>
Silakan pilih opsi layanan:
`;

try {
  await ctx.reply(messageText, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
    console.log('Main menu sent');
  } catch (error) {
    console.error('Error saat mengirim menu utama:', error);
  }
}
bot.command('helpadmin', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'HTML' });
  }

  const helpMessage = `
<b>📋 Daftar Perintah Admin:</b>

1. /addserver - Menambahkan server baru.
2. /addsaldo - Menambahkan saldo ke akun pengguna.
3. /ceksaldo - Melihat saldo semua akun pengguna.
4. /editharga - Mengedit harga layanan.
5. /editnama - Mengedit nama server.
6. /editdomain - Mengedit domain server.
7. /editauth - Mengedit auth server.
8. /editlimitquota - Mengedit batas quota server.
9. /editlimitip - Mengedit batas IP server.
10. /editlimitcreate - Mengedit batas pembuatan akun server.
11. /edittotalcreate - Mengedit total pembuatan akun server.
12. /broadcast - Mengirim pesan siaran ke semua pengguna.
13. /hapussaldo - Menghapus saldo.
14. /listserver - Melihat server.
15. /detailserver - Melihat detail server.
16. /changerole - Mengubah Role Member / Reseller.
17. /upgrade_reseller - Mengubah Role Member ke Reseller.
18. /listusers - Melihat Detail Semua User.
19. /editreseller - Mengedit Harga Reseller.
20. /addbonus - Mengatur Bonus Deposit.
21. /addblok - memblok User.
20. /unblok - Unblok User.

Gunakan perintah ini dengan format yang benar untuk menghindari kesalahan.
`;

  ctx.reply(helpMessage, { parse_mode: 'HTML' });
});

// Command untuk admin mengubah role pengguna
bot.command('changerole', async (ctx) => {
  const args = ctx.message.text.split(' ');
  if (args.length < 3) {
    return ctx.reply('🚫 Format: /changerole <user_id> <new_role>', { parse_mode: 'Markdown' });
  }

  const targetUserId = args[1];
  const newRole = args[2];

  if (!['member', 'reseller'].includes(newRole)) {
    return ctx.reply('🚫 Role tidak valid. Gunakan "member" atau "reseller".', { parse_mode: 'Markdown' });
  }

  await new Promise((resolve, reject) => {
    db.run('UPDATE users SET role = ? WHERE user_id = ?', [newRole, targetUserId], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

  await ctx.reply(`✅ Role pengguna dengan ID ${targetUserId} berhasil diubah menjadi ${newRole}.`, { parse_mode: 'Markdown' });

  // Kirim notifikasi ke pengguna
  try {
    await ctx.telegram.sendMessage(targetUserId, `🔄 Role Anda telah diubah menjadi ${newRole} oleh admin.`);
  } catch (error) {
    console.error('🚫 Gagal mengirim notifikasi ke pengguna:', error);
  }

  // Kirim notifikasi ke grup
  const username = await getUsernameById(targetUserId);
  const groupMessage = `🔄 *Notifikasi Perubahan Role*\n\n` +
                       `➥ *Username:* [${username}](tg://user?id=${targetUserId})\n` +
                       `➥ *User ID:* ${targetUserId}\n` +
                       `➥ *Role Baru:* ${newRole}\n` +
                       `➥ *Tanggal:* ${new Date().toLocaleString('id-ID')}\n` +
                       `──────────────────────`;

  try {
    await bot.telegram.sendMessage(GROUP_ID, groupMessage, { parse_mode: 'Markdown' });
    console.log(`✅ Notifikasi perubahan role berhasil dikirim ke grup`);
  } catch (error) {
    console.error('🚫 Gagal mengirim notifikasi ke grup:', error.message);
  }
});

// Command untuk admin melihat daftar pengguna
bot.command('listusers', async (ctx) => {
  const users = await new Promise((resolve, reject) => {
    db.all('SELECT user_id, username, role, saldo, last_transaction_date, transaction_count FROM users', [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  if (users.length === 0) {
    return ctx.reply('⚠️ Tidak ada pengguna yang terdaftar.', { parse_mode: 'Markdown' });
  }

  let messages = [];
  let currentMessage = '📜 <b>Daftar Pengguna</b> 📜\n\n';

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const userText = 
      `🔹 ${i + 1}. <b>ID:</b> <code>${user.user_id}</code>\n` +
      `   <b>Username:</b> ${user.username || 'Tidak ada'}\n` +
      `   <b>Role:</b> ${user.role}\n` +
      `   <b>Saldo:</b> Rp ${user.saldo.toLocaleString('id-ID')}\n` +
      `   <b>Transaksi Terakhir:</b> ${user.last_transaction_date || 'Belum ada'}\n` +
      `   <b>Jumlah Transaksi:</b> ${user.transaction_count}\n\n`;

    if ((currentMessage + userText).length > 4000) {
      // Simpan pesan saat ini, mulai baru
      messages.push(currentMessage);
      currentMessage = '';
    }

    currentMessage += userText;
  }

  // Tambahkan sisa terakhir
  if (currentMessage) messages.push(currentMessage);

  // Kirim semua pesan satu per satu
  for (const msg of messages) {
    await ctx.reply(msg, { parse_mode: 'HTML' });
  }
});
bot.command('addbonus', async (ctx) => {
  userState[ctx.chat.id] = { step: 'bonus_jenis_menu' };

  const keyboard = [
    [{ text: '🆕 Deposit Pertama', callback_data: 'bonus_jenis_first' }],
    [{ text: '📅 Periode Tertentu', callback_data: 'bonus_jenis_period' }]
  ];

  await ctx.reply('🎁 *Pilih jenis bonus deposit yang ingin ditambahkan:*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
});

bot.command('ceksaldo', async (ctx) => {
  try {
    const adminId = ctx.from.id;
    if (adminId != ADMIN) {
      return await ctx.reply('🚫 *Anda tidak memiliki izin untuk melihat saldo semua pengguna.*', { parse_mode: 'Markdown' });
    }

    const users = await new Promise((resolve, reject) => {
      db.all('SELECT user_id, saldo FROM users', [], (err, rows) => {
        if (err) {
          console.error('🚫 Kesalahan saat mengambil data saldo semua user:', err.message);
          return reject('🚫 *Terjadi kesalahan saat mengambil data saldo semua pengguna.*');
        }
        resolve(rows);
      });
    });

    if (users.length === 0) {
      return await ctx.reply('⚠️ *Belum ada pengguna yang memiliki saldo.*', { parse_mode: 'Markdown' });
    }

    let message = '📊 *Saldo Semua Pengguna:*\n\n';
    users.forEach(user => {
      message += `🆔 ID: ${user.user_id} | 💳 Saldo: Rp${user.saldo}\n`;
    });

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('🚫 Kesalahan saat mengambil saldo semua user:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});

bot.command('upgrade_reseller', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 2) {
    return ctx.reply('⚠️ Format salah. Gunakan: `/upgrade_reseller <user_id>`', { parse_mode: 'Markdown' });
  }

  const targetUserId = parseInt(args[1]);

  db.run('UPDATE users SET role = "reseller", last_topup_date = ? WHERE user_id = ?', [new Date().toISOString(), targetUserId], function(err) {
    if (err) {
      console.error('Kesalahan saat meng-upgrade user ke reseller:', err.message);
      return ctx.reply('⚠️ Kesalahan saat meng-upgrade user ke reseller.', { parse_mode: 'Markdown' });
    }

    if (this.changes === 0) {
      return ctx.reply('⚠️ Pengguna tidak ditemukan.', { parse_mode: 'Markdown' });
    }

    ctx.reply(`✅ User dengan ID \`${targetUserId}\` berhasil di-upgrade ke reseller.`, { parse_mode: 'Markdown' });
  });
});

bot.command('broadcast', async (ctx) => {
  const userId = ctx.message.from.id;
  console.log(`Broadcast command received from user_id: ${userId}`);
  if (!adminIds.includes(userId)) {
      console.log(`⚠️ User ${userId} tidak memiliki izin untuk menggunakan perintah ini.`);
      return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const message = ctx.message.reply_to_message ? ctx.message.reply_to_message.text : ctx.message.text.split(' ').slice(1).join(' ');
  if (!message) {
      console.log('⚠️ Pesan untuk disiarkan tidak diberikan.');
      return ctx.reply('⚠️ Mohon berikan pesan untuk disiarkan.', { parse_mode: 'Markdown' });
  }

  db.all("SELECT user_id FROM users", [], (err, rows) => {
      if (err) {
          console.error('⚠️ Kesalahan saat mengambil daftar pengguna:', err.message);
          return ctx.reply('⚠️ Kesalahan saat mengambil daftar pengguna.', { parse_mode: 'Markdown' });
      }

      rows.forEach((row) => {
          const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
          axios.post(telegramUrl, {
              chat_id: row.user_id,
              text: message
          }).then(() => {
              console.log(`✅ Pesan siaran berhasil dikirim ke ${row.user_id}`);
          }).catch((error) => {
              console.error(`⚠️ Kesalahan saat mengirim pesan siaran ke ${row.user_id}`, error.message);
          });
      });

      ctx.reply('✅ Pesan siaran berhasil dikirim.', { parse_mode: 'Markdown' });
  });
});

global.broadcastMessages = {}; // Penyimpanan sementara pesan yang akan dikirim

bot.command('send', async (ctx) => {
    const userId = ctx.message.from.id;
    if (!adminIds.includes(userId)) {
        return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
    }

    const args = ctx.message.text.split(' ').slice(0);
    const message = ctx.message.reply_to_message ? ctx.message.reply_to_message.text : args.slice(1).join(' ');

    if (!message) {
        return ctx.reply('⚠️ Mohon berikan pesan untuk disiarkan.', { parse_mode: 'Markdown' });
    }

    if (args.length > 0 && !isNaN(args[0])) {
        // Jika admin memasukkan user_id langsung
        const targetUserId = args[0];
        sendMessageToUser(targetUserId, message, ctx);
    } else {
        // Jika tidak ada user_id, tampilkan daftar user untuk dipilih
        db.all("SELECT user_id FROM users", [], async (err, rows) => {
            if (err) {
                console.error('⚠️ Kesalahan saat mengambil daftar pengguna:', err.message);
                return ctx.reply('⚠️ Kesalahan saat mengambil daftar pengguna.', { parse_mode: 'Markdown' });
            }

            if (rows.length === 0) {
                return ctx.reply('⚠️ Tidak ada pengguna dalam database.', { parse_mode: 'Markdown' });
            }

            const buttons = [];
            for (let i = 0; i < rows.length; i += 2) {
                const row = [];

                // Buat ID unik untuk pesan ini
                const messageId = crypto.randomUUID();
                global.broadcastMessages[messageId] = message;

                const username1 = await getUsernameById(rows[i].user_id);
                row.push({ text: username1, callback_data: `broadcast_${rows[i].user_id}_${messageId}` });

                if (i + 1 < rows.length) {
                    const messageId2 = crypto.randomUUID();
                    global.broadcastMessages[messageId2] = message;

                    const username2 = await getUsernameById(rows[i + 1].user_id);
                    row.push({ text: username2, callback_data: `broadcast_${rows[i + 1].user_id}_${messageId2}` });
                }

                buttons.push(row);
            }

            ctx.reply('📢 Pilih pengguna untuk menerima Pesan:', {
                reply_markup: { inline_keyboard: buttons }
            });
        });
    }
});
bot.action('bonus_deposit_menu', async (ctx) => {
const keyboard = [
  [{ text: '➕ Tambah Bonus Baru', callback_data: 'add_bonus_deposit' }],
  [{ text: '📃 Lihat Bonus Aktif', callback_data: 'lihat_bonus_deposit' }],
  [
    { text: '❌ Nonaktifkan Bonus Pertama', callback_data: 'disable_bonus_first' },
    { text: '❌ Nonaktifkan Bonus Periode', callback_data: 'disable_bonus_period' }
  ],
  [{ text: '🔙 Kembali ke Menu Admin', callback_data: 'admin_menu' }]
];

  await ctx.editMessageText('🎁 *Kelola Bonus Deposit*\nSilakan pilih aksi yang ingin Anda lakukan:', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
});

bot.action('add_bonus_deposit', async (ctx) => {
  userState[ctx.chat.id] = { step: 'bonus_jenis' };

  const keyboard = [
    [{ text: '🆕 Deposit Pertama', callback_data: 'bonus_jenis_first' }],
    [{ text: '📅 Periode Tertentu', callback_data: 'bonus_jenis_period' }],
    [{ text: '🔙 Kembali', callback_data: 'bonus_deposit_menu' }]
  ];

  await ctx.editMessageText('📌 *Pilih jenis bonus yang ingin ditambahkan:*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
});

bot.action('lihat_bonus_deposit', async (ctx) => {
  db.all(`SELECT * FROM deposit_bonus_rules WHERE is_active = 1`, (err, rows) => {
    if (err) {
      console.error('❌ Gagal mengambil data bonus:', err.message);
      return ctx.reply('❌ *Gagal menampilkan bonus aktif.*', { parse_mode: 'Markdown' });
    }

    if (!rows || rows.length === 0) {
      return ctx.reply('⚠️ *Tidak ada bonus deposit yang aktif saat ini.*', { parse_mode: 'Markdown' });
    }

    let msg = '🎁 *Daftar Bonus Aktif:*\n\n';

    rows.forEach((bonus) => {
      msg += `🆔 *ID*: ${bonus.id}\n`;
      msg += `📌 *Jenis*: ${bonus.jenis_bonus === 'first' ? 'Deposit Pertama' : 'Periode'}\n`;
      msg += `💰 *Min Deposit*: Rp ${bonus.min_deposit.toLocaleString('id-ID')}\n`;
      msg += `🎉 *Bonus*: ${bonus.bonus_percent}%\n`;

      if (bonus.jenis_bonus === 'period') {
        msg += `📅 *Periode*: ${bonus.start_date} s.d. ${bonus.end_date}\n`;
      }

      msg += '──────────────\n';
    });

    ctx.reply(msg, { parse_mode: 'Markdown' });
  });
});

bot.action('disable_bonus_first', async (ctx) => {
  db.run(`UPDATE deposit_bonus_rules SET is_active = 0 WHERE jenis_bonus = 'first'`, (err) => {
    if (err) {
      console.error('❌ Gagal menonaktifkan bonus pertama:', err.message);
      return ctx.reply('❌ *Gagal menonaktifkan bonus pertama. Coba lagi nanti.*', { parse_mode: 'Markdown' });
    }

    ctx.reply('✅ *Bonus deposit pertama telah dinonaktifkan.*', { parse_mode: 'Markdown' });
  });
});

bot.action('disable_bonus_period', async (ctx) => {
  db.run(`UPDATE deposit_bonus_rules SET is_active = 0 WHERE jenis_bonus = 'period'`, (err) => {
    if (err) {
      console.error('❌ Gagal menonaktifkan bonus periode:', err.message);
      return ctx.reply('❌ *Gagal menonaktifkan bonus periode. Coba lagi nanti.*', { parse_mode: 'Markdown' });
    }

    ctx.reply('✅ *Bonus deposit periode telah dinonaktifkan.*', { parse_mode: 'Markdown' });
  });
});

bot.action('main_menu', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await sendMainMenu(ctx);
});

bot.action('admin_menu', async (ctx) => {
  const userId = ctx.from.id;
  if (!adminIds.includes(userId)) {
    await ctx.reply('🚫 Anda tidak memiliki izin untuk mengakses menu admin.');
    return;
  }

  await sendAdminMenu(ctx);
});

bot.action('cek_saldo_semua', async (ctx) => {
  const userId = ctx.from.id;
  if (!adminIds.includes(userId)) {
    await ctx.reply('🚫 Anda tidak memiliki izin untuk melihat saldo semua pengguna.');
    return;
  }

  await handleCekSaldoSemua(ctx, userId);
});
bot.action(/^bonus_jenis_(first|period)$/, async (ctx) => {
  const jenis = ctx.match[1];
  userState[ctx.chat.id] = {
    step: 'bonus_min_deposit',
    jenis_bonus: jenis
  };

  await ctx.editMessageText(`💵 *Masukkan minimal deposit (dalam angka, tanpa titik/koma):*`, {
    parse_mode: 'Markdown'
  });
});

bot.action(/^broadcast_(\d+)_(.+)$/, async (ctx) => {
    const match = ctx.match;
    if (!match) return;
    const userId = match[1];
    const messageId = match[2];

    const message = global.broadcastMessages[messageId];
    if (!message) {
        return ctx.reply('⚠️ Pesan tidak ditemukan atau telah kadaluarsa.');
    }

    delete global.broadcastMessages[messageId]; // Hapus dari cache setelah digunakan
    sendMessageToUser(userId, message, ctx);
});

async function sendMessageToUser(userId, message, ctx) {
    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: userId,
            text: message
        });
        ctx.reply(`✅ Pesan berhasil dikirim ke ${userId}`);
    } catch (error) {
        console.error(`⚠️ Gagal mengirim pesan ke ${userId}:`, error.message);
        ctx.reply(`⚠️ Gagal mengirim pesan ke ${userId}`);
    }
}

async function getUserRole(userId) {
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT role FROM users WHERE user_id = ?', [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    console.log(`Role pengguna ${userId}:`, user ? user.role : 'member'); // Log role pengguna

    // Jika role tidak ditemukan, default ke 'member'
    return user ? user.role : 'member';
  } catch (error) {
    console.error('🚫 Error saat mengambil role pengguna:', error);
    return 'member'; // Default ke 'member' jika terjadi error
  }
}

async function sendGroupNotificationPurchase(username, userId, serviceType, serverName, expDays) {
  // Ambil role pengguna dari database
  const userRole = await getUserRole(userId);

  // Ambil harga server dari database (sesuai role pengguna)
  const server = await new Promise((resolve, reject) => {
    db.get(
      'SELECT harga, harga_reseller FROM Server WHERE nama_server = ?',
      [serverName],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });

  // Tentukan harga berdasarkan role pengguna
  const hargaPerHari = userRole === 'reseller' ? server.harga_reseller : server.harga;

  // Hitung total harga berdasarkan masa aktif
  const totalHarga = hargaPerHari * expDays; // Total harga = harga per hari * masa aktif

  // Format tanggal saat ini
  const currentDate = new Date().toLocaleString('id-ID');

  const groupMessage = `
──────────────────────
⟨ TRX BOT ${NAMA_STORE} ⟩
──────────────────────
THANKS TO
➥ User  : [${username}](tg://user?id=${userId})
➥ Role  : ${userRole === 'reseller' ? 'Reseller 🛒' : 'Member 👤'}
──────────────────────
➥ Layanan : ${serviceType}
➥ Server : ${serverName}
➥ Harga per Hari : Rp${hargaPerHari.toLocaleString('id-ID')}
➥ Masa Aktif : ${expDays} Hari
➥ Total Harga : Rp${totalHarga.toLocaleString('id-ID')}
➥ Tanggal : ${currentDate}
──────────────────────
`;

  try {
    await bot.telegram.sendMessage(GROUP_ID, groupMessage, { parse_mode: 'Markdown' });
    console.log(`✅ Notifikasi pembelian berhasil dikirim ke grup untuk user ${username}`);
  } catch (error) {
    console.error('🚫 Gagal mengirim notifikasi pembelian ke grup:', error.message);
  }
}

bot.command('addblok', async (ctx) => {
  const adminId = ctx.message.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('🚫 Anda tidak memiliki izin untuk menggunakan perintah ini.');
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 2) {
    return ctx.reply('⚠️ Format salah. Gunakan: /addblok <user_id>');
  }

  const targetId = parseInt(args[1]);
  if (isNaN(targetId)) {
    return ctx.reply('⚠️ ID tidak valid.');
  }

  db.run('UPDATE users SET is_blocked = 1 WHERE user_id = ?', [targetId], function(err) {
    if (err) {
      return ctx.reply('❌ Gagal memblokir pengguna.');
    }
    ctx.reply(`✅ Pengguna ${targetId} berhasil diblokir.`);
    bot.telegram.sendMessage(targetId, '🚫 Anda adalah kriminal, Anda telah diblokir.');
  });
});

bot.command('unblok', async (ctx) => {
  const adminId = ctx.message.from.id;
  if (!adminIds.includes(adminId)) {
    return ctx.reply('🚫 Anda tidak memiliki izin untuk menggunakan perintah ini.');
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 2) {
    return ctx.reply('⚠️ Format salah. Gunakan: /unblok <user_id>');
  }

  const targetId = parseInt(args[1]);
  if (isNaN(targetId)) {
    return ctx.reply('⚠️ ID tidak valid.');
  }

  db.run('UPDATE users SET is_blocked = 0 WHERE user_id = ?', [targetId], function(err) {
    if (err) {
      return ctx.reply('❌ Gagal membuka blokir pengguna.');
    }

    ctx.reply(`✅ Blokir pengguna ${targetId} telah dibuka.`);
    bot.telegram.sendMessage(targetId, '✅ Kamu telah dibebaskan. Akses bot kembali tersedia.');
  });
});

bot.command('addsaldo', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
    return ctx.reply('⚠️ Format salah. Gunakan: `/addsaldo <user_id> <jumlah>`', { parse_mode: 'Markdown' });
  }

  const targetUserId = parseInt(args[1]);
  const nominal = parseInt(args[2]);

  if (isNaN(targetUserId) || isNaN(nominal)) {
    return ctx.reply('⚠️ `user_id` dan `jumlah` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  if (nominal < 0) {
    return ctx.reply('⚠️ Jumlah saldo tidak boleh negatif.', { parse_mode: 'Markdown' });
  }

  try {
    // Cek bonus saldo
    const bonus = await cekDanHitungBonusDeposit(targetUserId, nominal);
    const totalSaldo = nominal + bonus;

    db.run('UPDATE users SET saldo = saldo + ?, sudah_dapat_bonus_first = sudah_dapat_bonus_first OR ? WHERE user_id = ?', [totalSaldo, bonus > 0 ? 1 : 0, targetUserId], async (err) => {
      if (err) {
        console.error('❌ Gagal menambahkan saldo:', err.message);
        return ctx.reply('❌ Terjadi kesalahan saat menambahkan saldo.', { parse_mode: 'Markdown' });
      }

      // Cek & update role jika memenuhi syarat
      if (totalSaldo >= 25000) {
        await checkAndUpdateUserRole(targetUserId);
      }

      // Notifikasi ke user
      let notif = `✅ *Saldo telah ditambahkan!*\n\n📥 Tambahan: *Rp ${nominal.toLocaleString('id-ID')}*`;
      if (bonus > 0) {
        notif += `\n🎁 Bonus: *Rp ${bonus.toLocaleString('id-ID')}*`;
        notif += `\n💰 Total Masuk: *Rp ${totalSaldo.toLocaleString('id-ID')}*`;
      }
      await ctx.telegram.sendMessage(targetUserId, notif, { parse_mode: 'Markdown' });

      // Notifikasi ke admin
      await ctx.reply(`✅ Saldo berhasil ditambahkan ke user ID ${targetUserId}.\n💸 Total Masuk: *Rp ${totalSaldo.toLocaleString('id-ID')}*`, { parse_mode: 'Markdown' });

      // Notifikasi ke grup
      const username = await getUsernameById(targetUserId);
      await sendGroupNotificationTopup(username, targetUserId, nominal, bonus);
    });
  } catch (error) {
    console.error('🚫 Kesalahan saat menambahkan saldo:', error);
    await ctx.reply('🚫 Terjadi kesalahan saat menambahkan saldo.', { parse_mode: 'Markdown' });
  }
});

bot.command('hapusserver', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 2) {
    return ctx.reply('⚠️ Format salah. Gunakan: `/hapusserver <server_id>`', { parse_mode: 'Markdown' });
  }

  const serverId = parseInt(args[1]);

  if (isNaN(serverId)) {
    return ctx.reply('⚠️ `server_id` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  db.run('DELETE FROM Server WHERE id = ?', [serverId], function(err) {
    if (err) {
      console.error('⚠️ Kesalahan saat menghapus server:', err.message);
      return ctx.reply('⚠️ Kesalahan saat menghapus server.', { parse_mode: 'Markdown' });
    }

    if (this.changes === 0) {
      return ctx.reply('⚠️ Server tidak ditemukan.', { parse_mode: 'Markdown' });
    }

    ctx.reply(`✅ Server dengan ID \`${serverId}\` berhasil dihapus.`, { parse_mode: 'Markdown' });
  });
});

bot.command('listserver', async (ctx) => {
  try {
    const servers = await new Promise((resolve, reject) => {
      db.all('SELECT id, nama_server FROM Server', [], (err, servers) => {
        if (err) {
          console.error('⚠️ Kesalahan saat mengambil daftar server:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
        }
        resolve(servers);
      });
    });

    if (servers.length === 0) {
      return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia saat ini.*', { parse_mode: 'Markdown' });
    }

    let serverList = '📜 *Daftar Server* 📜\n\n';
    servers.forEach((server, index) => {
      serverList += `🔹 ${index + 1}. ${server.nama_server} (ID: ${server.id})\n`;
    });

    serverList += `\nTotal Jumlah Server: ${servers.length}`;

    await ctx.reply(serverList, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('⚠️ Kesalahan saat mengambil daftar server:', error);
    await ctx.reply('⚠️ *Terjadi kesalahan saat mengambil daftar server.*', { parse_mode: 'Markdown' });
  }
});

bot.command('detailserver', async (ctx) => {
  try {
    const servers = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM Server', [], (err, servers) => {
        if (err) {
          console.error('⚠️ Kesalahan saat mengambil detail server:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil detail server.*');
        }
        resolve(servers);
      });
    });

    if (servers.length === 0) {
      return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia saat ini.*', { parse_mode: 'Markdown' });
    }

    const buttons = servers.map(server => ({
      text: `${server.nama_server} (ID: ${server.id})`,
      callback_data: `server_detail_${server.id}`
    }));

    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      inlineKeyboard.push(buttons.slice(i, i + 2));
    }

    await ctx.reply('📋 *Silakan pilih server untuk melihat detail:*', {
      reply_markup: { inline_keyboard: inlineKeyboard },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('⚠️ Kesalahan saat mengambil detail server:', error);
    await ctx.reply('⚠️ *Terjadi kesalahan saat mengambil detail server.*', { parse_mode: 'Markdown' });
  }
});

bot.command('addserver', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.trim().split(/\s+/);
  if (args.length !== 10) {
    return ctx.reply(
      '⚠️ Format salah.\n\n' +
      'Gunakan:\n' +
      '`/addserver <type> <domain> <auth|-> <harga> <harga_reseller> <nama_server> <quota> <iplimit> <batas_create_akun>`\n\n' +
      'Contoh XRAY:\n' +
      '`/addserver xray server.com myAuth 10000 8000 SG1 100 2 200`\n\n' +
      'Contoh UDPZI:\n' +
      '`/addserver udpzi api.udpzi.com - 10000 8000 UDPZI-SG1 100 2 200`',
      { parse_mode: 'Markdown' }
    );
  }

  const [
    _cmd,
    server_type_raw,
    domain_raw,
    auth_raw,
    harga_raw,
    harga_reseller_raw,
    nama_server_raw,
    quota_raw,
    iplimit_raw,
    batas_create_akun_raw
  ] = args;

  const server_type = String(server_type_raw || '').toLowerCase();
  if (!['xray', 'udpzi'].includes(server_type)) {
    return ctx.reply('⚠️ `type` tidak valid. Gunakan: `xray` atau `udpzi`', { parse_mode: 'Markdown' });
  }

  const domain = String(domain_raw || '').trim();
  if (!domain) {
    return ctx.reply('⚠️ `domain` tidak boleh kosong.', { parse_mode: 'Markdown' });
  }

  // UDPZI tidak butuh auth
  const auth = (server_type === 'udpzi' && (auth_raw === '-' || auth_raw === '')) ? '' : String(auth_raw || '').trim();

  const numberOnlyRegex = /^\d+$/;
  if (
    !numberOnlyRegex.test(harga_raw) ||
    !numberOnlyRegex.test(harga_reseller_raw) ||
    !numberOnlyRegex.test(quota_raw) ||
    !numberOnlyRegex.test(iplimit_raw) ||
    !numberOnlyRegex.test(batas_create_akun_raw)
  ) {
    return ctx.reply('⚠️ `harga`, `harga_reseller`, `quota`, `iplimit`, dan `batas_create_akun` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  const harga = parseInt(harga_raw, 10);
  const harga_reseller = parseInt(harga_reseller_raw, 10);
  const quota = parseInt(quota_raw, 10);
  const iplimit = parseInt(iplimit_raw, 10);
  const batas_create_akun = parseInt(batas_create_akun_raw, 10);

  db.run(
    `INSERT INTO Server 
      (domain, auth, harga, harga_reseller, nama_server, quota, iplimit, batas_create_akun, total_create_akun, server_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [domain, auth, harga, harga_reseller, nama_server_raw, quota, iplimit, batas_create_akun, 0, server_type],
    function (err) {
      if (err) {
        console.error('⚠️ Kesalahan saat menambahkan server:', err.message);
        return ctx.reply('⚠️ Kesalahan saat menambahkan server.', { parse_mode: 'Markdown' });
      }

      return ctx.reply(
        `✅ *Server berhasil ditambahkan!*\n\n` +
        `📄 *Detail Server:*\n` +
        `- ID: \`${this.lastID}\`\n` +
        `- Tipe: \`${server_type}\`\n` +
        `- Nama: \`${nama_server_raw}\`\n` +
        `- Domain: \`${domain}\`\n` +
        `- Auth: \`${auth || '-'}\`\n` +
        `- Quota: \`${quota}\`\n` +
        `- Limit IP: \`${iplimit}\`\n` +
        `- Batas Create Akun: \`${batas_create_akun}\`\n` +
        `- Harga: \`${harga}\`\n` +
        `- Harga Reseller: \`${harga_reseller}\``,
        { parse_mode: 'Markdown' }
      );
    }
  );
});


bot.command('editreseller', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
    return ctx.reply('⚠️ Format salah. Gunakan: `/editreseller <domain> <harga_reseller>`', { parse_mode: 'Markdown' });
  }

  const [ , domain, hargaReseller ] = args;
  if (!/^\d+$/.test(hargaReseller)) {
    return ctx.reply('⚠️ `harga_reseller` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  db.run(
    "UPDATE Server SET harga_reseller = ? WHERE domain = ?",
    [parseInt(hargaReseller, 10), domain],
    function(err) {
      if (err) {
        console.error('⚠️ Kesalahan saat mengedit harga_reseller server:', err.message);
        return ctx.reply('⚠️ Kesalahan saat mengedit harga_reseller server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
        return ctx.reply('⚠️ Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(
        `✅ Harga reseller untuk server \`${domain}\` berhasil diubah menjadi \`${hargaReseller}\`.`,
        { parse_mode: 'Markdown' }
      );
    }
  );
});

bot.command('testpdf', async (ctx) => {
  const pdfBuffer = await generateReceiptPDF({
    userId: ctx.from.id,
    nominal: 10000,
    reference: 'TEST123',
    tanggal: new Date().toLocaleString('id-ID')
  });

  await ctx.replyWithDocument({ source: pdfBuffer, filename: 'test_receipt.pdf' });
});

bot.command('editharga', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply('⚠️ Format salah. Gunakan: `/editharga <domain> <harga>`', { parse_mode: 'Markdown' });
  }

  const [domain, harga] = args.slice(1);

  if (!/^\d+$/.test(harga)) {
      return ctx.reply('⚠️ `harga` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  db.run("UPDATE Server SET harga = ? WHERE domain = ?", [parseInt(harga), domain], function(err) {
      if (err) {
          console.error('⚠️ Kesalahan saat mengedit harga server:', err.message);
          return ctx.reply('⚠️ Kesalahan saat mengedit harga server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply('⚠️ Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(`✅ Harga server \`${domain}\` berhasil diubah menjadi \`${harga}\`.`, { parse_mode: 'Markdown' });
  });
});

bot.command('editnama', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

	const args = ctx.message.text.trim().split(' ');

	// Minimal 3 bagian: /editnama <id> <nama_baru>
	if (args.length < 3) {
	  return ctx.reply('⚠️ Format salah. Gunakan: `/editnama <idserver> <nama_server>`', { parse_mode: 'Markdown' });
	}

	// Validasi ID sebagai angka
	const id = parseInt(args[1], 10);
	if (isNaN(id)) {
	  return ctx.reply('⚠️ ID server harus berupa angka!', { parse_mode: 'Markdown' });
	}

	// Gabungkan sisa jadi nama server
	const nama_server = args.slice(2).join(' ');

  db.run("UPDATE Server SET nama_server = ? WHERE id = ?", [nama_server, id], function(err) {
      if (err) {
          console.error('⚠️ Kesalahan saat mengedit nama server:', err.message);
          return ctx.reply('⚠️ Kesalahan saat mengedit nama server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply('⚠️ Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(`✅ Nama server \`${id}\` berhasil diubah menjadi \`${nama_server}\`.`, { parse_mode: 'Markdown' });
  });
});

bot.command('editdomain', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply('⚠️ Format salah. Gunakan: `/editdomain <old_domain> <new_domain>`', { parse_mode: 'Markdown' });
  }

  const [old_domain, new_domain] = args.slice(1);

  db.run("UPDATE Server SET domain = ? WHERE domain = ?", [new_domain, old_domain], function(err) {
      if (err) {
          console.error('⚠️ Kesalahan saat mengedit domain server:', err.message);
          return ctx.reply('⚠️ Kesalahan saat mengedit domain server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply('⚠️ Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(`✅ Domain server \`${old_domain}\` berhasil diubah menjadi \`${new_domain}\`.`, { parse_mode: 'Markdown' });
  });
});

bot.command('editauth', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply('⚠️ Format salah. Gunakan: `/editauth <domain> <auth>`', { parse_mode: 'Markdown' });
  }

  const [domain, auth] = args.slice(1);

  // Periksa apakah domain ada dalam database
  db.get("SELECT * FROM Server WHERE domain = ?", [domain], (err, row) => {
      if (err) {
          console.error('⚠️ Kesalahan saat mengambil data server:', err.message);
          return ctx.reply('⚠️ Terjadi kesalahan saat mengambil data server.', { parse_mode: 'Markdown' });
      }

      if (!row) {
          return ctx.reply(`⚠️ Server dengan domain \`${domain}\` tidak ditemukan.`, { parse_mode: 'Markdown' });
      }

      // Update auth jika server ditemukan
      db.run("UPDATE Server SET auth = ? WHERE domain = ?", [auth, domain], function(err) {
          if (err) {
              console.error('⚠️ Kesalahan saat mengedit auth server:', err.message);
              return ctx.reply('⚠️ Kesalahan saat mengedit auth server.', { parse_mode: 'Markdown' });
          }

          ctx.reply(`✅ Auth server \`${domain}\` berhasil diubah menjadi \`${auth}\`.`, { parse_mode: 'Markdown' });
      });
  });
});


bot.command('editlimitquota', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply('⚠️ Format salah. Gunakan: `/editlimitquota <domain> <quota>`', { parse_mode: 'Markdown' });
  }

  const [domain, quota] = args.slice(1);

  if (!/^\d+$/.test(quota)) {
      return ctx.reply('⚠️ `quota` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  db.run("UPDATE Server SET quota = ? WHERE domain = ?", [parseInt(quota), domain], function(err) {
      if (err) {
          console.error('⚠️ Kesalahan saat mengedit quota server:', err.message);
          return ctx.reply('⚠️ Kesalahan saat mengedit quota server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply('⚠️ Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(`✅ Quota server \`${domain}\` berhasil diubah menjadi \`${quota}\`.`, { parse_mode: 'Markdown' });
  });
});

bot.command('editlimitip', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply('⚠️ Format salah. Gunakan: `/editlimitip <domain> <iplimit>`', { parse_mode: 'Markdown' });
  }

  const [domain, iplimit] = args.slice(1);

  if (!/^\d+$/.test(iplimit)) {
      return ctx.reply('⚠️ `iplimit` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  db.run("UPDATE Server SET iplimit = ? WHERE domain = ?", [parseInt(iplimit), domain], function(err) {
      if (err) {
          console.error('⚠️ Kesalahan saat mengedit iplimit server:', err.message);
          return ctx.reply('⚠️ Kesalahan saat mengedit iplimit server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply('⚠️ Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(`✅ Iplimit server \`${domain}\` berhasil diubah menjadi \`${iplimit}\`.`, { parse_mode: 'Markdown' });
  });
});

bot.command('editlimitcreate', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply('⚠️ Format salah. Gunakan: `/editlimitcreate <domain> <batas_create_akun>`', { parse_mode: 'Markdown' });
  }

  const [domain, batas_create_akun] = args.slice(1);

  if (!/^\d+$/.test(batas_create_akun)) {
      return ctx.reply('⚠️ `batas_create_akun` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  db.run("UPDATE Server SET batas_create_akun = ? WHERE domain = ?", [parseInt(batas_create_akun), domain], function(err) {
      if (err) {
          console.error('⚠️ Kesalahan saat mengedit batas_create_akun server:', err.message);
          return ctx.reply('⚠️ Kesalahan saat mengedit batas_create_akun server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply('⚠️ Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(`✅ Batas create akun server \`${domain}\` berhasil diubah menjadi \`${batas_create_akun}\`.`, { parse_mode: 'Markdown' });
  });
});
bot.command('hapussaldo', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
    return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
    return ctx.reply('⚠️ Format salah. Gunakan: `/hapussaldo <user_id> <jumlah>`', { parse_mode: 'Markdown' });
  }

  const targetUserId = parseInt(args[1]);
  const amount = parseInt(args[2]);

  if (isNaN(targetUserId) || isNaN(amount)) {
    return ctx.reply('⚠️ `user_id` dan `jumlah` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  if (amount <= 0) {
    return ctx.reply('⚠️ Jumlah saldo yang dihapus harus lebih besar dari 0.', { parse_mode: 'Markdown' });
  }

  db.get("SELECT * FROM users WHERE user_id = ?", [targetUserId], (err, row) => {
    if (err) {
      console.error('⚠️ Kesalahan saat memeriksa `user_id`:', err.message);
      return ctx.reply('⚠️ Kesalahan saat memeriksa `user_id`.', { parse_mode: 'Markdown' });
    }

    if (!row) {
      return ctx.reply('⚠️ `user_id` tidak terdaftar.', { parse_mode: 'Markdown' });
    }

    if (row.saldo < amount) {
      return ctx.reply('⚠️ Saldo pengguna tidak mencukupi untuk dihapus.', { parse_mode: 'Markdown' });
    }

    db.run("UPDATE users SET saldo = saldo - ? WHERE user_id = ?", [amount, targetUserId], function(err) {
      if (err) {
        console.error('⚠️ Kesalahan saat menghapus saldo:', err.message);
        return ctx.reply('⚠️ Kesalahan saat menghapus saldo.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
        return ctx.reply('⚠️ Pengguna tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(`✅ Saldo sebesar \`${amount}\` berhasil dihapus dari \`user_id\` \`${targetUserId}\`.`, { parse_mode: 'Markdown' });
    });
  });
});


bot.command('edittotalcreate', async (ctx) => {
  const userId = ctx.message.from.id;
  if (!adminIds.includes(userId)) {
      return ctx.reply('⚠️ Anda tidak memiliki izin untuk menggunakan perintah ini.', { parse_mode: 'Markdown' });
  }

  const args = ctx.message.text.split(' ');
  if (args.length !== 3) {
      return ctx.reply('⚠️ Format salah. Gunakan: `/edittotalcreate <domain> <total_create_akun>`', { parse_mode: 'Markdown' });
  }

  const [domain, total_create_akun] = args.slice(1);

  if (!/^\d+$/.test(total_create_akun)) {
      return ctx.reply('⚠️ `total_create_akun` harus berupa angka.', { parse_mode: 'Markdown' });
  }

  db.run("UPDATE Server SET total_create_akun = ? WHERE domain = ?", [parseInt(total_create_akun), domain], function(err) {
      if (err) {
          console.error('⚠️ Kesalahan saat mengedit total_create_akun server:', err.message);
          return ctx.reply('⚠️ Kesalahan saat mengedit total_create_akun server.', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
          return ctx.reply('⚠️ Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }

      ctx.reply(`✅ Total create akun server \`${domain}\` berhasil diubah menjadi \`${total_create_akun}\`.`, { parse_mode: 'Markdown' });
  });
});


async function handleServiceAction(ctx, action) {
  let keyboard;
    if (action === 'trial') {
    keyboard = [
      [
        { text: 'SSH', callback_data: 'trial_ssh' },
        { text: 'VMESS', callback_data: 'trial_vmess' }
      ],
      [
        { text: 'VLESS', callback_data: 'trial_vless' },
        { text: 'TROJAN', callback_data: 'trial_trojan' }
      ],
      [{ text: 'KEMBALI', callback_data: 'kembali' }] // Tombol Kembali
    ]; 
  } else if (action === 'create') {
    keyboard = [
      [
        { text: 'SSH', callback_data: 'create_ssh' },
        { text: 'VMESS', callback_data: 'create_vmess' }
      ],
      [
        { text: 'VLESS', callback_data: 'create_vless' },
        { text: 'TROJAN', callback_data: 'create_trojan' }
      ],
      [{ text: 'KEMBALI', callback_data: 'kembali' }] // Tombol Kembali
    ];
  } else if (action === 'renew') {
    keyboard = [
      [
        { text: 'RENEW SSH', callback_data: 'renew_ssh' },
        { text: 'RENEW VMESS', callback_data: 'renew_vmess' }
      ],
      [
        { text: 'RENEW VLESS', callback_data: 'renew_vless' },
        { text: 'RENEW TROJAN', callback_data: 'renew_trojan' }
      ],
      [{ text: '🔙 Kembali', callback_data: 'kembali' }] // Tombol Kembali
    ];
  }

  try {
    await ctx.editMessageReplyMarkup({
      inline_keyboard: keyboard
    });
    console.log(`${action} service menu sent`);
  } catch (error) {
    if (error.response && error.response.error_code === 400) {
      // Jika pesan tidak dapat diedit, kirim pesan baru
      await ctx.reply(`Pilih jenis layanan yang ingin Anda ${action}:`, {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
      console.log(`${action} service menu sent as new message`);
    } else {
      console.error(`Error saat mengirim menu ${action}:`, error);
    }
  }
}

bot.action('kembali', async (ctx) => {
  console.log('Tombol Kembali diklik oleh:', ctx.from.id);

  try {
    // Coba hapus pesan menu saat ini
    try {
      await ctx.deleteMessage();
      console.log('Pesan menu dihapus.');
    } catch (deleteError) {
      console.warn('Tidak dapat menghapus pesan:', deleteError.message);
      // Jika pesan tidak dapat dihapus, lanjutkan tanpa menghapus
    }

    // Tampilkan menu utama
    await sendMainMenu(ctx);
  } catch (error) {
    console.error('Gagal memproses permintaan:', error);
    await ctx.reply('🚫 Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi.', { parse_mode: 'Markdown' });
  }
});
async function sendAdminMenu(ctx) {
  const adminKeyboard = [
    [
      { text: '➕ Tambah Server', callback_data: 'addserver' },
      { text: '🚫 Hapus Server', callback_data: 'deleteserver' }
    ],
    [
      { text: '💲 Edit Harga', callback_data: 'editserver_harga' },
      { text: '📝 Edit Nama', callback_data: 'nama_server_edit' }
    ],
    [
      { text: '🌍 Edit Domain', callback_data: 'editserver_domain' },
      { text: '🔑 Edit Auth', callback_data: 'editserver_auth' }
    ],
    [
      { text: '📊 Edit Quota', callback_data: 'editserver_quota' },
      { text: '📶 Edit Limit IP', callback_data: 'editserver_limit_ip' }
    ],
    [
      { text: '🔢 Edit Batas Create', callback_data: 'editserver_batas_create_akun' },
      { text: '🔢 Edit Total Create', callback_data: 'editserver_total_create_akun' }
    ],
    [
      { text: '💵 Tambah Saldo', callback_data: 'addsaldo_user' },
      { text: '📋 List Server', callback_data: 'listserver' }
    ],
    [
      { text: '♻️ Reset Server', callback_data: 'resetdb' },
      { text: 'ℹ️ Detail Server', callback_data: 'detailserver' }
    ],
    [
      { text: '🎁 Bonus Deposit', callback_data: 'bonus_deposit_menu' }
    ],
    [
      { text: '🔙 Kembali ke Main Menu', callback_data: 'send_main_menu' }
    ]
  ];

  try {
    await ctx.editMessageReplyMarkup({
      inline_keyboard: adminKeyboard
    });
    console.log('Admin menu sent');
  } catch (error) {
    if (error.response && error.response.error_code === 400) {
      // Jika pesan tidak dapat diedit, kirim pesan baru
      await ctx.reply('Menu Admin:', {
        reply_markup: {
          inline_keyboard: adminKeyboard
        }
      });
      console.log('Admin menu sent as new message');
    } else {
      console.error('Error saat mengirim menu admin:', error);
    }
  }
}

bot.action('send_main_menu', async (ctx) => {
  console.log('Tombol Kembali ke Menu Utama diklik oleh:', ctx.from.id);

  try {
    // Coba hapus pesan menu saat ini
    try {
      await ctx.deleteMessage();
      console.log('Pesan menu dihapus.');
    } catch (deleteError) {
      console.warn('Tidak dapat menghapus pesan:', deleteError.message);
      // Jika pesan tidak dapat dihapus, lanjutkan tanpa menghapus
    }

    // Tampilkan menu utama
    await sendMainMenu(ctx);
  } catch (error) {
    console.error('Gagal memproses permintaan:', error);
    await ctx.reply('🚫 Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi.', { parse_mode: 'Markdown' });
  }
});

bot.action('hapus_akun_menu', async (ctx) => {
  const userId = ctx.from.id.toString();

  try {
    const now = dayjs().format('YYYY-MM-DD'); // Format banding aman

    const akunAktif = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM user_accounts WHERE user_id = ?`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

	const aktifFiltered = akunAktif.filter((akun) => {
	  const exp = dayjs(akun.expired, 'YYYY-MM-DD');
	  console.log('DEBUG: expired raw =', akun.expired, '| parsed =', exp.format('YYYY-MM-DD'));

	  return exp.isAfter(dayjs());
	});

    if (aktifFiltered.length === 0) {
      return ctx.reply('⚠️ Anda tidak memiliki akun aktif untuk dihapus.');
    }

    // Susun tombol akun
    const buttons = aktifFiltered.map((akun) => [
      {
        text: `🗑️ ${akun.jenis.toUpperCase()} | ${akun.username} (Exp: ${akun.expired})`,
        callback_data: `hapus_akun_id_${akun.id}`
      }
    ]);

    await ctx.reply('🔽 Pilih akun yang ingin Anda hapus:', {
      reply_markup: {
        inline_keyboard: buttons
      }
    });
  } catch (err) {
    console.error('Gagal mengambil akun aktif:', err);
    await ctx.reply('❌ Terjadi kesalahan saat mengambil data akun Anda.');
  }
});

bot.action('service_create', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await handleServiceAction(ctx, 'create');
});

bot.action('service_trial', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await handleServiceAction(ctx, 'trial');
})

bot.action('service_renew', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await handleServiceAction(ctx, 'renew');
});


// =========================
// 🟣 UDPZI (Menu Terpisah)
// =========================
bot.action('udpzi_menu', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const keyboard = [
      [{ text: '🆕 CREATE UDPZI', callback_data: 'udpzi_action_create' },
      { text: '🧪 TRIAL UDPZI', callback_data: 'udpzi_action_trial' }],
      [{ text: '♻️ RENEW UDPZI', callback_data: 'udpzi_action_renew' },
      { text: '🗑 DELETE UDPZI', callback_data: 'udpzi_action_delete' }],
      [{ text: '🔑 CHANGEPASS UDPZI', callback_data: 'udpzi_action_changepass' },
      { text: '🔙 Kembali', callback_data: 'send_main_menu' }]
    ];

    // gunakan edit jika bisa, kalau tidak kirim pesan baru
    try {
      await ctx.editMessageText('🟣 *UDPZI MENU*\nPilih aksi:', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (e) {
      await ctx.reply('🟣 *UDPZI MENU*\nPilih aksi:', {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
  } catch (err) {
    console.error('❌ Error udpzi_menu:', err);
    await ctx.reply('🚫 Terjadi kesalahan saat membuka menu UDPZI.', { parse_mode: 'Markdown' });
  }
});

async function startUdpziSelectServer(ctx, action, page = 0) {
  try {
    console.log(`Memulai proses UDPZI ${action} di halaman ${page + 1}`);

    const servers = await getUdpziServerList(ctx.from.id);

    if (!servers || servers.length === 0) {
      console.log('Tidak ada server UDPZI yang tersedia');
      return ctx.reply('⚠️ *Tidak ada server UDPZI tersedia.*', { parse_mode: 'Markdown' });
    }

    const serversPerPage = 6;
    const totalPages = Math.ceil(servers.length / serversPerPage);
    const currentPage = Math.min(Math.max(page, 0), totalPages - 1);
    const start = currentPage * serversPerPage;
    const end = start + serversPerPage;
    const currentServers = servers.slice(start, end);

    // ===== keyboard 2 kolom =====
    const keyboard = [];
    for (let i = 0; i < currentServers.length; i += 2) {
      const row = [];
      const s1 = currentServers[i];
      const s2 = currentServers[i + 1];

      row.push({ text: `${s1.nama_server}`, callback_data: `udpzi_pick_${action}_${s1.id}` });
      if (s2) row.push({ text: `${s2.nama_server}`, callback_data: `udpzi_pick_${action}_${s2.id}` });

      keyboard.push(row);
    }

    // ===== navigasi =====
    const nav = [];
    if (totalPages > 1) {
      if (currentPage > 0) nav.push({ text: '⬅️ Back', callback_data: `udpzi_nav_${action}_${currentPage - 1}` });
      if (currentPage < totalPages - 1) nav.push({ text: '➡️ Next', callback_data: `udpzi_nav_${action}_${currentPage + 1}` });
    }
    if (nav.length) keyboard.push(nav);

    // ===== tombol kembali =====
    keyboard.push([{ text: '🔙 Kembali', callback_data: 'udpzi_menu' }]);

    // ===== format list detail server (sama seperti startSelectServer) =====
    const serverList = currentServers.map(server => {
      const hargaPer30Hari = server.harga * 30;
      const isFull = server.total_create_akun >= server.batas_create_akun;

      return `┏━ 🟣 *${server.nama_server}* ━━
┃ 💰 *Harga*: Rp${server.harga} / hari
┃ 🏷️ *Harga 30H*: Rp${hargaPer30Hari}
┃ 📦 *Quota*: ${server.quota}GB
┃ 🔒 *Limit IP*: ${server.iplimit} IP
┃ 👤 *Pengguna*: ${server.total_create_akun}/${server.batas_create_akun} ${isFull ? '❌' : '✅'}
┗━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }).join('\n\n');

    const textMsg =
      `🟣 *List Server UDPZI (Halaman ${currentPage + 1} dari ${totalPages}):*\n\n` +
      serverList;

    // ===== edit jika bisa, fallback reply =====
    let sentMessage = null;
    try {
      await ctx.editMessageText(textMsg, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (e) {
      sentMessage = await ctx.reply(textMsg, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });

      // Hapus pesan setelah 30 detik (sama seperti startSelectServer)
      setTimeout(() => {
        try {
          ctx.deleteMessage(sentMessage.message_id);
        } catch (_) {}
      }, 30000);
    }

    // Simpan state hanya untuk action yang butuh input (trial biasanya langsung jalan)
    if (action !== 'trial') {
      userState[ctx.chat.id] = { step: 'udpzi_select_server', action, page: currentPage };
    }
  } catch (error) {
    console.error(`🚫 Error saat memulai proses UDPZI ${action}:`, error);
    await ctx.reply(
      '🚫 *GAGAL! Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.*',
      { parse_mode: 'Markdown' }
    );
  }
}


async function processUdpziTrialFixed(ctx, serverId) {
  const userId = ctx.from.id;
  const today = new Date().toISOString().slice(0, 10);

  const role = await getUserRole(userId);

  // Limit trial: non reseller/admin hanya 1x per hari
  if (!['reseller', 'admin'].includes(role)) {
    const user = await getUserData(userId);
    let trialCount = 0;
    if (user && user.last_trial_date === today) trialCount = user.trial_count || 0;

    if (trialCount >= 1) {
      return ctx.reply('🚫 *Trial UDPZI hanya boleh 1x per hari untuk member.*', { parse_mode: 'Markdown' });
    }
  }

  // Ambil server (validasi tipe UDPZI)
  const serverRow = await new Promise((resolve, reject) => {
    db.get('SELECT domain, nama_server, server_type FROM Server WHERE id = ?', [serverId], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error('Server tidak ditemukan'));
      if ((row.server_type || '').toLowerCase() !== 'udpzi') return reject(new Error('Server bukan tipe UDPZI'));
      resolve(row);
    });
  });

  const minutes = 30; // fixed
  const res = await Api.trialUser(serverRow.domain, minutes);

  if (!res || res.status !== 'success') {
    const errMsg = res?.error || 'Gagal membuat trial (response tidak success).';
    return ctx.reply(`🚫 *UDPZI TRIAL gagal:* ${errMsg}`, { parse_mode: 'Markdown' });
  }

  // Update trial count hanya untuk non reseller/admin
  if (!['reseller', 'admin'].includes(role)) {
    await updateTrialCount(userId, today);
  }

  const d = res.data || {};
  const shownUser = d.username || '-';
  const shownPass = d.password || '-';
  const shownExp = d.expired || '-';
  const shownDomain = d['🌍 domain'] || d.domain || d.server || serverRow.domain;
  const shownIP = d['🌐 ip server'] || d.ip || '-';

  const msg =
    `🟣 *UDPZI TRIAL BERHASIL*\n\n` +
    `🏷️ Server: *${serverRow.nama_server || 'UDPZI'}*\n` +
    `⏱️ Durasi: *${minutes} menit*\n\n` +
    `👤 User: \`${shownUser}\`\n` +
    `🔑 Pass: \`${shownPass}\`\n` +
    `📅 Expired: \`${shownExp}\`\n\n` +
    `🌍 Domain: \`${shownDomain}\`\n` +
    `🌐 IP Server: \`${shownIP}\``;

  return ctx.reply(msg, { parse_mode: 'Markdown' });
}


bot.action(/udpzi_action_(create|trial|renew|delete|changepass)/, async (ctx) => {
  const action = ctx.match[1];
  await ctx.answerCbQuery();
  await startUdpziSelectServer(ctx, action, 0);
});

bot.action(/udpzi_nav_(create|trial|renew|delete|changepass)_(\d+)/, async (ctx) => {
  const action = ctx.match[1];
  const page = parseInt(ctx.match[2], 10);
  await ctx.answerCbQuery();
  await startUdpziSelectServer(ctx, action, page);
});

bot.action(/udpzi_pick_(create|trial|renew|delete|changepass)_(\d+)/, async (ctx) => {
  const action = ctx.match[1];
  const serverId = ctx.match[2];
  await ctx.answerCbQuery();

  // simpan server + action, lanjutkan input via chat biasa (tanpa keyboard)
  userState[ctx.chat.id] = { step: `udpzi_${action}_start`, action, serverId };

  if (action === 'trial') {
    // Trial UDPZI: durasi fixed 30 menit + limit 1x/hari untuk member
    delete userState[ctx.chat.id];
    return processUdpziTrialFixed(ctx, serverId);
  }

  if (action === 'create') {
    return ctx.reply('🆕 Masukkan *username* UDPZI:', { parse_mode: 'Markdown' });
  }

  if (action === 'renew') {
    return ctx.reply('♻️ Masukkan *username* yang mau di-renew:', { parse_mode: 'Markdown' });
  }

  if (action === 'delete') {
    return ctx.reply('🗑 Masukkan *username* yang mau dihapus:', { parse_mode: 'Markdown' });
  }

  if (action === 'changepass') {
    return ctx.reply('🔑 Masukkan *username* yang mau diganti password:', { parse_mode: 'Markdown' });
  }
});

bot.action('send_main_menu', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await sendMainMenu(ctx);
});

bot.action('create_vmess', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'create', 'vmess');
});

bot.action('create_vless', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'create', 'vless');
});

bot.action('create_trojan', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'create', 'trojan');
});

bot.action('create_shadowsocks', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'create', 'shadowsocks');
});

bot.action('create_ssh', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'create', 'ssh');
});

bot.action('trial_vmess', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'trial', 'vmess');
});

bot.action('trial_vless', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'trial', 'vless');
});

bot.action('trial_trojan', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'trial', 'trojan');
});

bot.action('trial_ssh', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'trial', 'ssh');
});

bot.action('renew_vmess', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'renew', 'vmess');
});

bot.action('renew_vless', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'renew', 'vless');
});

bot.action('renew_trojan', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'renew', 'trojan');
});

bot.action('renew_shadowsocks', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'renew', 'shadowsocks');
});

bot.action('renew_ssh', async (ctx) => {
  if (!ctx || !ctx.match) {
    return ctx.reply('🚫 *GAGAL!* Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
  await startSelectServer(ctx, 'renew', 'ssh');
});
async function startSelectServer(ctx, action, type, page = 0) {
  try {
    console.log(`Memulai proses ${action} untuk ${type} di halaman ${page + 1}`);

    const servers = await getServerList(ctx.from.id);

    if (servers.length === 0) {
      console.log('Tidak ada server yang tersedia');
      return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia saat ini. Coba lagi nanti!*', { parse_mode: 'Markdown' });
    }

    const serversPerPage = 6;
    const totalPages = Math.ceil(servers.length / serversPerPage);
    const currentPage = Math.min(Math.max(page, 0), totalPages - 1);
    const start = currentPage * serversPerPage;
    const end = start + serversPerPage;
    const currentServers = servers.slice(start, end);

    const keyboard = [];
    for (let i = 0; i < currentServers.length; i += 2) {
      const row = [];
      const server1 = currentServers[i];
      const server2 = currentServers[i + 1];

      // Jika trial, gunakan callback khusus trial
      const server1Callback = action === 'trial' 
        ? `trial_${type}_${server1.id}` 
        : `${action}_username_${type}_${server1.id}`;
      
      row.push({ text: `${server1.nama_server}`, callback_data: server1Callback });

      if (server2) {
        const server2Callback = action === 'trial' 
          ? `trial_${type}_${server2.id}` 
          : `${action}_username_${type}_${server2.id}`;

        row.push({ text: `${server2.nama_server}`, callback_data: server2Callback });
      }

      keyboard.push(row);
    }

    // Tombol navigasi
    const navButtons = [];
    if (totalPages > 1) {
      if (currentPage > 0) {
        navButtons.push({ text: '⬅️ Back', callback_data: `navigate_${action}_${type}_${currentPage - 1}` });
      }
      if (currentPage < totalPages - 1) {
        navButtons.push({ text: '➡️ Next', callback_data: `navigate_${action}_${type}_${currentPage + 1}` });
      }
    }
    if (navButtons.length > 0) {
      keyboard.push(navButtons);
    }

    // Tombol kembali ke menu utama
    keyboard.push([{ text: '🔙 Kembali ke Menu Utama', callback_data: 'send_main_menu' }]);

    // Format pesan list server
    const serverList = currentServers.map(server => {
      const hargaPer30Hari = server.harga * 30;
      const isFull = server.total_create_akun >= server.batas_create_akun;

      return `┏━ 🚀 *${server.nama_server}* ━━
┃ 💰 *Harga*: Rp${server.harga} / hari
┃ 🏷️ *Harga 30H*: Rp${hargaPer30Hari}
┃ 📦 *Quota*: ${server.quota}GB
┃ 🔒 *Limit IP*: ${server.iplimit} IP
┃ 👤 *Pengguna*: ${server.total_create_akun}/${server.batas_create_akun} ${isFull ? '❌' : '✅'}
┗━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }).join('\n\n');

    const messageText = `📌 *List Server (Halaman ${currentPage + 1} dari ${totalPages}):*\n\n${serverList}`;

    // Kirim pesan
    const sentMessage = await ctx.reply(messageText, {
      reply_markup: { inline_keyboard: keyboard },
      parse_mode: 'Markdown'
    });

    // Hapus pesan setelah 30 detik
    setTimeout(() => {
      ctx.deleteMessage(sentMessage.message_id);
    }, 30000);

    // Simpan state hanya untuk create/renew (trial tidak perlu state)
    if (action !== 'trial') {
      userState[ctx.chat.id] = { step: `${action}_username_${type}`, page: currentPage };
    }
  } catch (error) {
    console.error(`🚫 Error saat memulai proses ${action} untuk ${type}:`, error);
    await ctx.reply(`🚫 *GAGAL! Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.*`, { parse_mode: 'Markdown' });
  }
}


bot.action(/navigate_(\w+)_(\w+)_(\d+)/, async (ctx) => {
  const [, action, type, page] = ctx.match;
  await startSelectServer(ctx, action, type, parseInt(page, 10));
});
bot.action(/create_username_(vmess|vless|trojan|shadowsocks|ssh)_(.+)/, async (ctx) => {
  const type = ctx.match[1]; // ✅ ini tipe (vmess, etc)
  const serverId = ctx.match[2]; // ✅ ini server ID
  const action = 'create'; // ✅ set manual karena udah jelas dari route-nya

  userState[ctx.chat.id] = { step: `username_${action}_${type}`, serverId, type, action };

  db.get('SELECT batas_create_akun, total_create_akun FROM Server WHERE id = ?', [serverId], async (err, server) => {
    if (err) {
      console.error('⚠️ Error fetching server details:', err.message);
      return ctx.reply('🚫 *Terjadi kesalahan saat mengambil detail server.*', { parse_mode: 'Markdown' });
    }

    if (!server) {
      return ctx.reply('🚫 *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
    }

    const batasCreateAkun = server.batas_create_akun;
    const totalCreateAkun = server.total_create_akun;

    if (totalCreateAkun >= batasCreateAkun) {
      return ctx.reply('🚫 *Server penuh. Tidak dapat membuat akun baru di server ini.*', { parse_mode: 'Markdown' });
    }

    await ctx.reply('👤 *Masukkan username:*', { parse_mode: 'Markdown' });
  });
});

bot.action(/^renew_username_(vmess|vless|trojan|shadowsocks|ssh)_(.+)/, async (ctx) => {
  const type = ctx.match[1];
  const serverId = ctx.match[2];

  await showRenewableAccountsByServer(ctx, type, parseInt(serverId));
});
bot.action(/^renew_username_selected_(.+)_(.+)_(\d+)$/, async (ctx) => {
  const [, username, type, serverId] = ctx.match;

  userState[ctx.chat.id] = {
    step: `exp_renew_${type}`,
    username,
    type,
    serverId,
    action: 'renew'
  };

  await ctx.reply('⏳ *Masukkan masa aktif (hari) untuk perpanjangan akun:*', {
    parse_mode: 'Markdown'
  });
});

bot.action(/trial_(vmess|vless|trojan|shadowsocks|ssh)_(.+)/, async (ctx) => {
  const type = ctx.match[1];
  const serverId = ctx.match[2];

  processTrial(ctx, type, serverId);
});

bot.action(/hapus_akun_id_(\d+)/, async (ctx) => {
  const akunId = ctx.match[1];
  const userId = ctx.from.id;

  try {
	console.log(`- UsernameID     : ${akunId}`);
    const result = await hapusAkun(akunId); 

    await ctx.reply(result);
  } catch (err) {
    await ctx.reply(err.toString());
  }
});

const ensureColumnsExist = async () => {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(users)", [], (err, rows) => {
      if (err) {
        console.error("⚠️ Kesalahan saat mengecek struktur tabel:", err.message);
        return reject(err);
      }

      const columns = rows.map(row => row.name);
      const queries = [];

      if (!columns.includes('trial_count')) {
        queries.push("ALTER TABLE users ADD COLUMN trial_count INTEGER DEFAULT 0;");
      }
      if (!columns.includes('last_trial_date')) {
        queries.push("ALTER TABLE users ADD COLUMN last_trial_date TEXT DEFAULT NULL;");
      }

      if (queries.length === 0) {
        return resolve(); // Tidak ada perubahan
      }

      // Eksekusi ALTER TABLE secara berurutan untuk menghindari error
      (async () => {
        for (const query of queries) {
          try {
            await new Promise((res, rej) => {
              db.run(query, (err) => {
                if (err) {
                  console.error("⚠️ Gagal menambahkan kolom:", err.message);
                  rej(err);
                } else {
                  console.log(`✅ Berhasil menjalankan: ${query}`);
                  res();
                }
              });
            });
          } catch (error) {
            return reject(error);
          }
        }
        resolve();
      })();
    });
  });
};

const getUserData = async (userId) => {
  await ensureColumnsExist(); // Pastikan kolom sudah ada sebelum query
  return new Promise((resolve, reject) => {
    db.get('SELECT trial_count, last_trial_date FROM users WHERE user_id = ?', [userId], (err, user) => {
      if (err) {
        console.error('⚠️ Kesalahan saat mengambil data user:', err.message);
        reject(err);
      } else {
        resolve(user || null);
      }
    });
  });
};

const updateTrialCount = (userId, today) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET trial_count = trial_count + 1, last_trial_date = ? WHERE user_id = ?',
      [today, userId],
      (err) => {
        if (err) {
          console.error('⚠️ Kesalahan saat memperbarui trial count:', err.message);
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
};

async function processTrial(ctx, type, serverId) {
  const userId = ctx.from.id;
  const isBlocked = await new Promise((resolve) => {
  db.get('SELECT is_blocked FROM users WHERE user_id = ?', [userId], (err, row) => {
    if (err) return resolve(false);
    resolve(row && row.is_blocked === 1);
  });
});

if (isBlocked) {
  return ctx.reply('🚫 Anda adalah kriminal, Anda telah diblokir.');
}

  const today = new Date().toISOString().split('T')[0];

  try {
    const role = await getUserRole(userId); // 🔐 Ambil role user
    let user = await getUserData(userId);
    let trialCount = 0;

    if (!user) {
      console.log('User belum ada di database, menambahkan user baru.');
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (user_id, trial_count, last_trial_date) VALUES (?, ?, ?)',
          [userId, 0, today],
          (err) => {
            if (err) {
              console.error('⚠️ Kesalahan saat menambahkan user:', err.message);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
    } else if (user.last_trial_date === today) {
      trialCount = user.trial_count;
    }

    // ⚠️ Cek limit trial jika bukan reseller/admin
    if (!['reseller', 'admin'].includes(role)) {
      if (trialCount >= 2) {
        console.log(`User ${userId} telah mencapai batas trial hari ini.`);
        return ctx.reply('🚫 *Anda sudah mencapai batas maksimal trial hari ini (2 kali).*', { parse_mode: 'Markdown' });
      }
    }

    let msg;
    console.log(`Menjalankan proses trial untuk ${type}...`);

    if (type === 'ssh') {
      msg = await trialssh(serverId);
    } else if (type === 'vmess') {
      msg = await trialvmess(serverId);
    } else if (type === 'vless') {
      msg = await trialvless(serverId);
    } else if (type === 'trojan') {
      msg = await trialtrojan(serverId);
    } else {
      console.error(`❌ Tipe trial tidak dikenali: ${type}`);
      return ctx.reply('🚫 *Tipe trial tidak valid!*', { parse_mode: 'Markdown' });
    }

    console.log(`Trial ${type} berhasil dibuat. Mengupdate database...`);

    // ✅ Tetap update count hanya kalau user bukan admin/reseller
    if (!['reseller', 'admin'].includes(role)) {
      await updateTrialCount(userId, today);
    }

    console.log(`Mengirim pesan hasil trial ke user...`);
    await ctx.reply(msg, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error(`❌ Error dalam proses trial: ${error.message}`);
    ctx.reply('🚫 *Terjadi kesalahan saat memproses trial.*', { parse_mode: 'Markdown' });
  }
}



initGenerateBug(bot); // ⬅️ WAJIB untuk aktifkan semua bot.action()
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();

  // Cek apakah URI yang cocok
  if (
    text.startsWith('vmess://') ||
    text.startsWith('vless://') ||
    text.startsWith('trojan://')
  ) {
    return await handleGenerateURI(bot, ctx, text);
  }
  console.log('📩 Text diterima dari:', ctx.chat.id, '| Pesan:', ctx.message.text);

  const state = userState[ctx.chat.id];
  console.log('🧠 State ditemukan:', state);

if (!state) {
  console.log('⚠️ Tidak ada state, menghentikan proses.');
  return;
}


// ===== UDPZI Text Flow (input via chat biasa, tanpa keyboard) =====
if (state.step && state.step.startsWith('udpzi_')) {
  const chatId = ctx.chat.id;

  // helper ambil domain server dari DB
  const getUdpziServerDomain = (serverId) =>
    new Promise((resolve, reject) => {
      db.get('SELECT domain, server_type FROM Server WHERE id = ?', [serverId], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Server tidak ditemukan'));
        if ((row.server_type || '').toLowerCase() !== 'udpzi') {
          return reject(new Error('Server bukan tipe UDPZI'));
        }
        resolve(row.domain);
      });
    });

  try {
    // TRIAL (durasi fixed 30 menit, tidak perlu input)
    if (state.step === 'udpzi_trial_start') {
      // Backward compatibility: kalau masih ada state lama, langsung eksekusi trial fixed
      delete userState[chatId];
      return processUdpziTrialFixed(ctx, state.serverId);
    }

    // CREATE - step 1: username
    if (state.step === 'udpzi_create_start') {
      const username = text.trim();
      if (!username) return ctx.reply('⚠️ Username tidak boleh kosong.');
      userState[chatId] = { ...state, step: 'udpzi_create_pass', username };
      return ctx.reply('🔐 Masukkan *password* UDPZI:', { parse_mode: 'Markdown' });
    }
    // CREATE - step 2: pass
    if (state.step === 'udpzi_create_pass') {
      const pass = text.trim();
      if (!pass) return ctx.reply('⚠️ Password tidak boleh kosong.');
      userState[chatId] = { ...state, step: 'udpzi_create_days', pass };
      return ctx.reply('📆 Masukkan masa aktif dalam *hari* (contoh: `30`):', { parse_mode: 'Markdown' });
    }
    // CREATE - step 3: days -> execute
    if (state.step === 'udpzi_create_days') {
      const days = parseInt(text.trim(), 10);
      if (isNaN(days) || days <= 0) {
        return ctx.reply('⚠️ Hari harus angka yang valid. Contoh: `30`', { parse_mode: 'Markdown' });
      }

      // Ambil info server + harga sesuai role
      const serverInfo = await new Promise((resolve, reject) => {
        db.get(
          'SELECT domain, nama_server, harga, harga_reseller, server_type FROM Server WHERE id = ?',
          [state.serverId],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      if (!serverInfo) {
        delete userState[chatId];
        return ctx.reply('🚫 Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }
      if ((serverInfo.server_type || '').toLowerCase() !== 'udpzi') {
        delete userState[chatId];
        return ctx.reply('🚫 Server ini bukan tipe UDPZI.', { parse_mode: 'Markdown' });
      }

      const role = await getUserRole(ctx.from.id);
      const hargaPerHari = role === 'reseller' ? Number(serverInfo.harga_reseller || 0) : Number(serverInfo.harga || 0);
      const totalHarga = hargaPerHari * days;

      // Cek saldo dulu
      const saldoAwal = await getUserSaldo(ctx.from.id);
      if (saldoAwal < totalHarga) {
        delete userState[chatId];
        return ctx.reply(
          `🚫 *Saldo tidak cukup!*

` +
          `🧾 Biaya: *${rupiah(totalHarga)}*  (${days} hari × ${rupiah(hargaPerHari)}/hari)
` +
          `💰 Saldo kamu: *${rupiah(saldoAwal)}*`,
          { parse_mode: 'Markdown' }
        );
      }

      const serverURL = serverInfo.domain; // domain sudah divalidasi tipe UDPZI
      const res = await Api.addUser(serverURL, state.username, state.pass, days);

      // Jika gagal, jangan potong saldo
      if (!res || res.status !== 'success') {
        delete userState[chatId];
        const errMsg = res?.error || 'Gagal membuat akun (response tidak success).';
        return ctx.reply(`🚫 *UDPZI CREATE gagal:* ${errMsg}`, { parse_mode: 'Markdown' });
      }

      // Potong saldo setelah sukses create
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE users SET saldo = saldo - ? WHERE user_id = ?',
          [totalHarga, ctx.from.id],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const saldoAkhir = await getUserSaldo(ctx.from.id);

      // Rapikan output
      const d = res.data || {};
      const shownUser = d.user || state.username;
      const shownPass = d.password || state.pass;
      const shownExp = d.expired || '-';
      const shownDomain = d['🌍 domain'] || d.domain || d.server || serverInfo.domain;
      const shownIP = d['🌐 ip server'] || d.ip || '-';

      // Simpan ke database agar user hanya bisa manage akun miliknya
      try {
        const expiredValue = (d.expired || shownExp || '-').toString();
        await saveUserAccount(String(ctx.from.id), String(shownUser), 'udpzi', Number(state.serverId), expiredValue, Number(totalHarga), Number(days));
      } catch (e) {
        console.warn('⚠️ Gagal saveUserAccount UDPZI:', e.message);
      }
      try {
        await updateUserAccountCreation(String(ctx.from.id), String(shownUser), 'udpzi', Number(state.serverId), (d.expired || shownExp || '-').toString(), Number(totalHarga), Number(days));
      } catch (e) {
        // fungsi ini mungkin punya signature berbeda pada sebagian versi, jadi jangan bikin flow gagal
        console.warn('⚠️ Gagal updateUserAccountCreation UDPZI:', e.message);
      }

      delete userState[chatId];

      const msg =
        `🟣 *UDPZI CREATE BERHASIL*

` +
        `🏷️ Server: *${serverInfo.nama_server || 'UDPZI'}*
` +
        `👤 User: \`${shownUser}\`
` +
        `🔑 Pass: \`${shownPass}\`
` +
        `📅 Expired: \`${shownExp}\`

` +
        `🌍 Domain: \`${shownDomain}\`
` +
        `🌐 IP Server: \`${shownIP}\`

` +
        `💳 Biaya: *${rupiah(totalHarga)}*  (${days} hari × ${rupiah(hargaPerHari)}/hari)
` +
        `✅ Saldo terpotong: *${rupiah(totalHarga)}*
` +
        `💰 Sisa saldo: *${rupiah(saldoAkhir)}*`;

      return ctx.reply(msg, { parse_mode: 'Markdown' });
    }

    // RENEW - step 1: username
    if (state.step === 'udpzi_renew_start') {
      const username = text.trim();
      if (!username) return ctx.reply('⚠️ Username tidak boleh kosong.');
      userState[chatId] = { ...state, step: 'udpzi_renew_days', username };
      return ctx.reply('📆 Masukkan masa aktif tambahan dalam *hari* (contoh: `30`):', { parse_mode: 'Markdown' });
    }
    // RENEW - step 2 execute (potong saldo + update DB)
    if (state.step === 'udpzi_renew_days') {
      const days = parseInt(text.trim(), 10);
      if (isNaN(days) || days <= 0) {
        return ctx.reply('⚠️ Hari harus angka yang valid. Contoh: `30`', { parse_mode: 'Markdown' });
      }

      // Pastikan akun ini milik user (disimpan di user_accounts)
      const accountRow = await new Promise((resolve, reject) => {
        db.get(
          `SELECT * FROM user_accounts 
           WHERE user_id = ? AND username = ? AND jenis = 'udpzi' AND server_id = ?`,
          [String(ctx.from.id), String(state.username), Number(state.serverId)],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      if (!accountRow) {
        delete userState[chatId];
        return ctx.reply('🚫 Anda hanya bisa *renew* akun UDPZI yang Anda buat sendiri.', { parse_mode: 'Markdown' });
      }

      // Ambil info server + harga sesuai role
      const serverInfo = await new Promise((resolve, reject) => {
        db.get(
          'SELECT domain, nama_server, harga, harga_reseller, server_type FROM Server WHERE id = ?',
          [state.serverId],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      if (!serverInfo) {
        delete userState[chatId];
        return ctx.reply('🚫 Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }
      if ((serverInfo.server_type || '').toLowerCase() !== 'udpzi') {
        delete userState[chatId];
        return ctx.reply('🚫 Server ini bukan tipe UDPZI.', { parse_mode: 'Markdown' });
      }

      const role = await getUserRole(ctx.from.id);
      const hargaPerHari = role === 'reseller' ? Number(serverInfo.harga_reseller || 0) : Number(serverInfo.harga || 0);
      const totalHarga = hargaPerHari * days;

      const saldoAwal = await getUserSaldo(ctx.from.id);
      if (saldoAwal < totalHarga) {
        delete userState[chatId];
        return ctx.reply(
          `🚫 *Saldo tidak cukup!*\n\n` +
          `🧾 Biaya: *${rupiah(totalHarga)}*  (${days} hari × ${rupiah(hargaPerHari)}/hari)\n` +
          `💰 Saldo kamu: *${rupiah(saldoAwal)}*`,
          { parse_mode: 'Markdown' }
        );
      }

      const res = await Api.renewUser(serverInfo.domain, state.username, days);

      if (!res || res.status !== 'success') {
        delete userState[chatId];
        const errMsg = res?.error || 'Gagal renew (response tidak success).';
        return ctx.reply(`🚫 *UDPZI RENEW gagal:* ${errMsg}`, { parse_mode: 'Markdown' });
      }

      // Potong saldo setelah sukses renew
      await new Promise((resolve, reject) => {
        db.run('UPDATE users SET saldo = saldo - ? WHERE user_id = ?', [totalHarga, ctx.from.id], (err) =>
          err ? reject(err) : resolve()
        );
      });

      const saldoAkhir = await getUserSaldo(ctx.from.id);

      const d = res.data || {};
      let newExpired = d.expired || null;
      if (!newExpired) {
        try {
          newExpired = dayjs(accountRow.expired).add(days, 'day').format('YYYY-MM-DD');
        } catch (e) {
          newExpired = accountRow.expired || '-';
        }
      }

      // Update DB user_accounts
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE user_accounts 
           SET expired = ?, price = COALESCE(price,0) + ?, duration_days = COALESCE(duration_days,0) + ?
           WHERE id = ?`,
          [String(newExpired), Number(totalHarga), Number(days), Number(accountRow.id)],
          (err) => (err ? reject(err) : resolve())
        );
      });

      delete userState[chatId];

      const msg =
        `🟣 *UDPZI RENEW BERHASIL*\n\n` +
        `🏷️ Server: *${serverInfo.nama_server || 'UDPZI'}*\n` +
        `👤 User: \`${state.username}\`\n` +
        `➕ Tambahan: *${days} hari*\n` +
        `📅 Expired baru: \`${newExpired}\`\n\n` +
        `💳 Biaya: *${rupiah(totalHarga)}*  (${days} hari × ${rupiah(hargaPerHari)}/hari)\n` +
        `✅ Saldo terpotong: *${rupiah(totalHarga)}*\n` +
        `💰 Sisa saldo: *${rupiah(saldoAkhir)}*`;

      return ctx.reply(msg, { parse_mode: 'Markdown' });
    }

    // DELETE - execute (refund saldo sesuai sisa hari + hanya akun milik user)
    if (state.step === 'udpzi_delete_start') {
      const username = text.trim();
      if (!username) return ctx.reply('⚠️ Username tidak boleh kosong.');

      // Pastikan akun ini milik user
      const accountRow = await new Promise((resolve, reject) => {
        db.get(
          `SELECT * FROM user_accounts 
           WHERE user_id = ? AND username = ? AND jenis = 'udpzi' AND server_id = ?`,
          [String(ctx.from.id), String(username), Number(state.serverId)],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      if (!accountRow) {
        delete userState[chatId];
        return ctx.reply('🚫 Anda hanya bisa *delete* akun UDPZI yang Anda buat sendiri.', { parse_mode: 'Markdown' });
      }

      const serverInfo = await new Promise((resolve, reject) => {
        db.get(
          'SELECT domain, nama_server, server_type FROM Server WHERE id = ?',
          [state.serverId],
          (err, row) => (err ? reject(err) : resolve(row))
        );
      });

      if (!serverInfo) {
        delete userState[chatId];
        return ctx.reply('🚫 Server tidak ditemukan.', { parse_mode: 'Markdown' });
      }
      if ((serverInfo.server_type || '').toLowerCase() !== 'udpzi') {
        delete userState[chatId];
        return ctx.reply('🚫 Server ini bukan tipe UDPZI.', { parse_mode: 'Markdown' });
      }

      // Hitung refund berdasarkan sisa hari (pakai harga tersimpan saat pembelian)
      const now = dayjs();
      const exp = dayjs(accountRow.expired);
      const remainingDays = Math.max(0, Math.ceil(exp.diff(now, 'day', true)));

      const paidTotal = Number(accountRow.price || 0);
      const paidDays = Number(accountRow.duration_days || 0);
      const perDay = paidDays > 0 ? paidTotal / paidDays : 0;
      const refund = Math.max(0, Math.floor(perDay * remainingDays));

      const res = await Api.deleteUser(serverInfo.domain, username);

      if (!res || res.status !== 'success') {
        delete userState[chatId];
        const errMsg = res?.error || 'Gagal delete (response tidak success).';
        return ctx.reply(`🚫 *UDPZI DELETE gagal:* ${errMsg}`, { parse_mode: 'Markdown' });
      }

      if (refund > 0) {
        await new Promise((resolve, reject) => {
          db.run('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [refund, ctx.from.id], (err) =>
            err ? reject(err) : resolve()
          );
        });
      }

      await new Promise((resolve, reject) => {
        db.run('DELETE FROM user_accounts WHERE id = ?', [Number(accountRow.id)], (err) => (err ? reject(err) : resolve()));
      });

      const saldoAkhir = await getUserSaldo(ctx.from.id);

      delete userState[chatId];

      const msg =
        `🟣 *UDPZI DELETE BERHASIL*\n\n` +
        `🏷️ Server: *${serverInfo.nama_server || 'UDPZI'}*\n` +
        `👤 User: \`${username}\`\n` +
        `📅 Expired sebelumnya: \`${accountRow.expired || '-'}\`\n` +
        `⏳ Sisa hari: *${remainingDays}*\n\n` +
        `💸 Refund: *${rupiah(refund)}*\n` +
        `💰 Saldo sekarang: *${rupiah(saldoAkhir)}*`;

      return ctx.reply(msg, { parse_mode: 'Markdown' });
    }

    // CHANGEPASS - step 1: username
    if (state.step === 'udpzi_changepass_start') {
      const username = text.trim();
      if (!username) return ctx.reply('⚠️ Username tidak boleh kosong.');
      userState[chatId] = { ...state, step: 'udpzi_changepass_pass', username };
      return ctx.reply('🔐 Masukkan *password baru*:', { parse_mode: 'Markdown' });
    }
    // CHANGEPASS - step 2 execute
    if (state.step === 'udpzi_changepass_pass') {
      const pass = text.trim();
      if (!pass) return ctx.reply('⚠️ Password tidak boleh kosong.');

      const serverURL = await getUdpziServerDomain(state.serverId);
      const res = await Api.changePass(serverURL, state.username, pass);

      delete userState[chatId];

      if (!res || res.status !== 'success') {
        const errMsg = res?.error || 'Gagal changepass (response tidak success).';
        return ctx.reply(`🚫 *UDPZI CHANGEPASS gagal:* ${errMsg}`, { parse_mode: 'Markdown' });
      }

      const d = res.data || {};
      const shownUser = d.user || state.username;
      const shownPass = d.password || pass;

      const msg =
        `🟣 *UDPZI CHANGEPASS BERHASIL*\n\n` +
        `👤 User: \`${shownUser}\`\n` +
        `🔑 Password baru: \`${shownPass}\``;

      return ctx.reply(msg, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    console.error('❌ UDPZI flow error:', err);
    delete userState[chatId];
    return ctx.reply(`🚫 Gagal memproses UDPZI: ${err.message}`, { parse_mode: 'Markdown' });
  }
}
// ===== End UDPZI Text Flow =====

if (state.step === 'bonus_min_deposit') {
  const min = parseInt(ctx.message.text.trim());

  if (isNaN(min) || min <= 0) {
    return ctx.reply('⚠️ *Masukkan angka yang valid untuk minimal deposit.*', { parse_mode: 'Markdown' });
  }

  state.min_deposit = min;
  state.step = 'bonus_percent';

  return ctx.reply('🎁 *Masukkan persentase bonus (tanpa simbol %, contoh: 50):*', { parse_mode: 'Markdown' });
}

if (state.step === 'bonus_percent') {
  const percent = parseInt(ctx.message.text.trim());

  if (isNaN(percent) || percent < 1 || percent > 100) {
    return ctx.reply('⚠️ *Persentase bonus harus antara 1 dan 100.*', { parse_mode: 'Markdown' });
  }

  state.bonus_percent = percent;

  if (state.jenis_bonus === 'period') {
    state.step = 'bonus_start_date';
    return ctx.reply('📅 *Masukkan tanggal mulai bonus (format: YYYY-MM-DD):*', { parse_mode: 'Markdown' });
  } else {
    // Simpan bonus first deposit langsung
    db.run(`INSERT INTO deposit_bonus_rules (jenis_bonus, min_deposit, bonus_percent, is_active)
            VALUES (?, ?, ?, ?)`,
      ['first', state.min_deposit, state.bonus_percent, 1],
      (err) => {
        delete userState[ctx.chat.id];

        if (err) {
          console.error('❌ Gagal menyimpan bonus first deposit:', err.message);
          return ctx.reply('❌ *Gagal menyimpan bonus. Coba lagi.*', { parse_mode: 'Markdown' });
        }

        ctx.reply('✅ *Bonus deposit pertama berhasil ditambahkan!*', { parse_mode: 'Markdown' });
      });
  }
}

if (state.step === 'bonus_start_date') {
  const date = ctx.message.text.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return ctx.reply('⚠️ *Format tanggal tidak valid. Gunakan format YYYY-MM-DD.*', { parse_mode: 'Markdown' });
  }

  state.start_date = date;
  state.step = 'bonus_end_date';
  return ctx.reply('📅 *Masukkan tanggal akhir bonus (format: YYYY-MM-DD):*', { parse_mode: 'Markdown' });
}

if (state.step === 'bonus_end_date') {
  const endDate = ctx.message.text.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return ctx.reply('⚠️ *Format tanggal tidak valid. Gunakan format YYYY-MM-DD.*', { parse_mode: 'Markdown' });
  }

  db.run(`INSERT INTO deposit_bonus_rules (jenis_bonus, min_deposit, bonus_percent, start_date, end_date, is_active)
          VALUES (?, ?, ?, ?, ?, ?)`,
    ['period', state.min_deposit, state.bonus_percent, state.start_date, endDate, 1],
    (err) => {
      delete userState[ctx.chat.id];

      if (err) {
        console.error('❌ Gagal menyimpan bonus periode:', err.message);
        return ctx.reply('❌ *Gagal menyimpan bonus periode. Coba lagi.*', { parse_mode: 'Markdown' });
      }

      ctx.reply('✅ *Bonus deposit periode berhasil ditambahkan!*', { parse_mode: 'Markdown' });
    });
}

if (state.step === 'input_harga') {
  console.log('🛠️ Masuk ke step input_harga');

  const hargaBaru = parseInt(ctx.message.text.trim());
  console.log('💸 Harga yang dimasukkan:', hargaBaru);

  if (isNaN(hargaBaru) || hargaBaru <= 0) {
    console.log('❌ Harga tidak valid');
    return ctx.reply('⚠️ *Harga tidak valid.* Masukkan angka lebih dari 0.', { parse_mode: 'Markdown' });
  }

  const kolom = state.tipeHarga === 'member' ? 'harga' : 'harga_reseller';
  console.log(`🔄 Akan update kolom ${kolom} untuk server ID ${state.serverId}`);

  db.run(`UPDATE Server SET ${kolom} = ? WHERE id = ?`, [hargaBaru, state.serverId], function (err) {
    if (err) {
      console.error('❌ Gagal update harga server:', err.message);
      return ctx.reply('❌ Gagal memperbarui harga server. Silakan coba lagi.', { parse_mode: 'Markdown' });
    }

    console.log('✅ Harga berhasil diupdate');

    ctx.reply(`✅ *Harga ${state.tipeHarga === 'member' ? 'Member' : 'Reseller'}* berhasil diubah menjadi *Rp ${hargaBaru.toLocaleString('id-ID')}* untuk server ID ${state.serverId}.`, {
      parse_mode: 'Markdown'
    });

    delete userState[ctx.chat.id];
  });

  return;
}

  // === [AKHIR EDIT HARGA SERVER]

  if (state.step.startsWith('username_')) {
    state.username = ctx.message.text.trim();
    if (!state.username) {
      return ctx.reply('🚫 *Username tidak valid. Masukkan username yang valid.*', { parse_mode: 'Markdown' });
    }
    if (state.username.length < 3 || state.username.length > 20) {
      return ctx.reply('🚫 *Username harus terdiri dari 3 hingga 20 karakter.*', { parse_mode: 'Markdown' });
    }
    if (/[^a-zA-Z0-9]/.test(state.username)) {
      return ctx.reply('🚫 *Username tidak boleh mengandung karakter khusus atau spasi.*', { parse_mode: 'Markdown' });
    }
    const { username, serverId, type, action } = state;
    if (action === 'create') {
		const isBlocked = await new Promise((resolve) => {
	  db.get('SELECT is_blocked FROM users WHERE user_id = ?', [ctx.from.id], (err, row) => {
		if (err) return resolve(false);
		resolve(row && row.is_blocked === 1);
	  });
	});

	if (isBlocked) {
	  return ctx.reply('🚫 Anda adalah kriminal, Anda telah diblokir.');
	}
      if (type === 'ssh') {
        state.step = `password_${state.action}_${state.type}`;
        await ctx.reply('🔑 *Masukkan password:*', { parse_mode: 'Markdown' });
      } else {
        state.step = `exp_${state.action}_${state.type}`;
        await ctx.reply('⏳ *Masukkan masa aktif (hari):*', { parse_mode: 'Markdown' });
      }
    } else if (action === 'renew') {
      state.step = `exp_${state.action}_${state.type}`;
      await ctx.reply('⏳ *Masukkan masa aktif (hari):*', { parse_mode: 'Markdown' });
    }
  } else if (state.step.startsWith('password_')) {
    state.password = ctx.message.text.trim();
    if (!state.password) {
      return ctx.reply('🚫 *Password tidak valid. Masukkan password yang valid.*', { parse_mode: 'Markdown' });
    }
    if (state.password.length < 6) {
      return ctx.reply('🚫 *Password harus terdiri dari minimal 6 karakter.*', { parse_mode: 'Markdown' });
    }
    if (/[^a-zA-Z0-9]/.test(state.password)) {
      return ctx.reply('🚫 *Password tidak boleh mengandung karakter khusus atau spasi.*', { parse_mode: 'Markdown' });
    }
    state.step = `exp_${state.action}_${state.type}`;
    await ctx.reply('⏳ *Masukkan masa aktif (hari):*', { parse_mode: 'Markdown' });
	} else if (state.step.startsWith('exp_')) {
    const expInput = ctx.message.text.trim();
    if (!/^\d+$/.test(expInput)) {
      return ctx.reply('🚫 *Masa aktif tidak valid. Masukkan angka yang valid.*', { parse_mode: 'Markdown' });
    }

    const exp = parseInt(expInput, 10);
    if (isNaN(exp) || exp <= 0 || exp > 365) {
      return ctx.reply('🚫 *Masa aktif tidak boleh kurang dari 1 atau lebih dari 365 hari.*', { parse_mode: 'Markdown' });
    }

    state.exp = exp;

    db.get('SELECT quota, iplimit FROM Server WHERE id = ?', [state.serverId], async (err, server) => {
      if (err) {
        console.error('⚠️ Error fetching server details:', err.message);
        return ctx.reply('🚫 *Terjadi kesalahan saat mengambil detail server.*', { parse_mode: 'Markdown' });
      }

      if (!server) {
        return ctx.reply('🚫 *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
      }

      state.quota = server.quota;
      state.iplimit = server.iplimit;

      const { username, password, exp, quota, iplimit, serverId, type, action } = state;
      let msg;

      db.get('SELECT harga, harga_reseller FROM Server WHERE id = ?', [serverId], async (err, server) => {
        if (err) {
          console.error('⚠️ Error fetching server price:', err.message);
          return ctx.reply('🚫 *Terjadi kesalahan saat mengambil harga server.*', { parse_mode: 'Markdown' });
        }

        if (!server) {
          return ctx.reply('🚫 *Server tidak ditemukan.*', { parse_mode: 'Markdown' });
        }

        const userRole = await getUserRole(ctx.from.id);
        const hargaPerHari = userRole === 'reseller' ? server.harga_reseller : server.harga;
        const totalHarga = hargaPerHari * exp;

        db.get('SELECT saldo FROM users WHERE user_id = ?', [ctx.from.id], async (err, user) => {
          if (err) {
            console.error('⚠️ Kesalahan saat mengambil saldo pengguna:', err.message);
            return ctx.reply('🚫 *Terjadi kesalahan saat mengambil saldo pengguna.*', { parse_mode: 'Markdown' });
          }

          if (!user) {
            return ctx.reply('🚫 *Pengguna tidak ditemukan.*', { parse_mode: 'Markdown' });
          }

          const saldo = user.saldo;

          if (saldo < totalHarga) {
            return ctx.reply('🚫 *Saldo Anda tidak mencukupi untuk melakukan transaksi ini.*', { parse_mode: 'Markdown' });
          }

		// Kurangi saldo pengguna
		db.run('UPDATE users SET saldo = saldo - ? WHERE user_id = ?', [totalHarga, ctx.from.id], async (err) => {
		  if (err) {
			console.error('⚠️ Gagal mengurangi saldo:', err.message);
			return ctx.reply('🚫 *Gagal mengurangi saldo.*', { parse_mode: 'Markdown' });
		  }
		  try {
			let msg = '';
			let serverName = '';

			if (action === 'create') {
				// Tambah total akun server hanya jika exp lebih dari 30
				db.run('UPDATE Server SET total_create_akun = total_create_akun + 1 WHERE id = ?', [serverId], (err) => {
				  if (err) {
					console.error('⚠️ Gagal update total akun server:', err.message);
				  }
				});

			  // Jalankan fungsi create sesuai jenis
			  if (type === 'vmess') {
				msg = await createvmess(ctx.from.id, username, exp, quota, iplimit, serverId, hargaPerHari);
			  } else if (type === 'vless') {
				msg = await createvless(ctx.from.id, username, exp, quota, iplimit, serverId, hargaPerHari);
			  } else if (type === 'trojan') {
				msg = await createtrojan(ctx.from.id, username, exp, quota, iplimit, serverId, hargaPerHari);
			  } else if (type === 'shadowsocks') {
				msg = await createshadowsocks(ctx.from.id, username, exp, quota, iplimit, serverId, hargaPerHari);
			  } else if (type === 'ssh') {
				msg = await createssh(ctx.from.id, username, password, exp, iplimit, serverId, hargaPerHari);
			  }

			} else if (action === 'renew') {
			  // Jalankan fungsi renew sesuai jenis
			  if (type === 'ssh') {
				msg = await renewssh(username, exp, iplimit, serverId);
			  } else if (type === 'vmess') {
				msg = await renewvmess(username, exp, quota, iplimit, serverId);
			  } else if (type === 'vless') {
				msg = await renewvless(username, exp, quota, iplimit, serverId);
			  } else if (type === 'trojan') {
				msg = await renewtrojan(username, exp, quota, iplimit, serverId);
			  } else if (type === 'shadowsocks') {
				msg = await renewshadowsocks(username, exp, quota, iplimit, serverId);
			  }

			  // Update data user_accounts
			  await updateAccountRenewal(ctx.from.id, username, type, exp);
			  await updateUserAccountCreation(ctx.from.id, exp);
			}

			// Ambil nama server untuk notifikasi grup
			const server = await new Promise((resolve, reject) => {
			  db.get('SELECT nama_server FROM Server WHERE id = ?', [serverId], (err, row) => {
				if (err || !row) reject(err);
				else resolve(row);
			  });
			});

			if (server) {
			  serverName = server.nama_server;
			  await sendGroupNotificationPurchase(
				ctx.from.username,
				ctx.from.id,
				`${type.toUpperCase()} (${action.toUpperCase()})`,
				serverName,
				exp
			  );
			}

			// Kirim balasan ke user
			await ctx.reply(msg, { parse_mode: 'Markdown' });

		  } catch (error) {
			console.error('❌ Error saat create/renew:', error);
			await ctx.reply('🚫 *Terjadi kesalahan saat membuat atau memperpanjang akun.*', { parse_mode: 'Markdown' });
		  } finally {
			delete userState[ctx.chat.id]; // ✨ Hapus state setelah semua proses selesai
		  }
          });
      });
    });
});
    } else if (state.step === 'addserver_domain') {
    const domain = ctx.message.text.trim();
    if (!domain) {
      await ctx.reply(
        '⚠️ *Domain tidak boleh kosong.* Silakan masukkan domain server yang valid.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    state.domain = domain;
    state.step = 'addserver_type';

    await ctx.reply(
      `🧩 *Pilih tipe server:*

• \`xray\`  → butuh *auth*
• \`udpzi\` → *tanpa auth* (langsung request ke API)

Ketik salah satu: \`xray\` / \`udpzi\``,
      { parse_mode: 'Markdown' }
    );

  } else if (state.step === 'addserver_type') {
    const serverType = ctx.message.text.trim().toLowerCase();

    if (!['xray', 'udpzi'].includes(serverType)) {
      await ctx.reply(
        '⚠️ *Tipe server tidak valid.* Pilih: `xray` atau `udpzi`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    state.server_type = serverType;

    // ✅ UDPZI tidak butuh auth
    if (serverType === 'udpzi') {
      state.auth = '';
      state.step = 'addserver_nama_server';
      await ctx.reply('🏷️ *Silakan masukkan nama server:*', { parse_mode: 'Markdown' });
      return;
    }

    // ✅ XRAY butuh auth
    state.step = 'addserver_auth';
    await ctx.reply('🔑 *Silakan masukkan auth server:*', { parse_mode: 'Markdown' });

  } else if (state.step === 'addserver_auth') {
    const auth = ctx.message.text.trim();

    if (!auth) {
      await ctx.reply(
        '⚠️ *Auth tidak boleh kosong.* Silakan masukkan auth server yang valid.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    state.auth = auth;
    state.step = 'addserver_nama_server';
    await ctx.reply('🏷️ *Silakan masukkan nama server:*', { parse_mode: 'Markdown' });

  } else if (state.step === 'addserver_nama_server') {
    const nama_server = ctx.message.text.trim();
    if (!nama_server) {
      await ctx.reply(
        '⚠️ *Nama server tidak boleh kosong.* Silakan masukkan nama server yang valid.',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    state.nama_server = nama_server;
    state.step = 'addserver_quota';
    await ctx.reply('📊 *Silakan masukkan quota server:*', { parse_mode: 'Markdown' });
  } else if (state.step === 'addserver_quota') {
    const quota = parseInt(ctx.message.text.trim(), 10);
    if (isNaN(quota)) {
      await ctx.reply('⚠️ *Quota tidak valid.* Silakan masukkan quota server yang valid.', { parse_mode: 'Markdown' });
      return;
    }

    state.step = 'addserver_iplimit';
    state.quota = quota;
    await ctx.reply('🔢 *Silakan masukkan limit IP server:*', { parse_mode: 'Markdown' });
  } else if (state.step === 'addserver_iplimit') {
    const iplimit = parseInt(ctx.message.text.trim(), 10);
    if (isNaN(iplimit)) {
      await ctx.reply('⚠️ *Limit IP tidak valid.* Silakan masukkan limit IP server yang valid.', { parse_mode: 'Markdown' });
      return;
    }

    state.step = 'addserver_batas_create_akun';
    state.iplimit = iplimit;
    await ctx.reply('🔢 *Silakan masukkan batas create akun server:*', { parse_mode: 'Markdown' });
  } else if (state.step === 'addserver_batas_create_akun') {
    const batas_create_akun = parseInt(ctx.message.text.trim(), 10);
    if (isNaN(batas_create_akun)) {
      await ctx.reply('⚠️ *Batas create akun tidak valid.* Silakan masukkan batas create akun server yang valid.', { parse_mode: 'Markdown' });
      return;
    }

    state.step = 'addserver_harga';
    state.batas_create_akun = batas_create_akun;
    await ctx.reply('💰 *Silakan masukkan harga server (harga member):*', { parse_mode: 'Markdown' });
  } else if (state.step === 'addserver_harga') {
    const harga = parseFloat(ctx.message.text.trim());
    if (isNaN(harga) || harga <= 0) {
      await ctx.reply('⚠️ *Harga tidak valid.* Silakan masukkan harga server yang valid.', { parse_mode: 'Markdown' });
      return;
    }

    state.harga = harga;
    state.step = 'addserver_harga_reseller';
    await ctx.reply('💰 *Silakan masukkan harga reseller:*', { parse_mode: 'Markdown' });
} else if (state.step === 'addserver_harga_reseller') {
  const harga_reseller = parseFloat(ctx.message.text.trim());
  if (isNaN(harga_reseller) || harga_reseller <= 0) {
    await ctx.reply('⚠️ *Harga reseller tidak valid.* Silakan masukkan harga reseller yang valid.', { parse_mode: 'Markdown' });
    return;
  }

  const {
    domain,
    auth,
    nama_server,
    quota,
    iplimit,
    batas_create_akun,
    harga,
    server_type
  } = state;

  try {
    db.run(
      `INSERT INTO Server
        (domain, auth, nama_server, quota, iplimit, batas_create_akun, harga, harga_reseller, total_create_akun, server_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        domain,
        auth || '',
        nama_server,
        quota,
        iplimit,
        batas_create_akun,
        harga,
        harga_reseller,
        0,
        (server_type || 'xray')
      ],
      function (err) {
        if (err) {
          console.error('Error saat menambahkan server:', err.message);
          ctx.reply('🚫 *Terjadi kesalahan saat menambahkan server baru.*', { parse_mode: 'Markdown' });
        } else {
          ctx.reply(
            `✅ *Server baru berhasil ditambahkan!*\n\n📄 *Detail Server:*\n` +
            `- Tipe: \`${(server_type || 'xray')}\`\n` +
            `- Domain: \`${domain}\`\n` +
            `- Auth: \`${auth || '-'}\`\n` +
            `- Nama Server: \`${nama_server}\`\n` +
            `- Quota: \`${quota}\`\n` +
            `- Limit IP: \`${iplimit}\`\n` +
            `- Batas Create Akun: \`${batas_create_akun}\`\n` +
            `- Harga: \`Rp ${harga}\`\n` +
            `- Harga Reseller: \`Rp ${harga_reseller}\``,
            { parse_mode: 'Markdown' }
          );
        }
      }
    );
  } catch (error) {
    console.error('Error saat menambahkan server:', error);
    await ctx.reply('🚫 *Terjadi kesalahan saat menambahkan server baru.*', { parse_mode: 'Markdown' });
  }

  delete userState[ctx.chat.id];
}

});



bot.action('addserver', async (ctx) => {
  try {
    console.log('📥 Proses tambah server dimulai');
    await ctx.answerCbQuery();
    await ctx.reply('🌍 *Silakan masukkan domain/ip server:*', { parse_mode: 'Markdown' });
    userState[ctx.chat.id] = { step: 'addserver_domain' };
  } catch (error) {
    console.error('🚫 Kesalahan saat memulai proses tambah server:', error);
    await ctx.reply('🚫 *GAGAL! Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.*', { parse_mode: 'Markdown' });
  }
});
bot.action('detailserver', async (ctx) => {
  try {
    console.log('📋 Proses detail server dimulai');
    await ctx.answerCbQuery();
    
    const servers = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM Server', [], (err, servers) => {
        if (err) {
          console.error('⚠️ Kesalahan saat mengambil detail server:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil detail server.*');
        }
        resolve(servers);
      });
    });

    if (servers.length === 0) {
      console.log('⚠️ Tidak ada server yang tersedia');
      return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia saat ini.*', { parse_mode: 'Markdown' });
    }

    const buttons = [];
    for (let i = 0; i < servers.length; i += 2) {
      const row = [];
      row.push({
        text: `${servers[i].nama_server}`,
        callback_data: `server_detail_${servers[i].id}`
      });
      if (i + 1 < servers.length) {
        row.push({
          text: `${servers[i + 1].nama_server}`,
          callback_data: `server_detail_${servers[i + 1].id}`
        });
      }
      buttons.push(row);
    }

    await ctx.reply('📋 *Silakan pilih server untuk melihat detail:*', {
      reply_markup: { inline_keyboard: buttons },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('⚠️ Kesalahan saat mengambil detail server:', error);
    await ctx.reply('⚠️ *Terjadi kesalahan saat mengambil detail server.*', { parse_mode: 'Markdown' });
  }
});

bot.action('listserver', async (ctx) => {
  try {
    console.log('📜 Proses daftar server dimulai');
    await ctx.answerCbQuery();
    
    const servers = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM Server', [], (err, servers) => {
        if (err) {
          console.error('⚠️ Kesalahan saat mengambil daftar server:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
        }
        resolve(servers);
      });
    });

    if (servers.length === 0) {
      console.log('⚠️ Tidak ada server yang tersedia');
      return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia saat ini.*', { parse_mode: 'Markdown' });
    }

    let serverList = '📜 *Daftar Server* 📜\n\n';
    servers.forEach((server, index) => {
      serverList += `🔹 ${index + 1}. ${server.domain}\n`;
    });

    serverList += `\nTotal Jumlah Server: ${servers.length}`;

    await ctx.reply(serverList, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('⚠️ Kesalahan saat mengambil daftar server:', error);
    await ctx.reply('⚠️ *Terjadi kesalahan saat mengambil daftar server.*', { parse_mode: 'Markdown' });
  }
});
bot.action('resetdb', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('🚨 *PERHATIAN! Anda akan menghapus semua server yang tersedia. Apakah Anda yakin?*', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Ya', callback_data: 'confirm_resetdb' }],
          [{ text: '🚫 Tidak', callback_data: 'cancel_resetdb' }]
        ]
      },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('🚫 Error saat memulai proses reset database:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});

bot.action('confirm_resetdb', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM Server', (err) => {
        if (err) {
          console.error('🚫 Error saat mereset tabel Server:', err.message);
          return reject('❗️ *PERHATIAN! Terjadi KESALAHAN SERIUS saat mereset database. Harap segera hubungi administrator!*');
        }
        resolve();
      });
    });
    await ctx.reply('🚨 *PERHATIAN! Database telah DIRESET SEPENUHNYA. Semua server telah DIHAPUS TOTAL.*', { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('🚫 Error saat mereset database:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});

bot.action('cancel_resetdb', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply('🚫 *Proses reset database dibatalkan.*', { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('🚫 Error saat membatalkan reset database:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});
bot.action('deleteserver', async (ctx) => {
  try {
    console.log('🗑️ Proses hapus server dimulai');
    await ctx.answerCbQuery();
    
    db.all('SELECT * FROM Server', [], (err, servers) => {
      if (err) {
        console.error('⚠️ Kesalahan saat mengambil daftar server:', err.message);
        return ctx.reply('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*', { parse_mode: 'Markdown' });
      }

      if (servers.length === 0) {
        console.log('⚠️ Tidak ada server yang tersedia');
        return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia saat ini.*', { parse_mode: 'Markdown' });
      }

      const keyboard = servers.map(server => {
        return [{ text: server.nama_server, callback_data: `confirm_delete_server_${server.id}` }];
      });
      keyboard.push([{ text: '🔙 Kembali ke Menu Utama', callback_data: 'kembali_ke_menu' }]);

      ctx.reply('🗑️ *Pilih server yang ingin dihapus:*', {
        reply_markup: {
          inline_keyboard: keyboard
        },
        parse_mode: 'Markdown'
      });
    });
  } catch (error) {
    console.error('🚫 Kesalahan saat memulai proses hapus server:', error);
    await ctx.reply('🚫 *GAGAL! Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.*', { parse_mode: 'Markdown' });
  }
});


bot.action('cek_saldo', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT saldo FROM users WHERE user_id = ?', [userId], (err, row) => {
        if (err) {
          console.error('🚫 Kesalahan saat memeriksa saldo:', err.message);
          return reject('🚫 *Terjadi kesalahan saat memeriksa saldo Anda. Silakan coba lagi nanti.*');
        }
        resolve(row);
      });
    });

    if (row) {
      await ctx.reply(`💳 *Saldo Anda saat ini adalah:* Rp${row.saldo}\n🆔 *ID Anda:* ${userId}`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply('⚠️ *Anda belum memiliki saldo. Silakan tambahkan saldo terlebih dahulu.*', { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('🚫 Kesalahan saat memeriksa saldo:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});
const getUsernameById = async (userId) => {
  try {
    const telegramUser = await bot.telegram.getChat(userId);
    // Jika username tidak ada, gunakan first_name atau User ID sebagai fallback
    return telegramUser.username ? `@${telegramUser.username}` : telegramUser.first_name || `User ID: ${userId}`;
  } catch (err) {
    console.error('🚫 Kesalahan saat mengambil username dari Telegram:', err.message);
    return `User ID: ${userId}`; // Kembalikan User ID jika terjadi error
  }
};

async function getUserIdFromTelegram(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM Users WHERE user_id = ?', [userId], (err, row) => {
      if (err) {
        console.error('🚫 Kesalahan saat mengambil ID pengguna dari database:', err.message);
        reject(err);
      } else {
        resolve(row ? row.id : null);
      }
    });
  });
}


bot.action('addsaldo_user', async (ctx) => {
  try {
    console.log('Add saldo user process started');
    await ctx.answerCbQuery();

    const users = await new Promise((resolve, reject) => {
      db.all('SELECT id, user_id FROM Users LIMIT 20', [], (err, users) => {
        if (err) {
          console.error('🚫 Kesalahan saat mengambil daftar user:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar user.*');
        }
        resolve(users);
      });
    });

    const totalUsers = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM Users', [], (err, row) => {
        if (err) {
          console.error('🚫 Kesalahan saat menghitung total user:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat menghitung total user.*');
        }
        resolve(row.count);
      });
    });

    const buttons = [];
    for (let i = 0; i < users.length; i += 2) {
      const row = [];
      const username1 = await getUsernameById(users[i].user_id);
      row.push({
        text: username1 || users[i].user_id,
        callback_data: `add_saldo_${users[i].id}`
      });
      if (i + 1 < users.length) {
        const username2 = await getUsernameById(users[i + 1].user_id);
        row.push({
          text: username2 || users[i + 1].user_id,
          callback_data: `add_saldo_${users[i + 1].id}`
        });
      }
      buttons.push(row);
    }

    const currentPage = 0; // Halaman saat ini
    const replyMarkup = {
      inline_keyboard: [...buttons]
    };

    if (totalUsers > 20) {
      replyMarkup.inline_keyboard.push([{
        text: '➡️ Next',
        callback_data: `next_users_${currentPage + 1}`
      }]);
    }

    await ctx.reply('📊 *Silakan pilih user untuk menambahkan saldo:*', {
      reply_markup: replyMarkup,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('🚫 Kesalahan saat memulai proses tambah saldo user:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});
bot.action(/next_users_(\d+)/, async (ctx) => {
  const currentPage = parseInt(ctx.match[1]);
  const offset = currentPage * 20; // Menghitung offset berdasarkan halaman saat ini

  try {
    console.log(`Next users process started for page ${currentPage + 1}`);
    await ctx.answerCbQuery();

    const users = await new Promise((resolve, reject) => {
      db.all(`SELECT id, user_id FROM Users LIMIT 20 OFFSET ${offset}`, [], (err, users) => {
        if (err) {
          console.error('🚫 Kesalahan saat mengambil daftar user:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar user.*');
        }
        resolve(users);
      });
    });

    const totalUsers = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM Users', [], (err, row) => {
        if (err) {
          console.error('🚫 Kesalahan saat menghitung total user:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat menghitung total user.*');
        }
        resolve(row.count);
      });
    });

    const buttons = [];
    for (let i = 0; i < users.length; i += 2) {
      const row = [];
      const username1 = await getUsernameById(users[i].user_id);
      row.push({
        text: username1 || users[i].user_id,
        callback_data: `add_saldo_${users[i].id}`
      });
      if (i + 1 < users.length) {
        const username2 = await getUsernameById(users[i + 1].user_id);
        row.push({
          text: username2 || users[i + 1].user_id,
          callback_data: `add_saldo_${users[i + 1].id}`
        });
      }
      buttons.push(row);
    }

    const replyMarkup = {
      inline_keyboard: [...buttons]
    };

    // Menambahkan tombol navigasi
    const navigationButtons = [];
    if (currentPage > 0) {
      navigationButtons.push([{
        text: '⬅️ Back',
        callback_data: `prev_users_${currentPage - 1}`
      }]);
    }
    if (offset + 20 < totalUsers) {
      navigationButtons.push([{
        text: '➡️ Next',
        callback_data: `next_users_${currentPage + 1}`
      }]);
    }

    replyMarkup.inline_keyboard.push(...navigationButtons);

    await ctx.editMessageReplyMarkup(replyMarkup);
  } catch (error) {
    console.error('🚫 Kesalahan saat memproses next users:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});

bot.action(/prev_users_(\d+)/, async (ctx) => {
  const currentPage = parseInt(ctx.match[1]);
  const offset = (currentPage - 1) * 20; 

  try {
    console.log(`Previous users process started for page ${currentPage}`);
    await ctx.answerCbQuery();

    const users = await new Promise((resolve, reject) => {
      db.all(`SELECT id, user_id FROM Users LIMIT 20 OFFSET ${offset}`, [], (err, users) => {
        if (err) {
          console.error('🚫 Kesalahan saat mengambil daftar user:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar user.*');
        }
        resolve(users);
      });
    });

    const totalUsers = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM Users', [], (err, row) => {
        if (err) {
          console.error('🚫 Kesalahan saat menghitung total user:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat menghitung total user.*');
        }
        resolve(row.count);
      });
    });

    const buttons = [];
    for (let i = 0; i < users.length; i += 2) {
      const row = [];
      const username1 = await getUsernameById(users[i].user_id);
      row.push({
        text: username1 || users[i].user_id,
        callback_data: `add_saldo_${users[i].id}`
      });
      if (i + 1 < users.length) {
        const username2 = await getUsernameById(users[i + 1].user_id);
        row.push({
          text: username2 || users[i + 1].user_id,
          callback_data: `add_saldo_${users[i + 1].id}`
        });
      }
      buttons.push(row);
    }

    const replyMarkup = {
      inline_keyboard: [...buttons]
    };

    const navigationButtons = [];
    if (currentPage > 0) {
      navigationButtons.push([{
        text: '⬅️ Back',
        callback_data: `prev_users_${currentPage - 1}`
      }]);
    }
    if (offset + 20 < totalUsers) {
      navigationButtons.push([{
        text: '➡️ Next',
        callback_data: `next_users_${currentPage}`
      }]);
    }

    replyMarkup.inline_keyboard.push(...navigationButtons);

    await ctx.editMessageReplyMarkup(replyMarkup);
  } catch (error) {
    console.error('🚫 Kesalahan saat memproses previous users:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});
bot.action('editserver_limit_ip', async (ctx) => {
  try {
    console.log('Edit server limit IP process started');
    await ctx.answerCbQuery();

    const servers = await new Promise((resolve, reject) => {
      db.all('SELECT id, nama_server FROM Server', [], (err, servers) => {
        if (err) {
          console.error('🚫 Kesalahan saat mengambil daftar server:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
        }
        resolve(servers);
      });
    });

    if (servers.length === 0) {
      return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*', { parse_mode: 'Markdown' });
    }

    const buttons = servers.map(server => ({
      text: server.nama_server,
      callback_data: `edit_limit_ip_${server.id}`
    }));

    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      inlineKeyboard.push(buttons.slice(i, i + 2));
    }

    await ctx.reply('📊 *Silakan pilih server untuk mengedit limit IP:*', {
      reply_markup: { inline_keyboard: inlineKeyboard },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('🚫 Kesalahan saat memulai proses edit limit IP server:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});
bot.action('editserver_batas_create_akun', async (ctx) => {
  try {
    console.log('Edit server batas create akun process started');
    await ctx.answerCbQuery();

    const servers = await new Promise((resolve, reject) => {
      db.all('SELECT id, nama_server FROM Server', [], (err, servers) => {
        if (err) {
          console.error('🚫 Kesalahan saat mengambil daftar server:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
        }
        resolve(servers);
      });
    });

    if (servers.length === 0) {
      return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*', { parse_mode: 'Markdown' });
    }

    const buttons = servers.map(server => ({
      text: server.nama_server,
      callback_data: `edit_batas_create_akun_${server.id}`
    }));

    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      inlineKeyboard.push(buttons.slice(i, i + 2));
    }

    await ctx.reply('📊 *Silakan pilih server untuk mengedit batas create akun:*', {
      reply_markup: { inline_keyboard: inlineKeyboard },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('🚫 Kesalahan saat memulai proses edit batas create akun server:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});
bot.action('editserver_total_create_akun', async (ctx) => {
  try {
    console.log('Edit server total create akun process started');
    await ctx.answerCbQuery();

    const servers = await new Promise((resolve, reject) => {
      db.all('SELECT id, nama_server FROM Server', [], (err, servers) => {
        if (err) {
          console.error('🚫 Kesalahan saat mengambil daftar server:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
        }
        resolve(servers);
      });
    });

    if (servers.length === 0) {
      return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*', { parse_mode: 'Markdown' });
    }

    const buttons = servers.map(server => ({
      text: server.nama_server,
      callback_data: `edit_total_create_akun_${server.id}`
    }));

    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      inlineKeyboard.push(buttons.slice(i, i + 2));
    }

    await ctx.reply('📊 *Silakan pilih server untuk mengedit total create akun:*', {
      reply_markup: { inline_keyboard: inlineKeyboard },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('🚫 Kesalahan saat memulai proses edit total create akun server:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});
bot.action('editserver_quota', async (ctx) => {
  try {
    console.log('Edit server quota process started');
    await ctx.answerCbQuery();

    const servers = await new Promise((resolve, reject) => {
      db.all('SELECT id, nama_server FROM Server', [], (err, servers) => {
        if (err) {
          console.error('🚫 Kesalahan saat mengambil daftar server:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
        }
        resolve(servers);
      });
    });

    if (servers.length === 0) {
      return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*', { parse_mode: 'Markdown' });
    }

    const buttons = servers.map(server => ({
      text: server.nama_server,
      callback_data: `edit_quota_${server.id}`
    }));

    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      inlineKeyboard.push(buttons.slice(i, i + 2));
    }

    await ctx.reply('📊 *Silakan pilih server untuk mengedit quota:*', {
      reply_markup: { inline_keyboard: inlineKeyboard },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('🚫 Kesalahan saat memulai proses edit quota server:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});
bot.action('editserver_auth', async (ctx) => {
  try {
    console.log('Edit server auth process started');
    await ctx.answerCbQuery();

    const servers = await new Promise((resolve, reject) => {
      db.all('SELECT id, nama_server FROM Server', [], (err, servers) => {
        if (err) {
          console.error('🚫 Kesalahan saat mengambil daftar server:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
        }
        resolve(servers);
      });
    });

    if (servers.length === 0) {
      return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*', { parse_mode: 'Markdown' });
    }

    const buttons = servers.map(server => ({
      text: server.nama_server,
      callback_data: `edit_auth_${server.id}`
    }));

    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      inlineKeyboard.push(buttons.slice(i, i + 2));
    }

    await ctx.reply('🌍 *Silakan pilih server untuk mengedit auth:*', {
      reply_markup: { inline_keyboard: inlineKeyboard },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('🚫 Kesalahan saat memulai proses edit auth server:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});

bot.action('editserver_harga', async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const servers = await new Promise((resolve, reject) => {
      db.all('SELECT id, nama_server FROM Server', [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });

    if (servers.length === 0) {
      return ctx.reply('⚠️ *Tidak ada server yang tersedia.*', { parse_mode: 'Markdown' });
    }

    const inlineKeyboard = servers.map(server => ([
      { text: server.nama_server, callback_data: `edit_harga_${server.id}` }
    ]));

    await ctx.reply('📌 *Pilih server yang ingin diedit harganya:*', {
      reply_markup: { inline_keyboard: inlineKeyboard },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('❌ Gagal mengambil daftar server:', error.message);
    ctx.reply('❌ Terjadi kesalahan saat mengambil daftar server.', { parse_mode: 'Markdown' });
  }
});


bot.action('nama_server_edit', async (ctx) => {
  try {
    console.log('Edit server nama process started');
    await ctx.answerCbQuery();

    const servers = await new Promise((resolve, reject) => {
      db.all('SELECT id, nama_server FROM Server', [], (err, servers) => {
        if (err) {
          console.error('🚫 Kesalahan saat mengambil daftar server:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil daftar server.*');
        }
        resolve(servers);
      });
    });

    if (servers.length === 0) {
      return ctx.reply('⚠️ *PERHATIAN! Tidak ada server yang tersedia untuk diedit.*', { parse_mode: 'Markdown' });
    }

    const buttons = servers.map(server => ({
      text: server.nama_server,
      callback_data: `edit_nama_${server.id}`
    }));

    const inlineKeyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      inlineKeyboard.push(buttons.slice(i, i + 2));
    }

    await ctx.reply('🏷️ *Silakan pilih server untuk mengedit nama:*', {
      reply_markup: { inline_keyboard: inlineKeyboard },
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('🚫 Kesalahan saat memulai proses edit nama server:', error);
    await ctx.reply(`🚫 *${error}*`, { parse_mode: 'Markdown' });
  }
});

bot.action('topup_saldo', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    console.log(`🔍 User ${userId} memulai proses top-up saldo.`);

    // Inisialisasi state jika belum ada
    if (!global.depositState) {
      global.depositState = {};
    }
    global.depositState[userId] = { action: 'request_amount', amount: '' };

    // Tampilkan keyboard numerik
    const keyboard = keyboard_nomor();
    await ctx.reply('*jumlah nominal saldo [Minimal 10.000]:*', {
      reply_markup: {
        inline_keyboard: keyboard,
      },
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('🚫 Kesalahan saat memulai proses top-up saldo:', error);
    await ctx.reply('🚫 Gagal memulai proses top-up. Silakan coba lagi nanti.', { parse_mode: 'Markdown' });
  }
});

bot.action(/^edit_harga_(\d+)$/, async (ctx) => {
  const serverId = ctx.match[1];

  userState[ctx.chat.id] = {
    step: 'pilih_tipe_harga',
    serverId
  };

  try {
    await ctx.deleteMessage();
  } catch (err) {
    console.warn('Gagal menghapus pesan:', err.message);
  }

  await ctx.reply('💰 *Pilih jenis harga yang ingin diedit:*', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💵 Harga Member', callback_data: `edit_harga_member_${serverId}` },
          { text: '💼 Harga Reseller', callback_data: `edit_harga_reseller_${serverId}` }
        ]
      ]
    },
    parse_mode: 'Markdown'
  });
});


// Tahap 2: Pilih tipe harga
bot.action(/^edit_harga_(member|reseller)_(\d+)$/, async (ctx) => {
  const tipe = ctx.match[1];
  const serverId = ctx.match[2];

  userState[ctx.chat.id] = {
    step: 'input_harga',
    serverId,
    tipeHarga: tipe
  };

  try {
    await ctx.deleteMessage();
  } catch (err) {
    console.warn('Gagal menghapus pesan:', err.message);
  }

  await ctx.reply(`✏️ Silakan kirim harga baru untuk *${tipe === 'member' ? 'Member' : 'Reseller'}* (angka saja):`, {
    parse_mode: 'Markdown'
  });
});


bot.action(/add_saldo_(\d+)/, async (ctx) => {
  const userId = ctx.match[1];
  console.log(`User ${ctx.from.id} memilih untuk menambahkan saldo user dengan ID: ${userId}`);
  userState[ctx.chat.id] = { step: 'add_saldo', userId: userId };

  await ctx.reply('📊 *Silakan masukkan jumlah saldo yang ingin ditambahkan:*', {
    reply_markup: { inline_keyboard: keyboard_nomor() },
    parse_mode: 'Markdown'
  });
});
bot.action(/edit_batas_create_akun_(\d+)/, async (ctx) => {
  const serverId = ctx.match[1];
  console.log(`User ${ctx.from.id} memilih untuk mengedit batas create akun server dengan ID: ${serverId}`);
  userState[ctx.chat.id] = { step: 'edit_batas_create_akun', serverId: serverId };

  await ctx.reply('📊 *Silakan masukkan batas create akun server baru:*', {
    reply_markup: { inline_keyboard: keyboard_nomor() },
    parse_mode: 'Markdown'
  });
});
bot.action(/edit_total_create_akun_(\d+)/, async (ctx) => {
  const serverId = ctx.match[1];
  console.log(`User ${ctx.from.id} memilih untuk mengedit total create akun server dengan ID: ${serverId}`);
  userState[ctx.chat.id] = { step: 'edit_total_create_akun', serverId: serverId };

  await ctx.reply('📊 *Silakan masukkan total create akun server baru:*', {
    reply_markup: { inline_keyboard: keyboard_nomor() },
    parse_mode: 'Markdown'
  });
});
bot.action(/edit_limit_ip_(\d+)/, async (ctx) => {
  const serverId = ctx.match[1];
  console.log(`User ${ctx.from.id} memilih untuk mengedit limit IP server dengan ID: ${serverId}`);
  userState[ctx.chat.id] = { step: 'edit_limit_ip', serverId: serverId };

  await ctx.reply('📊 *Silakan masukkan limit IP server baru:*', {
    reply_markup: { inline_keyboard: keyboard_nomor() },
    parse_mode: 'Markdown'
  });
});
bot.action(/edit_quota_(\d+)/, async (ctx) => {
  const serverId = ctx.match[1];
  console.log(`User ${ctx.from.id} memilih untuk mengedit quota server dengan ID: ${serverId}`);
  userState[ctx.chat.id] = { step: 'edit_quota', serverId: serverId };

  await ctx.reply('📊 *Silakan masukkan quota server baru:*', {
    reply_markup: { inline_keyboard: keyboard_nomor() },
    parse_mode: 'Markdown'
  });
});
bot.action(/edit_auth_(\d+)/, async (ctx) => {
  const serverId = ctx.match[1];
  console.log(`User ${ctx.from.id} memilih untuk mengedit auth server dengan ID: ${serverId}`);

  userState[ctx.chat.id] = {
    step: 'input_auth',
    serverId
  };

  await ctx.reply('🔑 *Silakan masukkan Auth server baru:*', {
    parse_mode: 'Markdown'
  });
});

bot.action(/edit_domain_(\d+)/, async (ctx) => {
  const serverId = ctx.match[1];
  console.log(`User ${ctx.from.id} memilih untuk mengedit domain server dengan ID: ${serverId}`);
  userState[ctx.chat.id] = { step: 'edit_domain', serverId: serverId };

  await ctx.reply('🌍 *Silakan masukkan domain server baru:*', {
    reply_markup: { inline_keyboard: keyboard_full() },
    parse_mode: 'Markdown'
  });
});
bot.action(/edit_nama_(\d+)/, async (ctx) => {
  const serverId = ctx.match[1];
  console.log(`User ${ctx.from.id} memilih untuk mengedit nama server dengan ID: ${serverId}`);
  userState[ctx.chat.id] = { step: 'edit_nama', serverId: serverId };

  await ctx.reply('🏷️ *Silakan masukkan nama server baru:*', {
    reply_markup: { inline_keyboard: keyboard_abc() },
    parse_mode: 'Markdown'
  });
});
bot.action(/confirm_delete_server_(\d+)/, async (ctx) => {
  try {
    db.run('DELETE FROM Server WHERE id = ?', [ctx.match[1]], function(err) {
      if (err) {
        console.error('Error deleting server:', err.message);
        return ctx.reply('⚠️ *PERHATIAN! Terjadi kesalahan saat menghapus server.*', { parse_mode: 'Markdown' });
      }

      if (this.changes === 0) {
        console.log('Server tidak ditemukan');
        return ctx.reply('⚠️ *PERHATIAN! Server tidak ditemukan.*', { parse_mode: 'Markdown' });
      }

      console.log(`Server dengan ID ${ctx.match[1]} berhasil dihapus`);
      ctx.reply('✅ *Server berhasil dihapus.*', { parse_mode: 'Markdown' });
    });
  } catch (error) {
    console.error('Kesalahan saat menghapus server:', error);
    await ctx.reply('🚫 *GAGAL! Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi nanti.*', { parse_mode: 'Markdown' });
  }
});
bot.action(/server_detail_(\d+)/, async (ctx) => {
  const serverId = ctx.match[1];
  try {
    const server = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM Server WHERE id = ?', [serverId], (err, server) => {
        if (err) {
          console.error('⚠️ Kesalahan saat mengambil detail server:', err.message);
          return reject('⚠️ *PERHATIAN! Terjadi kesalahan saat mengambil detail server.*');
        }
        resolve(server);
      });
    });

    if (!server) {
      console.log('⚠️ Server tidak ditemukan');
      return ctx.reply('⚠️ *PERHATIAN! Server tidak ditemukan.*', { parse_mode: 'Markdown' });
    }

    const serverDetails = `📋 *Detail Server* 📋\n\n` +
      `🌍 *Domain:* \`${server.domain}\`\n` +
      `🔑 *Auth:* \`${server.auth}\`\n` +
      `🏷️ *Nama Server:* \`${server.nama_server}\`\n` +
      `📊 *Quota:* \`${server.quota}\`\n` +
      `📶 *Limit IP:* \`${server.iplimit}\`\n` +
      `🔢 *Batas Create Akun:* \`${server.batas_create_akun}\`\n` +
      `📋 *Total Create Akun:* \`${server.total_create_akun}\`\n` +
      `💵 *Harga:* \`Rp ${server.harga}\`\n` +
      `💵 *Harga Reseller:* \`Rp ${server.harga_reseller}\`\n\n`;

    await ctx.reply(serverDetails, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('⚠️ Kesalahan saat mengambil detail server:', error);
    await ctx.reply('⚠️ *Terjadi kesalahan saat mengambil detail server.*', { parse_mode: 'Markdown' });
  }
});

bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const data = ctx.callbackQuery.data;
  const userStateData = userState[ctx.chat.id];

  if (global.depositState && global.depositState[userId] && global.depositState[userId].action === 'request_amount') {
    await handleDepositState(ctx, userId, data);
  } else if (userStateData) {
    switch (userStateData.step) {
      case 'add_saldo':
        await handleAddSaldo(ctx, userStateData, data);
        break;
      case 'edit_batas_create_akun':
        await handleEditBatasCreateAkun(ctx, userStateData, data);
        break;
      case 'edit_limit_ip':
        await handleEditiplimit(ctx, userStateData, data);
        break;
      case 'edit_quota':
        await handleEditQuota(ctx, userStateData, data);
        break;
      case 'edit_auth':
        await handleEditAuth(ctx, userStateData, data);
        break;
      case 'edit_domain':
        await handleEditDomain(ctx, userStateData, data);
        break;
      case 'edit_harga':
        await handleEditHarga(ctx, userStateData, data);
        break;
      case 'edit_nama':
        await handleEditNama(ctx, userStateData, data);
        break;
      case 'edit_total_create_akun':
        await handleEditTotalCreateAkun(ctx, userStateData, data);
        break;
	  case 'cek_saldo_semua': // Tambahkan case baru untuk cek saldo semua
        await handleCekSaldoSemua(ctx, userId);
        break;
    }
  }
});

async function handleCekSaldoSemua(ctx, userId) {
  if (userId != ADMIN) {
    return await ctx.reply('🚫 *Anda tidak memiliki izin untuk melihat saldo semua pengguna.*', { parse_mode: 'Markdown' });
  }

  try {
    const users = await new Promise((resolve, reject) => {
      db.all('SELECT user_id, saldo FROM users WHERE saldo > 0 ORDER BY saldo DESC', [], (err, rows) => {
        if (err) {
          console.error('🚫 Kesalahan saat mengambil data saldo semua user:', err.message);
          return reject('🚫 *Terjadi kesalahan saat mengambil data saldo semua pengguna.*');
        }
        resolve(rows);
      });
    });

    if (!users || users.length === 0) {
      return await ctx.editMessageText('⚠️ *Tidak ada pengguna dengan saldo lebih dari Rp0,00.*', { parse_mode: 'Markdown' });
    }

    let message = '📊 *Saldo Pengguna dengan Saldo > 0:*\n\n';
    message += '```\n'; // Awal format monospace
    message += '┌──────────────┬─────────────────┐\n';
    message += '│ 🆔 User ID   │ 💳 Saldo        │\n';
    message += '├──────────────┼─────────────────┤\n';

    users.forEach(user => {
      let userId = user.user_id.toString().padEnd(12);
      let saldo = `Rp${user.saldo.toLocaleString('id-ID')},00`.padStart(15);
      message += `│ ${userId} │ ${saldo} │\n`;
    });

    message += '└──────────────┴─────────────────┘\n';
    message += '```\n'; // Akhir format monospace

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Kembali ke Main Menu', callback_data: 'send_main_menu' }]
        ]
      }
    });

  } catch (error) {
    console.error('🚫 Kesalahan saat mengambil saldo semua user:', error);
    await ctx.reply(`🚫 *Terjadi kesalahan:* ${error.message}`, { parse_mode: 'Markdown' });
  }
}

// Handler tombol kembali ke menu utama dengan transisi halus
bot.action('send_main_menu', async (ctx) => {
  try {
    await ctx.editMessageText('🔄 *Kembali ke menu utama...*', { parse_mode: 'Markdown' });
    setTimeout(async () => {
      await ctx.editMessageText('📌 *Main Menu:*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Cek Saldo', callback_data: 'cek_saldo' }],
            [{ text: '⚙️ Pengaturan', callback_data: 'settings' }]
          ]
        }
      });
    }, 1000); // Delay 1 detik untuk efek transisi
  } catch (error) {
    console.error('🚫 Error saat kembali ke main menu:', error);
  }
});



async function handleDepositState(ctx, userId, data) {
  let currentAmount = global.depositState[userId].amount;

  if (data === 'delete') {
    currentAmount = currentAmount.slice(0, -1);
  } else if (data === 'confirm') {
    if (currentAmount.length === 0) {
      return await ctx.answerCbQuery('⚠️ Jumlah tidak boleh kosong!', { show_alert: true });
    }
    if (parseInt(currentAmount) < 10000) {
      return await ctx.answerCbQuery('⚠️ Jumlah minimal adalah 10Ribu!', { show_alert: true });
    }

    try {
      global.depositState[userId].action = 'confirm_amount';

      const randomSuffix = Math.floor(10 + Math.random() * 90);
      const uniqueAmount = parseInt(currentAmount) + randomSuffix;
      const reference = `INV-${userId}-${Date.now()}`;
	try {
        await ctx.deleteMessage();
      } catch (e) {
        console.warn('⚠️ Gagal hapus pesan inline sebelumnya:', e.message);
      }

      const qrImage = await generateQR(uniqueAmount);

      const message = await ctx.replyWithPhoto({ source: qrImage }, {
        caption: `
<b>──────────────────────</b>
<b>Open TopUp Transaction Success</b>
<b>──────────────────────</b>
✧ <b>User</b>  : ${ctx.from.username}
✧ <b>ID</b>    : ${userId}
<b>──────────────────────</b>
✧ <b>Code</b>  : ${reference}
✧ <b>Pay</b>   : Rp ${uniqueAmount.toLocaleString('id-ID')}
✧ <b>Info</b>  : ⏳ Pending
✧ <b>Exp</b>   : ${new Date(Date.now() + 5 * 60000).toLocaleTimeString('id-ID')}
✧ <b>Date</b>  : ${new Date().toLocaleString('id-ID')}
<b>──────────────────────</b>
BAYAR SESUAI YANG TERTERA DI PAY
<b>──────────────────────</b>
        `,
        parse_mode: 'HTML',
      });

      global.depositState[userId] = {
        uniqueAmount,
        userId,
        reference,
        nominalAsli: parseInt(currentAmount),
        messageId: message.message_id
      };

      await topUpQueue.add({
        userId,
        reference,
        nominal: parseInt(currentAmount),
        uniqueAmount
      });

    } catch (err) {
      console.error('🚫 Gagal saat proses konfirmasi deposit:', err);
      await ctx.reply('🚫 Gagal memproses top-up. Silakan coba lagi nanti.');
    }

    return; // stop proses di sini
  } else {
    if (currentAmount.length < 12) {
      currentAmount += data;
    } else {
      return await ctx.answerCbQuery('⚠️ Jumlah maksimal adalah 12 digit!', { show_alert: true });
    }
  }

  global.depositState[userId].amount = currentAmount;

  const newMessage = `*Silakan masukkan jumlah nominal saldo yang Anda ingin tambahkan ke akun Anda [Minimal 10.000]:*\n\nJumlah saat ini: *Rp ${currentAmount}*`;
  if (newMessage !== ctx.callbackQuery.message.text) {
    await ctx.editMessageText(newMessage, {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  }
}


async function handleAddSaldo(ctx, userStateData, data) {
  let currentSaldo = userStateData.saldo || '';

  if (data === 'delete') {
    currentSaldo = currentSaldo.slice(0, -1);
  } else if (data === 'confirm') {
    if (currentSaldo.length === 0) {
      return await ctx.answerCbQuery('⚠️ *Jumlah saldo tidak boleh kosong!*', { show_alert: true });
    }

    try {
      await updateUserSaldo(userStateData.userId, currentSaldo);
      ctx.reply(`✅ *Saldo user berhasil ditambahkan.*\n\n📄 *Detail Saldo:*\n- Jumlah Saldo: *Rp ${currentSaldo}*`, { parse_mode: 'Markdown' });
    } catch (err) {
      ctx.reply('🚫 *Terjadi kesalahan saat menambahkan saldo user.*', { parse_mode: 'Markdown' });
    }
    delete userState[ctx.chat.id];
    return;
  } else {
    if (!/^[0-9]+$/.test(data)) {
      return await ctx.answerCbQuery('⚠️ *Jumlah saldo tidak valid!*', { show_alert: true });
    }
    if (currentSaldo.length < 12) {
      currentSaldo += data;
    } else {
      return await ctx.answerCbQuery('⚠️ *Jumlah saldo maksimal adalah 12 karakter!*', { show_alert: true });
    }
  }

  userStateData.saldo = currentSaldo;
  const newMessage = `📊 *Silakan masukkan jumlah saldo yang ingin ditambahkan:*\n\nJumlah saldo saat ini: *${currentSaldo}*`;
  if (newMessage !== ctx.callbackQuery.message.text) {
    await ctx.editMessageText(newMessage, {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  }
}

async function handleEditBatasCreateAkun(ctx, userStateData, data) {
  await handleEditField(ctx, userStateData, data, 'batasCreateAkun', 'batas create akun', 'UPDATE Server SET batas_create_akun = ? WHERE id = ?');
}

async function handleEditTotalCreateAkun(ctx, userStateData, data) {
  await handleEditField(ctx, userStateData, data, 'totalCreateAkun', 'total create akun', 'UPDATE Server SET total_create_akun = ? WHERE id = ?');
}

async function handleEditiplimit(ctx, userStateData, data) {
  await handleEditField(ctx, userStateData, data, 'iplimit', 'limit IP', 'UPDATE Server SET limit_ip = ? WHERE id = ?');
}

async function handleEditQuota(ctx, userStateData, data) {
  await handleEditField(ctx, userStateData, data, 'quota', 'quota', 'UPDATE Server SET quota = ? WHERE id = ?');
}

async function handleEditAuth(ctx, userStateData, data) {
  await handleEditField(ctx, userStateData, data, 'auth', 'auth', 'UPDATE Server SET auth = ? WHERE id = ?');
}

async function handleEditDomain(ctx, userStateData, data) {
  await handleEditField(ctx, userStateData, data, 'domain', 'domain', 'UPDATE Server SET domain = ? WHERE id = ?');
}

async function handleEditHarga(ctx, userStateData, data) {
  let currentAmount = userStateData.amount || '';

  if (data === 'delete') {
    currentAmount = currentAmount.slice(0, -1);
  } else if (data === 'confirm') {
    if (currentAmount.length === 0) {
      return await ctx.answerCbQuery('⚠️ *Jumlah tidak boleh kosong!*', { show_alert: true });
    }
    const hargaBaru = parseFloat(currentAmount);
    if (isNaN(hargaBaru) || hargaBaru <= 0) {
      return ctx.reply('🚫 *Harga tidak valid. Masukkan angka yang valid.*', { parse_mode: 'Markdown' });
    }
    try {
      await updateServerField(userStateData.serverId, hargaBaru, 'UPDATE Server SET harga = ? WHERE id = ?');
      ctx.reply(`✅ *Harga server berhasil diupdate.*\n\n📄 *Detail Server:*\n- Harga Baru: *Rp ${hargaBaru}*`, { parse_mode: 'Markdown' });
    } catch (err) {
      ctx.reply('🚫 *Terjadi kesalahan saat mengupdate harga server.*', { parse_mode: 'Markdown' });
    }
    delete userState[ctx.chat.id];
    return;
  } else {
    if (!/^\d+$/.test(data)) {
      return await ctx.answerCbQuery('⚠️ *Hanya angka yang diperbolehkan!*', { show_alert: true });
    }
    if (currentAmount.length < 12) {
      currentAmount += data;
    } else {
      return await ctx.answerCbQuery('⚠️ *Jumlah maksimal adalah 12 digit!*', { show_alert: true });
    }
  }

  userStateData.amount = currentAmount;
  const newMessage = `💰 *Silakan masukkan harga server baru:*\n\nJumlah saat ini: *Rp ${currentAmount}*`;
  if (newMessage !== ctx.callbackQuery.message.text) {
    await ctx.editMessageText(newMessage, {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  }
}

async function handleEditNama(ctx, userStateData, data) {
  await handleEditField(ctx, userStateData, data, 'name', 'nama server', 'UPDATE Server SET nama_server = ? WHERE id = ?');
}

async function handleEditField(ctx, userStateData, data, field, fieldName, query) {
  let currentValue = userStateData[field] || '';

  if (data === 'delete') {
    currentValue = currentValue.slice(0, -1);
  } else if (data === 'confirm') {
    if (currentValue.length === 0) {
      return await ctx.answerCbQuery(`⚠️ *${fieldName} tidak boleh kosong!*`, { show_alert: true });
    }
    try {
      await updateServerField(userStateData.serverId, currentValue, query);
      ctx.reply(`✅ *${fieldName} server berhasil diupdate.*\n\n📄 *Detail Server:*\n- ${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}: *${currentValue}*`, { parse_mode: 'Markdown' });
    } catch (err) {
      ctx.reply(`🚫 *Terjadi kesalahan saat mengupdate ${fieldName} server.*`, { parse_mode: 'Markdown' });
    }
    delete userState[ctx.chat.id];
    return;
  } else {
    if (!/^[a-zA-Z0-9.-]+$/.test(data)) {
      return await ctx.answerCbQuery(`⚠️ *${fieldName} tidak valid!*`, { show_alert: true });
    }
    if (currentValue.length < 253) {
      currentValue += data;
    } else {
      return await ctx.answerCbQuery(`⚠️ *${fieldName} maksimal adalah 253 karakter!*`, { show_alert: true });
    }
  }

  userStateData[field] = currentValue;
  const newMessage = `📊 *Silakan masukkan ${fieldName} server baru:*\n\n${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} saat ini: *${currentValue}*`;
  if (newMessage !== ctx.callbackQuery.message.text) {
    await ctx.editMessageText(newMessage, {
      reply_markup: { inline_keyboard: keyboard_nomor() },
      parse_mode: 'Markdown'
    });
  }
}
async function updateUserSaldo(id, saldo) {
  return new Promise((resolve, reject) => {
    db.get('SELECT user_id, sudah_dapat_bonus_first FROM users WHERE id = ?', [id], async (err, row) => {
      if (err || !row) {
        console.error('⚠️ Gagal ambil user_id dari database:', err?.message || 'Data tidak ditemukan');
        return reject(err || new Error('User tidak ditemukan'));
      }

      const userTelegramId = row.user_id;
      const sudahDapatBonus = row.sudah_dapat_bonus_first;

		console.log('🔍 Saldo sebelum parse:', saldo, '| Tipe:', typeof saldo);
		const depositAsNumber = parseInt(saldo);
		console.log('✅ Saldo setelah parse:', depositAsNumber, '| Tipe:', typeof depositAsNumber);

		const bonus = parseInt(await cekDanHitungBonusDeposit(userTelegramId, depositAsNumber), 10);
		console.log('🎁 Bonus:', bonus, '| Tipe:', typeof bonus);

		// Hitung saldo total yg akan ditambahkan
		const totalSaldo = depositAsNumber + bonus;


      // Update saldo & bonus jika ada
      let updateQuery = 'UPDATE users SET saldo = saldo + ?';
      const params = [totalSaldo];

      if (bonus > 0 && sudahDapatBonus === 0) {
        updateQuery += ', sudah_dapat_bonus_first = 1';
      }

      updateQuery += ' WHERE id = ?';
      params.push(id);

      db.run(updateQuery, params, function (err) {
        if (err) {
          console.error('⚠️ Kesalahan saat menambahkan saldo user:', err.message);
          return reject(err);
        }
		
		let pesan = `💰 *Saldo berhasil ditambahkan!*\n\n📥 Tambahan: *Rp ${saldo.toLocaleString('id-ID')}*`;

		if (bonus > 0) {
		  pesan += `\n🎁 Bonus: *Rp ${bonus.toLocaleString('id-ID')}*`;
		  pesan += `\n💰 Total Masuk: *Rp ${(saldo + bonus).toLocaleString('id-ID')}*`;
		}


        bot.telegram.sendMessage(userTelegramId, pesan, { parse_mode: 'Markdown' })
          .catch(e => console.warn('⚠️ Gagal kirim notifikasi ke user:', e.message));

        console.log(`✅ Total Rp ${totalSaldo} berhasil ditambahkan ke user ID ${id} (Telegram ID ${userTelegramId})`);
        resolve();
      });
    });
  });
}



async function updateServerField(serverId, value, query) {
  return new Promise((resolve, reject) => {
    db.run(query, [value, serverId], function (err) {
      if (err) {
        console.error(`⚠️ Kesalahan saat mengupdate ${fieldName} server:`, err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

global.depositState = {};

topUpQueue.process(async (job) => {
  const { userId, amount, uniqueAmount, reference } = job.data;

  try {
    console.log(`🔍 Memproses top-up untuk user ${userId} sebesar Rp${uniqueAmount} dengan ref ${reference}`);

    let pembayaranDiterima = false;
    const timeout = Date.now() + 5 * 60 * 1000; // 3 menit

    while (Date.now() < timeout) {
      console.log('⚙️ Memanggil checkPaymentByAmount...');
      const transaksi = await checkPaymentByAmount(reference, uniqueAmount);

      // Validasi response
      if (
        transaksi &&
        transaksi.success &&
        transaksi.data &&
        transaksi.data.status === 'PAID' &&
        transaksi.data.amount &&
        transaksi.data.buyer_reff
      ) {
        const { amount, buyer_reff, reference, brand_name } = transaksi.data;

        console.log(`✅ Pembayaran diterima dari ${buyer_reff} sebesar Rp${amount}`);
		const receipt = transaksi.receipt;
        // Hapus QR dari chat
        await bot.telegram.deleteMessage(userId, global.depositState[userId]?.messageId);

        // Ambil user ID dari database
        const userDbId = await getUserIdFromTelegram(userId);
        if (!userDbId) throw new Error('User ID tidak ditemukan dalam database');

        // Tambah saldo user
        await updateUserSaldo(userDbId, parseInt(amount));

        // Naikkan ke reseller jika saldo mencukupi
        if (amount >= 25000) {
          await checkAndUpdateUserRole(userId);
        }

        // Kirim notifikasi ke user
        await sendUserNotificationTopup(
          userId,
          reference,
          amount,
          uniqueAmount,
          brand_name,
          buyer_reff,
		  receipt
        );

        // Info user Telegram
        const user = await bot.telegram.getChat(userId);
        const username = user.username || `User ID: ${userId}`;

        // Notifikasi ke admin & grup
        await sendAdminNotificationTopup(username, userId, reference, amount, uniqueAmount);
        await sendGroupNotificationTopup(username, userId, reference, amount, uniqueAmount);

        // Catat transaksi
        await recordUserTransaction(userId);

        pembayaranDiterima = true;
        break;
      }

      // Tunggu 20 detik sebelum cek ulang
      await new Promise((resolve) => setTimeout(resolve, 20000));
    }

    if (!pembayaranDiterima) {
      console.log(`🚫 Pembayaran tidak ditemukan untuk User ${userId}`);
      await bot.telegram.deleteMessage(userId, global.depositState[userId]?.messageId);
      await bot.telegram.sendMessage(userId, '🚫 Status TopUp *Canceled*. Melebihi batas waktu. Silahkan ulangi kembali.', {
        parse_mode: 'Markdown'
      });
    }
  } catch (error) {
    console.error('🚫 Kesalahan saat memproses top-up saldo:', error);
    await bot.telegram.sendMessage(userId, '🚫 Gagal memproses top-up. Silakan coba lagi nanti.', {
      parse_mode: 'Markdown'
    });
  } finally {
    delete global.depositState[userId];
  }
});




function keyboard_abc() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const buttons = [];
  for (let i = 0; i < alphabet.length; i += 3) {
    const row = alphabet.slice(i, i + 3).split('').map(char => ({
      text: char,
      callback_data: char
    }));
    buttons.push(row);
  }
  buttons.push([{ text: '🔙 Hapus', callback_data: 'delete' }, { text: '✅ Konfirmasi', callback_data: 'confirm' }]);
  buttons.push([{ text: '🔙 Kembali ke Menu Utama', callback_data: 'send_main_menu' }]);
  return buttons;
}

bot.action('send_main_menu', async (ctx) => {
  console.log('Tombol Kembali ke Menu Utama diklik oleh:', ctx.from.id);

  try {
    // Coba hapus pesan menu saat ini
    try {
      await ctx.deleteMessage();
      console.log('Pesan menu dihapus.');
    } catch (deleteError) {
      console.warn('Tidak dapat menghapus pesan:', deleteError.message);
      // Jika pesan tidak dapat dihapus, lanjutkan tanpa menghapus
    }

    // Tampilkan menu utama
    await sendMainMenu(ctx);
  } catch (error) {
    console.error('Gagal memproses permintaan:', error);
    await ctx.reply('🚫 Terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi.', { parse_mode: 'Markdown' });
  }
});
function keyboard_nomor() {
  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [' ', '0', '⌫ Hapus'], // Spasi untuk menjaga posisi angka 0
    ['✅ Konfirmasi'],
    ['🔙 Kembali ke Menu Utama']
  ];

  return rows.map(row => row
    .filter(text => text !== ' ') // Hapus elemen kosong agar tidak ada tombol kosong
    .map(text => ({
      text,
      callback_data: text.replace('⌫ Hapus', 'delete')
                         .replace('✅ Konfirmasi', 'confirm')
                         .replace('🔙 Kembali ke Menu Utama', 'send_main_menu')
    }))
  );
}



function keyboard_full() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789@';
  const buttons = [];
  
  // Membuat tombol dengan 4 karakter per baris
  for (let i = 0; i < alphabet.length; i += 4) {
    const row = alphabet.slice(i, i + 4).split('').map(char => ({
      text: char,
      callback_data: char
    }));
    buttons.push(row);
  }

  // Tambahan tombol kontrol
  buttons.push([
    { text: '⌫ Hapus', callback_data: 'delete' },
    { text: '✅ Konfirmasi', callback_data: 'confirm' }
  ]);
  buttons.push([
    { text: '🔙 Kembali ke Menu Utama', callback_data: 'send_main_menu' }
  ]);

  return buttons;
}


app.post('/callback/paydisini', async (req, res) => {
  console.log('Request body:', req.body); // Log untuk debugging
  const { unique_code, status } = req.body;

  if (!unique_code || !status) {
      return res.status(400).send('⚠️ *Permintaan tidak valid*');
  }

  const depositInfo = global.pendingDeposits[unique_code];
  if (!depositInfo) {
      return res.status(404).send('Jumlah tidak ditemukan untuk kode unik');
  }

  const amount = depositInfo.amount;
  const userId = depositInfo.userId;

  try {
      const [prefix, user_id] = unique_code.split('-');
      if (prefix !== 'user' || !user_id) {
          return res.status(400).send('Format kode unik tidak valid');
      }

      if (status === 'Success') {

          db.run("UPDATE users SET saldo = saldo + ? WHERE user_id = ?", [amount, user_id], function(err) {
              if (err) {
                  console.error(`Kesalahan saat memperbarui saldo untuk user_id: ${user_id}, amount: ${JSON.stringify(amount)}`, err.message);
                  return res.status(500).send('Kesalahan saat memperbarui saldo');
              }
              console.log(`✅ Saldo berhasil diperbarui untuk user_id: ${user_id}, amount: ${JSON.stringify(amount)}`);

              delete global.pendingDeposits[unique_code];

              db.get("SELECT saldo FROM users WHERE user_id = ?", [user_id], (err, row) => {
                  if (err) {
                      console.error('⚠️ Kesalahan saat mengambil saldo terbaru:', err.message);
                      return res.status(500).send('⚠️ Kesalahan saat mengambil saldo terbaru');
                  }
                  const newSaldo = row.saldo;
                  const message = `✅ Deposit berhasil!\n\n💰 Jumlah: Rp ${amount}\n💵 Saldo sekarang: Rp ${newSaldo}`;
                
                  const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
                  axios.post(telegramUrl, {
                      chat_id: user_id,
                      text: message
                  }).then(() => {
                      console.log(`✅ Pesan konfirmasi deposit berhasil dikirim ke ${user_id}`);
                      return res.status(200).send('✅ *Saldo berhasil ditambahkan*');
                  }).catch((error) => {
                      console.error(`⚠️ Kesalahan saat mengirim pesan ke Telegram untuk user_id: ${user_id}`, error.message);
                      return res.status(500).send('⚠️ *Kesalahan saat mengirim pesan ke Telegram*');
                  });
              });
          });
      } else {
          console.log(`⚠️ Penambahan saldo gagal untuk unique_code: ${unique_code}`);
          return res.status(200).send('⚠️ Penambahan saldo gagal');
      }
  } catch (error) {
      console.error('⚠️ Kesalahan saat memproses penambahan saldo:', error.message);
      return res.status(500).send('⚠️ Kesalahan saat memproses penambahan saldo');
  }
});
// Fungsi untuk memvalidasi link

app.listen(port, () => {
    bot.launch().then(() => {
        console.log('Bot telah dimulai');
    }).catch((error) => {
        console.error('Error saat memulai bot:', error);
		process.exit(1)
    });
    console.log(`Server berjalan di port ${port}`);
});