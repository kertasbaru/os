#!/bin/bash
# ==========================================================
#  WuzzSTORE WebSocket Installer
#  Protected & Licensed Module
# ==========================================================

# 1. INITIALIZATION & ANTI-DEBUG
export DEBIAN_FRONTEND=noninteractive
PARENT_PID=$(ps -o ppid= -p $$)
PARENT_CMD=$(ps -o comm= -p $PARENT_PID)

# Deteksi Debugger
if echo "$PARENT_CMD" | grep -qE "(strace|gdb|ltrace)"; then
    rm -rf "$0"
    kill -9 $$
    exit 1
fi

# 2. LOAD ENVIRONMENT VARIABLES
eval $(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")

# Validasi Env
if [[ -z "$REPO" || -z "$IZIN" ]]; then
    echo "CRITICAL ERROR: Environment Variables gagal dimuat."
    exit 1
fi

# 3. LOAD UI LIBRARY
source "/usr/bin/ui.sh"

# 4. LICENSE & IP CHECKING
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
        rejected "$MYIP"
        exit 1
    fi
else
    rejected "$MYIP"
    exit 1
fi

#  MAIN INSTALLER START

msg_info "Installing WebSocket Python/Go Service..."

# 1. Setup Response File
# ----------------------------------------------------------
FILE_PATH="/etc/handeling"
if [[ ! -s "$FILE_PATH" ]]; then
    # Jika file tidak ada atau kosong, buat baru
    echo -e "WUZZSTORE Connected\nGreen" > "$FILE_PATH"
fi

# 2. Download Binaries & Config
# ----------------------------------------------------------
# Pastikan wget menimpa file lama (-O)
wget -qO /usr/bin/ws "${REPO}sshws/ws"
wget -qO /usr/bin/config.conf "${REPO}sshws/config.conf"

# Berikan izin eksekusi
chmod +x /usr/bin/ws
chmod 644 /usr/bin/config.conf

# 3. Setup Systemd Service
# ----------------------------------------------------------
cat > /etc/systemd/system/ws.service << END
[Unit]
Description=WebSocket E-Pro V1 By WuzzSTORE
Documentation=https://t.me/WuzzSTORE
After=syslog.target network-online.target

[Service]
User=root
NoNewPrivileges=true
ExecStart=/usr/bin/ws -f /usr/bin/config.conf
Restart=always
RestartSec=3
LimitNPROC=65535
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
END

# 4. Enable & Start Service
# ----------------------------------------------------------
systemctl daemon-reload
systemctl enable --now ws.service

msg_ok "WebSocket Service Installed & Started"
sleep 1
