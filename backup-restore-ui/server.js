const express = require('express');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const session = require('express-session');
const { exec, spawn } = require('child_process');
const axios = require('axios');
const ping = require('ping');
const parseIPData = require('./utils/ipParser');

dotenv.config();
const app = express();
const PORT = 3000;

app.use(session({
  secret: 'ganti_secret_key_ini_restore_backup',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 10 * 60 * 1000 }
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/views', express.static('views'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const upload = multer({ dest: 'uploads/' });

// Middleware proteksi login restore
function requireRestoreLogin(req, res, next) {
  if (req.session.restoreLoggedIn) return next();
  return res.redirect('/restore/login');
}

// Middleware proteksi login backup
function requireBackupLogin(req, res, next) {
  if (req.session.backupLoggedIn) return next();
  return res.redirect('/backup/login');
}

app.get('/restore/login', (req, res) => {
  res.render('login_restore', { error: null });
});

app.post('/restore/login', (req, res) => {
  const { password } = req.body;
  console.log(`[RESTORE LOGIN] Percobaan login dengan password: ${password}`);
  if (!password) return res.render('login_restore', { error: 'Password tidak boleh kosong!' });

  const escapedPassword = password.replace(/'/g, `'\\''`);
  const cmd = `sshpass -p '${escapedPassword}' ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no -o ConnectTimeout=3 root@localhost 'echo login_success'`;

  exec(cmd, (err, stdout) => {
    if (err || !stdout.includes('login_success')) {
      console.log(`[RESTORE LOGIN] Gagal login: ${err?.message || 'Password salah'}`);
      return res.render('login_restore', { error: 'Password salah, coba lagi!' });
    }
    console.log(`[RESTORE LOGIN] Berhasil login`);
    req.session.restoreLoggedIn = true;
    res.redirect('/restore/upload');
  });
});

app.get('/restore/logout', (req, res) => {
  req.session.restoreLoggedIn = false;
  console.log(`[RESTORE LOGOUT] Sesi restore logout`);
  res.redirect('/restore/login');
});

app.get('/backup/login', (req, res) => {
  res.render('login_backup', { error: null });
});

app.post('/backup/login', (req, res) => {
  const { password } = req.body;
  console.log(`[BACKUP LOGIN] Percobaan login dengan password: ${password}`);
  if (!password) return res.render('login_backup', { error: 'Password tidak boleh kosong!' });

  const escapedPassword = password.replace(/'/g, `'\\''`);
  const cmd = `sshpass -p '${escapedPassword}' ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no -o ConnectTimeout=3 root@localhost 'echo login_success'`;

  exec(cmd, (err, stdout) => {
    if (err || !stdout.includes('login_success')) {
      console.log(`[BACKUP LOGIN] Gagal login: ${err?.message || 'Password salah'}`);
      return res.render('login_backup', { error: 'Password salah, coba lagi!' });
    }
    console.log(`[BACKUP LOGIN] Berhasil login`);
    req.session.backupLoggedIn = true;
    res.redirect('/backup');
  });
});

app.get('/backup/logout', (req, res) => {
  req.session.backupLoggedIn = false;
  console.log(`[BACKUP LOGOUT] Sesi backup logout`);
  res.redirect('/backup/login');
});

app.get('/restore/upload', requireRestoreLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'upload.html'));
});

app.post('/restore/upload', requireRestoreLogin, upload.single('backup'), (req, res) => {
  const tempPath = req.file.path;
  const targetPath = '/root/backup.zip';
  const zipPassword = req.body.zipPassword || '';
  console.log(`[RESTORE UPLOAD] File diterima: ${req.file.originalname}, password ZIP: ${zipPassword}`);

  fs.rename(tempPath, targetPath, err => {
    if (err) {
      console.log(`[RESTORE UPLOAD] Gagal rename file: ${err.message}`);
      return res.render('restore-result', {
        success: false,
        message: 'Gagal memindahkan file backup.'
      });
    }

    console.log(`[RESTORE EXEC] Menjalankan restore: /usr/bin/restore '${zipPassword}'`);
    exec(`/usr/bin/restore '${zipPassword}' > /tmp/restore.log 2>&1`, (error) => {
      if (error) {
        console.log(`[RESTORE EXEC] Gagal restore: ${error.message}`);
        return res.render('restore-result', {
          success: false,
          message: 'Terjadi kesalahan saat proses restore. Pastikan password ZIP benar dan file valid.'
        });
      }

      console.log(`[RESTORE EXEC] Restore berhasil`);
      return res.render('restore-result', {
        success: true,
        message: 'Backup berhasil di-restore ke sistem.'
      });
    });
  });
});

