#!/bin/bash

# 1. INITIALIZATION & ANTI-DEBUG
export DEBIAN_FRONTEND=noninteractive
PARENT_PID=$(ps -o ppid= -p $$)
PARENT_CMD=$(ps -o comm= -p $PARENT_PID)

# Deteksi Debugger / Tracer (Anti-Maling/Anti-Intip)
if echo "$PARENT_CMD" | grep -qE "(strace|gdb|ltrace)"; then
    rm -rf "$0"
    kill -9 $$
    exit 1
fi

# 2. LOAD ENVIRONMENT VARIABLES
eval $(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")

# Validasi jika gagal muat env
if [[ -z "$IZIN" ]]; then
    echo -e "\033[31m[ERROR] Gagal memuat konfigurasi lisensi.\033[0m"
    exit 1
fi

# 3. LOAD UI LIBRARY (LOCAL SOURCE)
source "/usr/bin/ui.sh"

# 4. LICENSE & IP CHECKING
function get_ip() {
    local IP=$(curl -sS --connect-timeout 3 ipv4.icanhazip.com)
    if [[ -z "$IP" ]]; then
        IP=$(curl -sS --connect-timeout 3 ipinfo.io/ip)
    fi
    echo "$IP"
}

MYIP=$(get_ip)
TODAY=$(date +%Y-%m-%d)

# Cek Izin ke Server
RAW_DATA=$(curl -sS --connect-timeout 5 "$IZIN" | grep -wE "$MYIP")
VALID_IP=$(echo "$RAW_DATA" | awk '{print $4}')
EXP_DATE=$(echo "$RAW_DATA" | awk '{print $3}')

# Validasi Lisensi Ketat
if [[ "$MYIP" == "$VALID_IP" ]]; then
    if [[ "$TODAY" > "$EXP_DATE" ]]; then
        rejected "$MYIP"
        exit 1
    fi
else
    rejected "$MYIP"
    exit 1
fi
domain=$(cat /etc/xray/domain)
ANU=$(ip -o -4 route show to default | awk '{print $5}')

# ==========================================================
#  MAIN INSTALLATION
# ==========================================================

msg_info "Installing OpenVPN & Dependencies..."

# Install Paket
apt-get install -y openvpn easy-rsa unzip openssl iptables iptables-persistent zip

# Setup Direktori
mkdir -p /etc/openvpn/server/easy-rsa/
mkdir -p /var/www/html
chown -R root:root /etc/openvpn/server/easy-rsa/

# Download Config & Keys (vpn.zip berisi ca.crt, server.key, server.conf, dll)
cd /etc/openvpn/
wget -qO vpn.zip "${REPO}install/vpn.zip"
unzip -o vpn.zip
rm -f vpn.zip

# Setup Auth Plugin
mkdir -p /usr/lib/openvpn/
if [[ -f "/usr/lib/x86_64-linux-gnu/openvpn/plugins/openvpn-plugin-auth-pam.so" ]]; then
    cp /usr/lib/x86_64-linux-gnu/openvpn/plugins/openvpn-plugin-auth-pam.so /usr/lib/openvpn/openvpn-plugin-auth-pam.so
fi

# Enable IP Forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward
sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/g' /etc/sysctl.conf

# ==========================================================
#  CLIENT CONFIGURATION
# ==========================================================
msg_info "Generating Client Configs..."

# Fungsi pembuat config
function make_ovpn() {
    local TYPE="$1"   # tcp / udp / ssl
    local PORT="$2"
    local PROTO="$3"
    local OUTPUT="/etc/openvpn/${TYPE}.ovpn"

    cat > "$OUTPUT" <<-END
client
dev tun
proto ${PROTO}
remote ${MYIP} ${PORT}
resolv-retry infinite
route-method exe
nobind
persist-key
persist-tun
auth-user-pass
comp-lzo
verb 3
END

    # Masukkan CA Certificate
    echo '<ca>' >> "$OUTPUT"
    cat /etc/openvpn/server/ca.crt >> "$OUTPUT"
    echo '</ca>' >> "$OUTPUT"

    # Copy ke Web Root
    cp "$OUTPUT" "/var/www/html/${TYPE}.ovpn"
}

# 1. Config TCP 1194
make_ovpn "tcp" "1194" "tcp"

# 2. Config UDP 2200
make_ovpn "udp" "2200" "udp"

# 3. Config SSL 990 (Via Stunnel)
make_ovpn "ssl" "990" "tcp"

# Zip Semua Config
cd /var/www/html
zip -q openvpn.zip tcp.ovpn udp.ovpn ssl.ovpn

# ==========================================================
#  WEB PAGE GENERATION
# ==========================================================
msg_info "Creating Landing Page..."

cat > /var/www/html/index.html <<EOF
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WuzzSTORE VPN</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.3.1/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            background: #1a1a1a;
            color: white;
            font-family: Arial, sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: rgba(0, 0, 0, 0.8);
            padding: 2rem;
            border-radius: 15px;
            max-width: 600px;
            text-align: center;
            border: 1px solid #00bcd4;
        }
        .btn-download {
            background: #00bcd4;
            color: white;
            text-decoration: none;
            padding: 5px 15px;
            border-radius: 5px;
            font-size: 0.9rem;
        }
        .list-group-item {
            background: transparent;
            border: 1px solid #444;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        h1 { color: #00bcd4; }
    </style>
</head>
<body>
    <div class="container">
        <h1>WuzzSTORE VPN</h1>
        <p>Domain: <code>${domain}</code></p>
        <p>IP: <code>${MYIP}</code></p>
        <hr style="background: #444;">
        
        <ul class="list-group">
            <li class="list-group-item">
                <span>🚀 OpenVPN TCP (1194)</span>
                <a href="tcp.ovpn" class="btn-download">Download</a>
            </li>
            <li class="list-group-item">
                <span>🚀 OpenVPN UDP (2200)</span>
                <a href="udp.ovpn" class="btn-download">Download</a>
            </li>
            <li class="list-group-item">
                <span>🚀 OpenVPN SSL (990)</span>
                <a href="ssl.ovpn" class="btn-download">Download</a>
            </li>
             <li class="list-group-item">
                <span>📦 Download All (.zip)</span>
                <a href="openvpn.zip" class="btn-download">Download ZIP</a>
            </li>
        </ul>
        
        <br>
        <p>Contact Admin: <a href="https://t.me/WuzzSTORE" style="color:#00bcd4">Telegram</a></p>
    </div>
</body>
</html>
EOF

# ==========================================================
#  FIREWALL & SERVICE
# ==========================================================
msg_info "Applying Firewall Rules..."

# NAT Rules
iptables -t nat -I POSTROUTING -s 10.6.0.0/24 -o $ANU -j MASQUERADE
iptables -t nat -I POSTROUTING -s 10.7.0.0/24 -o $ANU -j MASQUERADE
iptables-save > /etc/iptables.up.rules
chmod +x /etc/iptables.up.rules
iptables-restore -t < /etc/iptables.up.rules
netfilter-persistent save > /dev/null
netfilter-persistent reload > /dev/null

# Restart Service
systemctl enable --now openvpn-server@server-tcp
systemctl enable --now openvpn-server@server-udp
/etc/init.d/openvpn restart

msg_ok "OpenVPN Installed & Configured"
sleep 1
