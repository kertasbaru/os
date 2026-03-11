const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// 🔧 Ambil konfigurasi dari .vars.json
const vars = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), '.vars.json'), 'utf-8'));

let qris, receiptGen, checker;
let inited = false;

// helper import file ESM lewat absolute path
async function importFile(absPath) {
  return await import(pathToFileURL(absPath).href);
}

// 🧠 Fungsi init: import modul ESM secara dinamis
async function initQris() {
  if (inited) return;

  // 1) Import root package (sesuai exports)
  const pkg = await import('autoft-qris');

  // ambil QRISGenerator dari export yg tersedia
  const QRISGenerator =
    pkg.QRISGenerator ||
    pkg.default?.QRISGenerator;

  if (!QRISGenerator) {
    throw new Error('QRISGenerator tidak ditemukan dari package "autoft-qris".');
  }

  // 2) Cari folder src package secara aman (tanpa hardcode ./node_modules)
  // require.resolve('autoft-qris') -> .../node_modules/autoft-qris/src/index.cjs
  const entryCjs = require.resolve('autoft-qris');
  const srcDir = path.dirname(entryCjs); // .../autoft-qris/src

  // 3) Import ReceiptGenerator + PaymentChecker dari file fisik .mjs (ESM)
  const receiptPath = path.join(srcDir, 'receipt-generator.mjs');
  const checkerPath = path.join(srcDir, 'payment-checker.mjs');

  const receiptMod = await importFile(receiptPath);
  const checkerMod = await importFile(checkerPath);

  const ReceiptGenerator = receiptMod.default || receiptMod.ReceiptGenerator;
  const PaymentChecker = checkerMod.default || checkerMod.PaymentChecker;

  if (!ReceiptGenerator) {
    throw new Error(`ReceiptGenerator tidak ditemukan di ${receiptPath}`);
  }
  if (!PaymentChecker) {
    throw new Error(`PaymentChecker tidak ditemukan di ${checkerPath}`);
  }

  // 🖼️ Inisialisasi generator QRIS (langsung pakai theme2)
  qris = new QRISGenerator(
    {
      storeName: vars.NAMA_STORE || 'NEWBIE-STORE',
      auth_username: vars.OKE_USERNAME || 'awanwengi64',
      auth_token: vars.OKE_API_KEY || '2270392:iSFulARp6UkjnwqP5LYQ3VD1Ws7hdvI2',
      baseQrString: vars.BASE_QR_STRING || '',
      logoPath: path.resolve(process.cwd(), 'qris.png'),
    },
    'theme2'
  );

  // 🧾 Inisialisasi Receipt Generator dan Payment Checker
  receiptGen = new ReceiptGenerator({
    storeName: vars.NAMA_STORE || 'NEWBIE-STORE',
    logoPath: path.resolve(process.cwd(), 'qris.png'),
  });

  checker = new PaymentChecker({
    auth_username: vars.OKE_USERNAME || 'awanwengi64',
    auth_token: vars.OKE_API_KEY || '2270392:iSFulARp6UkjnwqP5LYQ3VD1Ws7hdvI2',
  });

  // Wrapper generate QR
  qris.generateQR = async (nominal) => {
    console.log('⚙️ generateQR dipanggil (wrapper):', nominal);
    const qrString = qris.generateQrString(nominal);
    return await qris.generateQRWithLogo(qrString); // Buffer
  };

  // Wrapper checkPayment
  qris.checkPayment = async (reference, amount) => {
    console.log('🔍 [CHECK PAYMENT]');
    console.log(`   ↳ Reference : ${reference}`);
    console.log(`   ↳ Nominal   : Rp${amount.toLocaleString('id-ID')}`);
    console.log('──────────────────────────────────────────────');

    try {
      const result = await checker.checkPaymentStatus(reference, amount);
      const resData = result?.data || {};

      console.log('📦 Hasil dari PaymentChecker:');
      if (result.success) {
        if (resData.status === 'PAID') {
          console.log(`✅ Pembayaran DITEMUKAN`);
          console.log(`   ├─ Nominal   : Rp${resData.amount?.toLocaleString('id-ID') || '-'}`);
          console.log(`   ├─ Referensi : ${resData.reference || reference}`);
          console.log(`   ├─ Tanggal   : ${resData.date || '-'}`);
          console.log(`   ├─ Brand     : ${resData.brand_name || '-'}`);
          console.log(`   └─ Status    : PAID`);
        } else if (resData.status === 'UNPAID') {
          console.log(`⚠️  Pembayaran BELUM MASUK`);
          console.log(`   ├─ Nominal   : Rp${resData.amount?.toLocaleString('id-ID') || '-'}`);
          console.log(`   ├─ Referensi : ${resData.reference || reference}`);
          console.log(`   └─ Status    : UNPAID`);
        } else {
          console.log(`❔ Status tidak diketahui`);
          console.log(`   └─ Data mentah:`, JSON.stringify(resData, null, 2));
        }
      } else {
        console.log('❌ Gagal mendapatkan hasil dari API');
        console.log(`   └─ Error: ${result.error || '(tidak ada pesan kesalahan)'}`);
      }

      console.log('──────────────────────────────────────────────\n');
      return { success: true, result };
    } catch (err) {
      console.error('💥 Terjadi kesalahan saat memeriksa pembayaran!');
      console.error(`   ↳ ${err.message}`);
      if (err.response?.data) {
        console.error('   ↳ Detail error:', JSON.stringify(err.response.data, null, 2));
      }
      console.log('──────────────────────────────────────────────\n');
      return { success: false, message: err.message };
    }
  };

  // Wrapper generate receipt
  qris.generateReceipt = async (data) => {
    try {
      console.log('🧾 Generate struk pembayaran...');
      const buffer = await receiptGen.generateReceiptPDF(data);
      console.log('✅ Struk berhasil digenerate untuk referensi:', data.reference || '-');
      return { success: true, buffer };
    } catch (err) {
      console.error('❌ Gagal generate receipt:', err.message);
      return { success: false, message: err.message };
    }
  };

  inited = true;
}

// 🚀 Export agar aman digunakan app utama
module.exports = {
  generateQR: async (nominal) => {
    await initQris();
    return await qris.generateQR(nominal);
  },

  checkPaymentByAmount: async (reference, amount) => {
    await initQris();
    const result = await qris.checkPayment(reference, amount);
    return result.result || result;
  },

  generateReceiptPDF: async (data) => {
    await initQris();
    return await qris.generateReceipt(data);
  },

  setTheme: async (theme) => {
    await initQris();
    qris.setTheme(theme);
  },

  getAvailableThemes: async () => {
    await initQris();
    return qris.constructor.getAvailableThemes();
  },
};
