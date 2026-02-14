#!/bin/bash

# 1. INITIALIZATION & HEADER
export DEBIAN_FRONTEND=noninteractive

# Load Environment Variables
eval $(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")

# Load UI Library (Dengan Fallback agar Anti-Error)
source "/usr/bin/ui.sh"

# 2. LICENSE CHECKING
function get_ip() {
    local IP=$(curl -sS ipv4.icanhazip.com)
    [[ -z "$IP" ]] && IP=$(curl -sS ipinfo.io/ip)
    echo "$IP"
}

MYIP=$(get_ip)
TODAY=$(date +%Y-%m-%d)

# Cek Izin
RAW_DATA=$(curl -sS "$IZIN" | grep -wE "$MYIP")
VALID_IP=$(echo "$RAW_DATA" | awk '{print $4}')
EXP_DATE=$(echo "$RAW_DATA" | awk '{print $3}')

if [[ "$MYIP" == "$VALID_IP" ]]; then
    if [[ "$TODAY" > "$EXP_DATE" ]]; then
        rejected "$MYIP" # Expired
        exit 1
    fi
else
    rejected "$MYIP" # IP Tidak Terdaftar
    exit 1
fi

# ==========================================================
#  MAIN LOGIC
# ==========================================================

msg_info "Installing UDP Custom..."
mkdir -p /etc/udp
ln -fs /usr/share/zoneinfo/Asia/Jakarta /etc/localtime

# 1. Download Binary UDP Custom
msg_info "Downloading Binary..."

# Menggunakan URL GitHub Raw yang kamu berikan
wget -qO /etc/udp/udp-custom "https://raw.githubusercontent.com/firewallfalcons/FirewallFalcon-Manager/main/udp/udp-custom-linux-amd64"
chmod +x /etc/udp/udp-custom

# 2. Download/Create Config Default
msg_info "Creating Configuration..."

cat > /etc/udp/config.json <<EOF
{
  "listen": ":36712",
  "stream_buffer": 33554432,
  "receive_buffer": 83886080,
  "auth": {
    "mode": "passwords"
  }
}
EOF
chmod 644 /etc/udp/config.json

# 3. Setup Systemd Service
EXCLUDE_CMD=""
if [[ -n "$1" ]]; then
    EXCLUDE_CMD="-exclude $1"
fi

cat > /etc/systemd/system/udp-custom.service <<EOF
[Unit]
Description=UDP Custom by WuzzSTORE
After=network.target

[Service]
User=root
Type=simple
# Pastikan path binary dan config sesuai folder /etc/udp
ExecStart=/etc/udp/udp-custom server ${EXCLUDE_CMD}
WorkingDirectory=/etc/udp/
Restart=always
RestartSec=2s

[Install]
WantedBy=default.target
EOF

# 4. Enable Service
systemctl daemon-reload
systemctl enable --now udp-custom

msg_ok "UDP Custom Installed & Started"

if [[ -n "$1" ]]; then
    msg_info "Excluded Ports: $1"
fi
sleep 1
