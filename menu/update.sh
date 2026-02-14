#!/bin/bash
# ==========================================================
#  WuzzSTORE Menu Updater
#  Optimized & Fast
# ==========================================================

# 1. INITIALIZATION & HEADER
export DEBIAN_FRONTEND=noninteractive

# Load Environment Variables
eval $(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")

# Load UI Library
if [[ -f "/usr/bin/ui.sh" ]]; then
    source "/usr/bin/ui.sh"
else
    # Fallback minimal
    function msg_info() { echo -e " [INFO] $1"; }
    function msg_ok() { echo -e " [OK] $1"; }
    function msg_err() { echo -e " [ERR] $1"; }
    function rejected() { echo -e " [DENIED] IP Unauthorized"; exit 1; }
fi

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
        rejected "$MYIP"
        exit 1
    fi
else
    rejected "$MYIP"
    exit 1
fi

# ==========================================================
#  UPDATE LOGIC
# ==========================================================

clear
lane_atas
tengah "UPDATING MENU & SCRIPTS"
lane_bawah

# 1. Update Dependencies (Hanya jika belum ada)
# ----------------------------------------------------------
msg_info "Checking Dependencies..."

if ! command -v 7z &> /dev/null; then
    apt-get install p7zip-full -y > /dev/null 2>&1
fi

if ! command -v unzip &> /dev/null; then
    apt-get install unzip -y > /dev/null 2>&1
fi

# 2. Download & Extract Menu
# ----------------------------------------------------------
msg_info "Downloading Latest Menu..."

cd /tmp
wget -q "${REPO}menu/menu.zip"
if [[ -f "menu.zip" ]]; then
    # Hapus menu lama untuk mencegah konflik
    rm -rf /tmp/menu
    
    # Extract
    7z x menu.zip -omenu > /dev/null 2>&1
    
    # Pindahkan ke /usr/bin
    msg_info "Installing Menu..."
    chmod +x /tmp/menu/*
    mv /tmp/menu/* /usr/bin/
    
    # Bersihkan sisa
    rm -rf /tmp/menu.zip /tmp/menu
    msg_ok "Menu Updated Successfully"
else
    msg_err "Gagal mendownload menu.zip"
fi

# 3. Update Service & Configs
# ----------------------------------------------------------
msg_info "Updating Configurations..."

# Download Version File
wget -qO /opt/.ver "${REPO}versi"
SERVER_VER=$(cat /opt/.ver)

# Fix Cronjobs (Reset ulang biar rapi)
rm -f /etc/cron.d/xp_otm
rm -f /etc/cron.d/bckp_otm
rm -f /etc/cron.d/logclean
rm -f /etc/cron.d/cpu_otm
rm -f /etc/cron.d/xp_sc

cat > /etc/cron.d/wuzz_cron <<EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Auto Reboot (Jam 00:00)
0 0 * * * root /sbin/reboot

# Auto Backup (Jam 22:00)
0 22 * * * root /usr/bin/backup

# Auto XP (Expired User)
0 0 * * * root /usr/bin/xp
1 0 * * * root /usr/bin/expsc

# Log Cleaner (Tiap 10 menit)
*/10 * * * * root /usr/bin/clearlog

# CPU Optimizer (Tiap 30 menit)
*/30 * * * * root /usr/bin/autocpu
EOF

service cron restart

# 4. Finalization
# ----------------------------------------------------------
msg_info "Sending Notification..."

DOMAIN=$(cat /etc/xray/domain)
USER_SERVER=$(echo "$RAW_DATA" | awk '{print $2}')
TIME=$(date '+%d %b %Y %H:%M:%S')

TEXT="
<code>────────────────────</code>
<b>⚠️ UPDATE NOTIFICATION ⚠️</b>
<code>────────────────────</code>
<code>Status : </code><code>Success</code>
<code>Version: </code><code>$SERVER_VER</code>
<code>User   : </code><code>$USER_SERVER</code>
<code>IP     : </code><code>$MYIP</code>
<code>Domain : </code><code>$DOMAIN</code>
<code>Date   : </code><code>$TIME</code>
<code>────────────────────</code>
"
curl -s -d "chat_id=$CHATID&disable_web_page_preview=1&text=$TEXT&parse_mode=html" \
"https://api.telegram.org/bot$KEY/sendMessage" > /dev/null

clear
lane_atas
tengah "UPDATE COMPLETED" "${GREEN}${BOLD}"
lane_tengah
tengah "Version: $SERVER_VER" "${YELLOW}"
lane_bawah
garis

echo -e ""
sleep 2
menu
