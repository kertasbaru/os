const express = require("express");
const { exec } = require("child_process");
const rateLimit = require("express-rate-limit");
const app = express();
const PORT = 5888;
const SCRIPT_DIR = "/usr/bin/api-serversellvpn";

// Middleware untuk parsing query string
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Rate limiting: maks 30 request per menit per IP
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: "error", message: "Too many requests" },
});
app.use(limiter);

// Sanitasi input: hanya izinkan karakter aman
function sanitizeUsername(val) {
    if (!val) return null;
    const s = String(val).replace(/[^a-zA-Z0-9_\-]/g, "");
    return s.length > 0 ? s : null;
}

function sanitizePassword(val) {
    if (!val) return null;
    const s = String(val).replace(/[^a-zA-Z0-9_\-@#!.]/g, "");
    return s.length > 0 ? s : null;
}

function sanitizeInt(val) {
    if (!val) return null;
    const n = parseInt(String(val).replace(/[^0-9]/g, ""), 10);
    return isNaN(n) ? null : String(n);
}

// Ambil auth key dari header Authorization atau query param
function getAuth(req) {
    const header = req.headers["authorization"];
    if (header && header.startsWith("Bearer ")) {
        return header.slice(7);
    }
    return req.query.auth || req.body.auth;
}

// Fungsi untuk parsing output shell ke JSON
function parseSSHOutput(output) {
    const extract = (pattern) => {
        const match = output.match(pattern);
        return match ? match[1].trim() : "";
    };

    const lines = output.split("\n");
    const extractAll = (pattern) => {
        const results = [];
        for (const line of lines) {
            const m = line.match(pattern);
            if (m) results.push(m[1].trim());
        }
        return results;
    };

    const links = extractAll(/Link (?:TLS|WS|GRPC|NTLS)\s+:\s+(.+)/);

    return {
        username: extract(/Remark\s+:\s+(\S+)/),
        ip_limit: extract(/Limit Ip\s+:\s+(.+)/),
        domain: extract(/Domain\s+:\s+(\S+)/),
        isp: extract(/ISP\s+:\s+(.+)/),
        expired: extract(/Expiry in\s+:\s+(.+)/),
        uuid: extract(/Key\s+:\s+(.+)/),
        quota: extract(/Limit Quota\s+:\s+(.+)/),
        tls_link: links[0] || "",
        nontls_link: links[1] || "",
        grpc_link: links[2] || "",
    };
}

const AUTH_KEY = process.env.AUTH_KEY;

app.all("/createssh", (req, res) => {
    const params = Object.assign({}, req.query, req.body);
    const user = sanitizeUsername(params.user);
    const password = sanitizePassword(params.password);
    const exp = sanitizeInt(params.exp);
    const iplimit = sanitizeInt(params.iplimit);
    const auth = getAuth(req);

    // Validasi autentikasi
    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }


    // Validasi input
    if (!user || !password || !exp || !iplimit) {
        return res.status(400).json({ status: "error", message: "Missing parameters" });
    }

    // Eksekusi skrip shell untuk membuat akun SSH
    exec(`bash ${SCRIPT_DIR}/create_ssh.sh ${user} ${password} ${iplimit} ${exp}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: stderr });
        }

        // Parsing output shell menjadi JSON
        const sshData = parseSSHOutput(stdout);

        res.json({
            status: "success",
            message: `Akun SSH berhasil dibuat untuk ${sshData.username}`,
            data: sshData
        });
    });
});

app.get("/createvmess", (req, res) => {
    const user = sanitizeUsername(req.query.user);
    const exp = sanitizeInt(req.query.exp);
    const iplimit = sanitizeInt(req.query.iplimit);
    const quota = sanitizeInt(req.query.quota);
    const auth = getAuth(req);

    // Validasi autentikasi
    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }


    // Validasi input
    if (!user || !exp || !quota || !iplimit) {
        return res.status(400).json({ status: "error", message: "Missing parameters" });
    }

    // Eksekusi skrip shell untuk membuat akun Vmess
    exec(`bash ${SCRIPT_DIR}/create_vmess.sh ${user} ${exp} ${iplimit} ${quota}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: stderr });
        }

        // Parsing output shell menjadi JSON
        const vmessData = parseSSHOutput(stdout);

        res.json({
            status: "success",
            message: `Akun Vmess berhasil dibuat untuk ${vmessData.username}`,
            data: vmessData
        });
    });
});

