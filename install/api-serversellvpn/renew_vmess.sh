#!/bin/bash
user=$1
masaaktif=$2
iplimit=$3
Quota=$4

IP=$(curl -sS ipv4.icanhazip.com)
data_server=$(curl -v --insecure --silent https://google.com/ 2>&1 | grep Date | sed -e 's/< Date: //')
date_list=$(date +"%Y-%m-%d" -d "$data_server")
data_ip="https://raw.githubusercontent.com/kertasbaru/izin/main/ip"
checking_sc() {
  useexp=$(wget -qO- $data_ip | grep $IP | awk '{print $3}')

  if [[ "$useexp" == "Lifetime" ]]; then
    # Jika useexp adalah "Lifetime", anggap tetap aktif

    return
  fi
  date_list_epoch=$(date -d "$date_list" +%s)
  useexp_epoch=$(date -d "$useexp" +%s 2>/dev/null)

  if [[ $? -ne 0 || $date_list_epoch -gt $useexp_epoch ]]; then
    # Tanggal sekarang lebih besar dari tanggal expired, atau format salah
    echo -e "────────────────────────────────────────────"
    echo -e "          404 NOT FOUND AUTOSCRIPT          "
    echo -e "────────────────────────────────────────────"
    echo -e ""
    echo -e "            PERMISSION DENIED !"
    echo -e "   Your VPS $IP Has been Banned"
    echo -e "     Buy access permissions for scripts"
    echo -e "             Contact Admin :"
    echo -e "      WhatsApp wa.me/6282326322300"
    echo -e "────────────────────────────────────────────"
    exit 1
  fi
}

	if ! grep -qwE "^### $user" /etc/xray/config.json; then
    echo -e "User $user Tidak Ditemukan!!"
    exit 1
	else
exp=$(grep -wE "^### $user" "/etc/xray/config.json" | cut -d ' ' -f 3 | sort | uniq)
    mkdir -p /etc/kyt/limit/vmess/ip
echo ${iplimit} >> /etc/kyt/limit/vmess/ip/${user}
if [ ! -e /etc/vmess/ ]; then
  mkdir -p /etc/vmess/
fi

if [ -z ${Quota} ]; then
  Quota="0"
fi

c=$(echo "${Quota}" | sed 's/[^0-9]*//g')
d=$((${c} * 1024 * 1024 * 1024))

if [[ ${c} != "0" ]]; then
  echo "${d}" >/etc/vmess/${user}
fi
    now=$(date +%Y-%m-%d)
    d1=$(date -d "$exp" +%s)
    d2=$(date -d "$now" +%s)
    exp2=$(( (d1 - d2) / 86400 ))
    exp3=$(($exp2 + $masaaktif))
    exp4=`date -d "$exp3 days" +"%Y-%m-%d"`
    sed -i "/### $user/c\### $user $exp4" /etc/xray/config.json
    systemctl restart xray > /dev/null 2>&1
    clear
clear
echo -e "  RENEW VMESS"
echo -e " Remark      : $user "
echo -e " Limit Ip    : ${iplimit} Devic "
echo -e " Limit Quota : ${Quota} Devic "
echo -e " Expiry in   : $exp4 "
exit 0
fi