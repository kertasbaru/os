#!/bin/bash
Login=$1
masaaktif=$2
iplimit=$3
Quota=$4
user="${Login}VL$(tr -dc 0-9 </dev/urandom | head -c3)"
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

ISP=$(cat /etc/xray/isp)
CITY=$(cat /etc/xray/city)
domain=$(cat /etc/xray/domain)
nama=$(cat /etc/xray/username)
uuid=$(cat /proc/sys/kernel/random/uuid)
clear
tgl=$(date -d "$masaaktif days" +"%d")
bln=$(date -d "$masaaktif days" +"%b")
thn=$(date -d "$masaaktif days" +"%Y")
expe="$tgl $bln, $thn"
tgl2=$(date +"%d")
bln2=$(date +"%b")
thn2=$(date +"%Y")
tnggl="$tgl2 $bln2, $thn2"
exp=$(date -d "$masaaktif days" +"%Y-%m-%d")
sed -i '/#vless$/a\#& '"$user $exp"'\
},{"id": "'""$uuid""'","email": "'""$user""'"' /etc/xray/config.json
sed -i '/#vlessgrpc$/a\#& '"$user $exp"'\
},{"id": "'""$uuid""'","email": "'""$user""'"' /etc/xray/config.json

vlesslink1="vless://${uuid}@${domain}:443?path=/vless&security=tls&host=${domain}&encryption=none&type=ws&sni=${domain}#${user}"
vlesslink2="vless://${uuid}@${domain}:80?path=/vless&security=none&host=${domain}&encryption=none&type=ws#${user}"
vlesslink3="vless://${uuid}@${domain}:443?mode=gun&security=tls&encryption=none&type=grpc&serviceName=vless-grpc&sni=${domain}#${user}"


if [ ! -e /etc/vless ]; then
  mkdir -p /etc/vless
fi

if [[ $iplimit -gt 0 ]]; then
mkdir -p /etc/kyt/limit/vless/ip
echo -e "$iplimit" > /etc/kyt/limit/vless/ip/$user
else
echo > /dev/null
fi

if [ -z ${Quota} ]; then
  Quota="0"
fi

c=$(echo "${Quota}" | sed 's/[^0-9]*//g')
d=$((${c} * 1024 * 1024 * 1024))

if [[ ${c} != "0" ]]; then
  echo "${d}" >/etc/vless/${user}
fi
DATADB=$(cat /etc/vless/.vless.db | grep "^###" | grep -w "${user}" | awk '{print $2}')
if [[ "${DATADB}" != '' ]]; then
  sed -i "/\b${user}\b/d" /etc/vless/.vless.db
  echo "### ${user} ${exp} ${uuid} ${Quota} ${iplimit}" >>/etc/vless/.vless.db
else
echo "### ${user} ${exp} ${uuid} ${Quota} ${iplimit}" >>/etc/vless/.vless.db
fi
clear
cat >/var/www/html/vless-$user.txt <<-END

======================
$nama 
======================
# Format Vless WS TLS

- name: Vless-$user-WS TLS
  server: ${domain}
  port: 443
  type: vless
  uuid: ${uuid}
  cipher: auto
  tls: true
  skip-cert-verify: true
  servername: ${domain}
  network: ws
  ws-opts:
    path: /vless
    headers:
      Host: ${domain}

# Format Vless WS Non TLS

- name: Vless-$user-WS (CDN) Non TLS
  server: ${domain}
  port: 80
  type: vless
  uuid: ${uuid}
  cipher: auto
  tls: false
  skip-cert-verify: false
  servername: ${domain}
  network: ws
  ws-opts:
    path: /vless
    headers:
      Host: ${domain}
  udp: true

# Format Vless gRPC (SNI)

- name: Vless-$user-gRPC (SNI)
  server: ${domain}
  port: 443
  type: vless
  uuid: ${uuid}
  cipher: auto
  tls: true
  skip-cert-verify: true
  servername: ${domain}
  network: grpc
  grpc-opts:
  grpc-mode: gun
    grpc-service-name: vless-grpc

======================
Link Akun Vless 
======================
Link TLS      : 
${vlesslink1}
======================
Link none TLS : 
${vlesslink2}
======================
Link GRPC     : 
${vlesslink3}
======================
Expired  : $masaaktif Day

END
    systemctl restart xray > /dev/null 2>&1
clear
echo -e " VLESS XRAY "

echo -e " Remark       : ${user}"
echo -e " Domain        : ${domain}"
echo -e " Limit Quota    : ${Quota} GB"
echo -e " Limit Ip       : ${iplimit} IP"
echo -e " Port TLS      : 400,8443"
echo -e " port WS       : 80,8880,8080,2082"
echo -e " Key           : ${uuid}"
echo -e " Localtions    : $CITY"
echo -e " ISP           : $ISP"
echo -e " AlterId       : 0"
echo -e " Security      : auto"
echo -e " Network       : ws"
echo -e " Path          : /vless"
echo -e " Dynamic Path  : yourbug/vless"
echo -e " ServiceName   : vless-grpc"

echo -e " Link TLS      : ${vlesslink1}"
echo -e " Link WS       : ${vlesslink2}"
echo -e " Link GRPC     : ${vlesslink3}"
echo -e " OpenClash     : https://${domain}:81/vless-$user.txt"

echo -e " Days in    : $masaaktif Day "
echo -e " Expiry in  : $expe "