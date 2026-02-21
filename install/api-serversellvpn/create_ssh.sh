#!/bin/bash
export TERM=xterm
export PATH="/usr/sbin:/usr/bin:/sbin:/bin"

user=$1
Pass=$2
iplimit=$3
masaaktif=$4
Login="${user}SSH$(tr -dc 0-9 </dev/urandom | head -c3)"
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
    exit
  fi
}

if getent group "$Login" > /dev/null; then
    GROUP_OPTION="-g $Login"  # Gunakan grup yang ada
else
    /usr/sbin/groupadd "$Login"  # Buat grup baru
    GROUP_OPTION="-g $Login"
fi

egrep "^$Login" /etc/passwd >/dev/null
if [ $? -eq 0 ]; then
    echo "User $Login sudah ada."
    exit 1
fi
ISP=$(cat /etc/xray/isp)
CITY=$(cat /etc/xray/city)
domain=$(cat /etc/xray/domain)
nama=$(cat /etc/xray/username)
tgl=$(date -d "$masaaktif days" +"%d")
bln=$(date -d "$masaaktif days" +"%b")
thn=$(date -d "$masaaktif days" +"%Y")
expe="$tgl $bln, $thn"
tgl2=$(date +"%d")
bln2=$(date +"%b")
thn2=$(date +"%Y")
tnggl="$tgl2 $bln2, $thn2"
/usr/sbin/useradd -e "$(date -d "$masaaktif days" +"%Y-%m-%d")" -s /bin/false -M $GROUP_OPTION "$Login"
expi="$(chage -l $Login | grep "Account expires" | awk -F": " '{print $2}')"
echo -e "$Pass\n$Pass\n"| passwd $Login &> /dev/null
hariini=`date -d "0 days" +"%Y-%m-%d"`
expi=`date -d "$masaaktif days" +"%Y-%m-%d"`
egrep "^$Login" /etc/passwd >/dev/null
if [ $? -ne 0 ]; then
    echo "Gagal membuat user $Login. Periksa log untuk detail."
    exit 1
fi
if [[ $iplimit -gt 0 ]]; then
mkdir -p /etc/kyt/limit/ssh/ip/
echo -e "$iplimit" > /etc/kyt/limit/ssh/ip/$Login
else
echo > /dev/null
fi

if [ ! -e /etc/ssh ]; then
  mkdir -p /etc/ssh
fi

DATADB=$(cat /etc/xray/ssh | grep "^###" | grep -w "${Login}" | awk '{print $2}')
if [[ "${DATADB}" != '' ]]; then
  sed -i "/\b${Login}\b/d" /etc/xray/ssh
  echo "### ${Login} ${expe} ${Pass} ${iplimit}" >>/etc/xray/ssh
else
echo "### ${Login} ${expe} ${Pass} ${iplimit}" >>/etc/xray/ssh
fi

echo -e "  SSH OPENVPN"
echo -e " Remark      : $Login "
echo -e " Password    : $Pass "
echo -e " Limit Ip    : ${iplimit} Devic "
echo -e " Domain      : $domain "
echo -e " ISP         : $ISP  "
echo -e " OpenSSH     : 443, 80, 22 "
echo -e " Port UDP    : 1-65535 "
echo -e " SSH WS      : 80,8080,8880,2082 "
echo -e " SSL/TLS     : 443 "
echo -e " OVPN UDP    : 2200 "
echo -e " Port 80     : $domain:80@$Login:$Pass "
echo -e " Port 443    : $domain:443@$Login:$Pass "
echo -e " Udp Custom  : $domain:1-65535@$Login:$Pass"
echo -e " OpenVpn     : https://$domain:81/ "
echo -e " Account     : https://$domain:81/ssh-$Login.txt "
echo -e " Payload WS  : GET / HTTP/1.1[crlf]Host: [host][crlf]Connection: Upgrade[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]"
echo -e " Payload TLS : GET wss://$domain/ HTTP/1.1[crlf]Host: [host][crlf]Connection: Upgrade[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]"
echo -e " Payload ENCD: HEAD / HTTP/1.1[crlf]Host: Masukan_Bug[crlf][crlf]PATCH / HTTP/1.1[crlf]Host: [host][crlf]Upgrade: websocket[crlf][crlf][split]HTTP/ 1[crlf][crlf]"
echo -e " Days in    : $masaaktif Day "
echo -e " Expiry in  : $expe "