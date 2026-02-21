#!/bin/bash
Login=$1
masaaktif=$2
iplimit=$3
Quota=$4
user="${Login}VM$(tr -dc 0-9 </dev/urandom | head -c3)"
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
exp=`date -d "$masaaktif days" +"%Y-%m-%d"`
sed -i '/#vmess$/a\### '"$user $exp"'\
},{"id": "'""$uuid""'","alterId": '"0"',"email": "'""$user""'"' /etc/xray/config.json
exp=`date -d "$masaaktif days" +"%Y-%m-%d"`
sed -i '/#vmessgrpc$/a\### '"$user $exp"'\
},{"id": "'""$uuid""'","alterId": '"0"',"email": "'""$user""'"' /etc/xray/config.json

asu=`cat<<EOF
      {
      "v": "2",
      "ps": "${user}",
      "add": "${domain}",
      "port": "443",
      "id": "${uuid}",
      "aid": "0",
      "net": "ws",
      "path": "/vmess",
      "type": "none",
      "host": "${domain}",
      "tls": "tls"
}
EOF`
ask=`cat<<EOF
      {
      "v": "2",
      "ps": "${user}",
      "add": "${domain}",
      "port": "80",
      "id": "${uuid}",
      "aid": "0",
      "net": "ws",
      "path": "/vmess",
      "type": "none",
      "host": "${domain}",
      "tls": "none"
}
EOF`
grpc=`cat<<EOF
      {
      "v": "2",
      "ps": "${user}",
      "add": "${domain}",
      "port": "443",
      "id": "${uuid}",
      "aid": "0",
      "net": "grpc",
      "path": "vmess-grpc",
      "type": "none",
      "host": "${domain}",
      "tls": "tls"
}
EOF`
vmess_base641=$( base64 -w 0 <<< $vmess_json1)
vmess_base642=$( base64 -w 0 <<< $vmess_json2)
vmess_base643=$( base64 -w 0 <<< $vmess_json3)
vmesslink1="vmess://$(echo $asu | base64 -w 0)"
vmesslink2="vmess://$(echo $ask | base64 -w 0)"
vmesslink3="vmess://$(echo $grpc | base64 -w 0)"


cat >/var/www/html/vmess-$user.txt <<-END

======================
$nama
======================
# Format Vmess WS TLS

- name: Vmess-$user-WS TLS
  type: vmess
  server: ${domain}
  port: 443
  uuid: ${uuid}
  alterId: 0
  cipher: auto
  udp: true
  tls: true
  skip-cert-verify: true
  servername: ${domain}
  network: ws
  ws-opts:
    path: /vmess
    headers:
      Host: ${domain}

# Format Vmess WS Non TLS

- name: Vmess-$user-WS Non TLS
  type: vmess
  server: ${domain}
  port: 80
  uuid: ${uuid}
  alterId: 0
  cipher: auto
  udp: true
  tls: false
  skip-cert-verify: false
  servername: ${domain}
  network: ws
  ws-opts:
    path: /vmess
    headers:
      Host: ${domain}

# Format Vmess gRPC

- name: Vmess-$user-gRPC (SNI)
  server: ${domain}
  port: 443
  type: vmess
  uuid: ${uuid}
  alterId: 0
  cipher: auto
  network: grpc
  tls: true
  servername: ${domain}
  skip-cert-verify: true
  grpc-opts:
    grpc-service-name: vmess-grpc

======================
 Link Akun Vmess
======================
Link TLS         : 
${vmesslink1}
======================
Link none TLS    : 
${vmesslink2}
======================
Link GRPC        : 
${vmesslink3}
======================
Aktif Selama   : $masaaktif Hari
Dibuat Pada    : $tnggl
Berakhir Pada  : $expe
======================

END
if [ ! -e /etc/vmess ]; then
  mkdir -p /etc/vmess
fi

if [[ $iplimit -gt 0 ]]; then
mkdir -p /etc/kyt/limit/vmess/ip
echo -e "$iplimit" > /etc/kyt/limit/vmess/ip/$user
else
echo > /dev/null
fi

if [ -z ${Quota} ]; then
  Quota="0"
fi

c=$(echo "${Quota}" | sed 's/[^0-9]*//g')
d=$((${c} * 1024 * 1024 * 1024))

if [[ ${c} != "0" ]]; then
  echo "${d}" >/etc/vmess/${user}
fi
DATADB=$(cat /etc/vmess/.vmess.db | grep "^###" | grep -w "${user}" | awk '{print $2}')
if [[ "${DATADB}" != '' ]]; then
	sed -i "/\b${user}\b/d" /etc/vmess/.vmess.db
	echo "### ${user} ${exp} ${uuid} ${Quota} ${iplimit}" >>/etc/vmess/.vmess.db
else
echo "### ${user} ${exp} ${uuid} ${Quota} ${iplimit}" >>/etc/vmess/.vmess.db
fi
    systemctl restart xray > /dev/null 2>&1
clear
echo -e " VMESS XRAY "

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
echo -e " Path          : /vmess"
echo -e " Dynamic Path  : yourbug/vmess"
echo -e " ServiceName   : vmess-grpc"

echo -e " Link TLS      : ${vmesslink1}"
echo -e " Link WS       : ${vmesslink2}"
echo -e " Link GRPC     : ${vmesslink3}"
echo -e " OpenClash     : https://${domain}:81/vmess-$user.txt"

echo -e " Days in    : $masaaktif Day "
echo -e " Expiry in  : $expe "