#!/bin/bash
User=$1
Days=$3
iplimit=$2

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

egrep "^$User" /etc/passwd >/dev/null
if [ $? -eq 0 ]; then
current_exp=$(chage -l $User | grep "Account expires" | cut -d: -f2 | xargs)

if [[ "$current_exp" == "never" ]]; then
  base_date=$(date +%s)
else
  base_date=$(date -d "$current_exp" +%s)
fi

Days_Detailed=$(( $Days * 86400 ))
Expire_On=$(( $base_date + $Days_Detailed ))
Expiration=$(date -u --date="1970-01-01 $Expire_On sec GMT" +%Y/%m/%d)
Expiration_Display=$(date -u --date="1970-01-01 $Expire_On sec GMT" '+%d %b %Y')
tgl=$(date -d "$Days days" +"%d")
bln=$(date -d "$Days days" +"%b")
thn=$(date -d "$Days days" +"%Y")
expe="$tgl $bln, $thn"
expi=$(cat /etc/xray/ssh | grep -wE "$User" | cut -d " " -f6-8)
sed -i "s/$expi/$expe/" /etc/xray/ssh
passwd -u $User
usermod -e  $Expiration $User
clear
echo -e "  RENEW SSH"
echo -e " Remark      : $User "
echo -e " Limit Ip    : ${iplimit} Devic "
echo -e " Expiry in  : $Expiration_Display "
exit 0
else
echo -e "  RENEW SSH FAILED USER IS GONE"
exit 1
fi