app.get("/createvless", (req, res) => {
    const user = sanitizeUsername(req.query.user);
    const exp = sanitizeInt(req.query.exp);
    const iplimit = sanitizeInt(req.query.iplimit);
    const quota = sanitizeInt(req.query.quota);
    const auth = getAuth(req);

    // Validasi autentikasi
    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }


    // Validasi input
    if (!user || !exp || !quota || !iplimit) {
        return res.status(400).json({ status: "error", message: "Missing parameters" });
    }

    // Eksekusi skrip shell untuk membuat akun Vless
    exec(`bash ${SCRIPT_DIR}/create_vless.sh ${user} ${exp} ${iplimit} ${quota}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: stderr });
        }

        // Parsing output shell menjadi JSON
        const vlessData = parseSSHOutput(stdout);

        res.json({
            status: "success",
            message: `Akun Vless berhasil dibuat untuk ${vlessData.username}`,
            data: vlessData
        });
    });
});

app.get("/createtrojan", (req, res) => {
    const user = sanitizeUsername(req.query.user);
    const exp = sanitizeInt(req.query.exp);
    const iplimit = sanitizeInt(req.query.iplimit);
    const quota = sanitizeInt(req.query.quota);
    const auth = getAuth(req);

    // Validasi autentikasi
    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }


    // Validasi input
    if (!user || !exp || !quota || !iplimit) {
        return res.status(400).json({ status: "error", message: "Missing parameters" });
    }

    // Eksekusi skrip shell untuk membuat akun Trojan
    exec(`bash ${SCRIPT_DIR}/create_trojan.sh ${user} ${exp} ${iplimit} ${quota}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: stderr });
        }

        // Parsing output shell menjadi JSON
        const trojanData = parseSSHOutput(stdout);

        res.json({
            status: "success",
            message: `Akun Trojan berhasil dibuat untuk ${trojanData.username}`,
            data: trojanData
        });
    });
});

app.get("/trialssh", (req, res) => {
	const auth = getAuth(req);
    // Validasi autentikasi
    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }

    // Eksekusi skrip shell untuk membuat akun Trial SSH
    exec(`bash ${SCRIPT_DIR}/trial_ssh.sh`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: stderr });
        }

        // Parsing output shell menjadi JSON
        const sshData = parseSSHOutput(stdout);

        res.json({
            status: "success",
            message: `Akun Trial SSH berhasil dibuat untuk ${sshData.username}`,
            data: sshData
        });
    });
});

app.get("/trialvmess", (req, res) => {
	const auth = getAuth(req);
    // Validasi autentikasi
    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }

    // Eksekusi skrip shell untuk membuat akun Trial Vmess
    exec(`bash ${SCRIPT_DIR}/trial_vmess.sh`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: stderr });
        }

        // Parsing output shell menjadi JSON
        const vmessData = parseSSHOutput(stdout);

        res.json({
            status: "success",
            message: `Akun Trial Vmess berhasil dibuat untuk ${vmessData.username}`,
            data: vmessData
        });
    });
});

app.get("/trialvless", (req, res) => {
	const auth = getAuth(req);
    // Validasi autentikasi
    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }

    // Eksekusi skrip shell untuk membuat akun Trial Vless
    exec(`bash ${SCRIPT_DIR}/trial_vless.sh`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: stderr });
        }

        // Parsing output shell menjadi JSON
        const vlessData = parseSSHOutput(stdout);

        res.json({
            status: "success",
            message: `Akun Trial Vless berhasil dibuat untuk ${vlessData.username}`,
            data: vlessData
        });
    });
});

app.get("/trialtrojan", (req, res) => {
	const auth = getAuth(req);
    // Validasi autentikasi
    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }

    // Eksekusi skrip shell untuk membuat akun Trial Trojan
    exec(`bash ${SCRIPT_DIR}/trial_trojan.sh`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: stderr });
        }

        // Parsing output shell menjadi JSON
        const trojanData = parseSSHOutput(stdout);

        res.json({
            status: "success",
            message: `Akun Trial Trojan berhasil dibuat untuk ${trojanData.username}`,
            data: trojanData
        });
    });
});

app.get("/renewssh", (req, res) => {
    const user = sanitizeUsername(req.query.user);
    const exp = sanitizeInt(req.query.exp);
    const iplimit = sanitizeInt(req.query.iplimit);
    const auth = getAuth(req);

    // Validasi autentikasi
    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }


    // Validasi input
    if (!user || !exp || !iplimit) {
        return res.status(400).json({ status: "error", message: "Missing parameters" });
    }

    // Eksekusi skrip shell untuk renew akun SSH
    exec(`bash ${SCRIPT_DIR}/renew_ssh.sh ${user} ${iplimit} ${exp}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: "Gagal memperbarui akun SSH. Pastikan user masih ada." });
        }

        // Parsing output shell menjadi JSON
        const sshData = parseSSHOutput(stdout);

        res.json({
            status: "success",
            message: `Renew SSH berhasil untuk ${sshData.username}`,
            data: sshData
        });
    });
});

app.get("/renewvmess", (req, res) => {
    const user = sanitizeUsername(req.query.user);
    const exp = sanitizeInt(req.query.exp);
    const iplimit = sanitizeInt(req.query.iplimit);
    const quota = sanitizeInt(req.query.quota);
    const auth = getAuth(req);

    // Validasi autentikasi
    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }


    // Validasi input
    if (!user || !exp || !iplimit || !quota) {
        return res.status(400).json({ status: "error", message: "Missing parameters" });
    }

    // Eksekusi skrip shell untuk renew akun Vmess
    exec(`bash ${SCRIPT_DIR}/renew_vmess.sh ${user} ${exp} ${iplimit} ${quota}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: "Gagal memperbarui akun VMESS. Pastikan user masih ada." });
        }

        // Parsing output shell menjadi JSON
        const vmessData = parseSSHOutput(stdout);

        res.json({
            status: "success",
            message: `Renew Vmess berhasil untuk ${vmessData.username}`,
            data: vmessData
        });
    });
});

