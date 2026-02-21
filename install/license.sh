apt upgrade -y
apt install -y sudo wget curl
gem install lolcat

TIME=$(date '+%d %b %Y')
IP_FILE="/usr/bin/.ipvps"
MYIP=$(curl -sL ip.dekaa.my.id)
eval $(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")
echo "$MYIP" > "$IP_FILE"

wget -qO /usr/local/bin/ui.sh "${REPO}install/ui.sh"
sudo chmod +x /usr/local/bin/ui.sh
source /usr/local/bin/ui.sh

# --- FUNGSI KEAMANAN / ANTI-TAMPER ---
function self_destruct() {
	lane_atas
	tengah "PELANGGARAN LISENSI TERDETEKSI" "${BRED}${WHITE}${BOLD}" 1
	lane_bawah
	lane_atas
	tengah "LISENSI TERLINDUNGI" "${YELLOW}" 4
	echo -e " \033[92;1m📞 Contact Admin:\033[0m"
  echo -e " \033[96m🌍 Telegram: https://t.me/WuzzSTORE\033[0m"
  echo -e " \033[96m📱 WhatsApp: https://wa.me/6287760204418\033[0m"
	lane_bawah
	
	rm -f "$0"
	rm -f /usr/local/bin/ui.sh
  sleep 30
	exit 192
}

# Cek apakah skrip dijalankan via debugger
PARENT_PID=$(ps -o ppid= -p $$)
PARENT_CMD=$(ps -o comm= -p $PARENT_PID)
if echo "$PARENT_CMD" | grep -qE "(strace|gdb)"; then
	self_destruct
fi

# Cek apakah skrip dijalankan dengan nama file sementara yang mencurigakan
if [[ "$0" == *".temp1.sh" ]]; then
  self_destruct
fi

# Cek apakah nama file diubah
SCRIPT_NAME=$(basename "$0")
if [[ "$SCRIPT_NAME" != "Install.sh" ]]; then
  self_destruct
fi