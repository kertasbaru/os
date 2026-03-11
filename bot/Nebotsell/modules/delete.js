// modules/delete.js
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const db = new sqlite3.Database('./sellvpn.db');

const deleteEndpointMap = {
  ssh: 'deletessh',
  vmess: 'deletevmess',
  vless: 'deletevless',
  trojan: 'deletetrojan'
};



async function hapusAkun(userAccountId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM user_accounts WHERE id = ?', [userAccountId], async (err, account) => {
      if (err || !account) return reject('❌ Akun tidak ditemukan.');

      const { user_id, username, jenis, server_id, price, expired } = account;

      db.get('SELECT domain, auth FROM Server WHERE id = ?', [server_id], async (err2, server) => {
        if (err2 || !server) return reject('❌ Server tidak ditemukan.');

        const endpoint = deleteEndpointMap[jenis];
        if (!endpoint) return reject('❌ Jenis akun tidak valid untuk penghapusan.');

        const apiURL = `http://${server.domain}:5888/${endpoint}?user=${username}&auth=${server.auth}`;
		console.log('🛠️ DEBUG INFO:');
		console.log(`- Jenis akun   : ${jenis}`);
		console.log(`- Username     : ${username}`);
		console.log(`- Server domain: ${server.domain}`);
		console.log(`- Endpoint     : ${endpoint}`);
		console.log(`- Full URL     : ${apiURL}`);

        try {
          const response = await axios.get(apiURL);

          if (response.data.status !== 'success') {
            return reject(`❌ Gagal menghapus akun di server: ${response.data.message}`);
          }

			const expiredDate = dayjs(expired);
			const now = dayjs();
			let sisaHari = Math.ceil(expiredDate.diff(now, 'millisecond') / (1000 * 60 * 60 * 24));
			if (sisaHari < 0) sisaHari = 0;


          const refund = price * sisaHari;

			db.run('DELETE FROM user_accounts WHERE id = ?', [userAccountId], (err3) => {
			  if (err3) return reject('❌ Gagal menghapus akun dari database.');

			  db.run('UPDATE users SET saldo = saldo + ? WHERE user_id = ?', [refund, user_id], function (err4) {
				if (err4) {
				  console.log("SQL ERROR saldo update", err4);
				  return reject('❌ Gagal mengembalikan saldo pengguna.');
				}

				// setelah update, ambil saldo saat ini
				db.get('SELECT saldo FROM users WHERE user_id = ?', [user_id], (err5, row) => {
				  if (err5) {
					console.log("SQL ERROR saldo select", err5);
					return reject('❌ Gagal membaca saldo pengguna setelah refund.');
				  }

				  if (!row) {
					console.log(`DEBUG saldo select: tidak menemukan user dengan user_id=${user_id}`);
					return reject('❌ Tidak menemukan user di database setelah update saldo.');
				  }

				  const currentSaldo = row.saldo;
				  resolve(`✅ Akun ${jenis.toUpperCase()} berhasil dihapus.
			🕒 Sisa hari: ${sisaHari}
			💰 Saldo dikembalikan: Rp${refund.toLocaleString('id-ID')}
			💳 Saldo sekarang: Rp${Number(currentSaldo).toLocaleString('id-ID')}`);
				});
			  });
			});


        } catch (error) {
          reject(`❌ Gagal terhubung ke API server: ${error.message}`);
        }
      });
    });
  });
}

module.exports = {
  hapusAkun
};