app.get('/backup', requireBackupLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'backup.html'));
});

app.post('/backup', requireBackupLogin, (req, res) => {
  const password = req.body.zipPassword || '';
  const args = ['--auto'];
  if (password) args.push(`--password=${password}`);
  console.log(`[BACKUP] Menjalankan backup dengan argumen: ${args.join(' ')}`);

  const backupProcess = spawn('/usr/bin/backup', args);
  let stdout = '', stderr = '';

  backupProcess.stdout.on('data', data => {
    const log = data.toString();
    stdout += log;
    console.log(`[BACKUP STDOUT] ${log.trim()}`);
  });

  backupProcess.stderr.on('data', data => {
    const log = data.toString();
    stderr += log;
    console.log(`[BACKUP STDERR] ${log.trim()}`);
  });

  backupProcess.on('close', (code) => {
    console.log(`[BACKUP] Proses selesai dengan kode: ${code}`);
    if (code !== 0) {
      return res.render('backup-result', {
        success: false,
        message: `Gagal menjalankan proses backup. Error: ${stderr}`
      });
    }

    const passFile = '/root/backup_password.txt';
    if (!fs.existsSync(passFile)) {
      console.log(`[BACKUP] File password tidak ditemukan: ${passFile}`);
      return res.render('backup-result', {
        success: false,
        message: 'Backup selesai, tapi file password tidak ditemukan.'
      });
    }

    const content = fs.readFileSync(passFile, 'utf8').trim();
    const [backup_pw, backup_id] = content.split(':');
    console.log(`[BACKUP] Backup ID: ${backup_id}, Password: ${backup_pw}`);

    res.render('backup-result', {
      success: true,
      message: 'Backup berhasil dibuat.',
      id: backup_id,
      password: backup_pw
    });
  });
});

app.get('/backup/download', requireBackupLogin, (req, res) => {
  const filePath = path.join(__dirname, 'temp', 'backup.zip');
  if (fs.existsSync(filePath)) {
    console.log(`[BACKUP DOWNLOAD] Mengunduh file backup.zip`);
    res.download(filePath, 'backup.zip', err => {
      if (!err) {
        console.log(`[BACKUP DOWNLOAD] File backup.zip berhasil dikirim dan dihapus`);
        fs.unlinkSync(filePath);
      } else {
        console.log(`[BACKUP DOWNLOAD] Gagal mengirim file: ${err.message}`);
      }
    });
  } else {
    console.log(`[BACKUP DOWNLOAD] File backup.zip tidak ditemukan`);
    res.status(404).send('File backup.zip tidak ditemukan.');
  }
});

app.get('/status-vps', async (req, res) => {
  console.log(`[STATUS VPS] Mengambil data IP izin...`);
  try {
    const response = await axios.get('https://raw.githubusercontent.com/kertasbaru/izin/main/ip');
    const rawText = response.data;
    const groups = parseIPData(rawText);

    const pingPromises = [];
    for (const group of groups) {
      for (const entry of group.entries) {
        const ip = entry.ip;
        if (!ip) continue;
        pingPromises.push(
          ping.promise.probe(ip, { timeout: 2 }).then(result => {
            entry.status = result.alive ? 'ONLINE' : 'OFFLINE';
            entry.pingMs = result.alive && result.time ? parseFloat(result.time).toFixed(1) : '-';
            console.log(`[PING] ${ip} - ${entry.status} (${entry.pingMs} ms)`);
          })
        );
      }
    }

    await Promise.all(pingPromises);
    res.render('status-vps', { groups });
  } catch (err) {
    console.log(`[STATUS VPS] Gagal mengambil data izin: ${err.message}`);
    res.status(500).send('Gagal mengambil atau memproses data izin.');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