app.get("/renewvless", (req, res) => {
    const user = sanitizeUsername(req.query.user);
    const exp = sanitizeInt(req.query.exp);
    const iplimit = sanitizeInt(req.query.iplimit);
    const quota = sanitizeInt(req.query.quota);
    const auth = getAuth(req);

    // Validasi autentikasi
    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }


    // Validasi input
    if (!user || !exp || !iplimit || !quota) {
        return res.status(400).json({ status: "error", message: "Missing parameters" });
    }

    // Eksekusi skrip shell untuk renew akun Vless
    exec(`bash ${SCRIPT_DIR}/renew_vless.sh ${user} ${exp} ${iplimit} ${quota}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: "Gagal memperbarui akun VLESS. Pastikan user masih ada." });
        }

        // Parsing output shell menjadi JSON
        const vlessData = parseSSHOutput(stdout);

        res.json({
            status: "success",
            message: `Renew Vless berhasil untuk ${vlessData.username}`,
            data: vlessData
        });
    });
});

app.get("/renewtrojan", (req, res) => {
    const user = sanitizeUsername(req.query.user);
    const exp = sanitizeInt(req.query.exp);
    const iplimit = sanitizeInt(req.query.iplimit);
    const quota = sanitizeInt(req.query.quota);
    const auth = getAuth(req);

    // Validasi autentikasi
    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }


    // Validasi input
    if (!user || !exp || !iplimit || !quota) {
        return res.status(400).json({ status: "error", message: "Missing parameters" });
    }

    // Eksekusi skrip shell untuk renew akun Trojan
    exec(`bash ${SCRIPT_DIR}/renew_trojan.sh ${user} ${exp} ${iplimit} ${quota}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: "Gagal memperbarui akun TROJAN. Pastikan user masih ada." });
        }

        // Parsing output shell menjadi JSON
        const trojanData = parseSSHOutput(stdout);

        res.json({
            status: "success",
            message: `Renew Trojan berhasil untuk ${trojanData.username}`,
            data: trojanData
        });
    });
});

app.get("/deletessh", (req, res) => {
    const user = sanitizeUsername(req.query.user);
    const auth = getAuth(req);

    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }

    if (!user) {
        return res.status(400).json({ status: "error", message: "Missing username" });
    }

    exec(`bash ${SCRIPT_DIR}/delete_ssh.sh ${user}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: stderr });
        }

        res.json({ status: "success", message: `Akun SSH ${user} berhasil dihapus` });
    });
});

app.get("/deletevmess", (req, res) => {
    const user = sanitizeUsername(req.query.user);
    const auth = getAuth(req);

    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }

    if (!user) {
        return res.status(400).json({ status: "error", message: "Missing username" });
    }

    exec(`bash ${SCRIPT_DIR}/delete_vmess.sh ${user}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: stderr });
        }

        res.json({ status: "success", message: `Akun Vmess ${user} berhasil dihapus` });
    });
});

app.get("/deletevless", (req, res) => {
    const user = sanitizeUsername(req.query.user);
    const auth = getAuth(req);

    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }

    if (!user) {
        return res.status(400).json({ status: "error", message: "Missing username" });
    }

    exec(`bash ${SCRIPT_DIR}/delete_vless.sh ${user}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: stderr });
        }

        res.json({ status: "success", message: `Akun Vless ${user} berhasil dihapus` });
    });
});

app.get("/deletetrojan", (req, res) => {
    const user = sanitizeUsername(req.query.user);
    const auth = getAuth(req);

    if (!AUTH_KEY) {
        return res.status(500).json({ status: "error", message: "AUTH_KEY not set" });
    }

    if (auth !== AUTH_KEY) {
        return res.status(403).json({ status: "error", message: "Unauthorized" });
    }

    if (!user) {
        return res.status(400).json({ status: "error", message: "Missing username" });
    }

    exec(`bash ${SCRIPT_DIR}/delete_trojan.sh ${user}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ status: "error", message: stderr });
        }

        res.json({ status: "success", message: `Akun Trojan ${user} berhasil dihapus` });
    });
});

// Menjalankan server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server berjalan di port ${PORT}`);
});
