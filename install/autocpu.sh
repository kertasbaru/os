#!/bin/bash

source /usr/bin/ui.sh
eval "$(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")"

export MYIP=$(curl -s https://ipinfo.io/ip?token=4e159274f1da8c)

data_server=$(curl -v --insecure --silent https://google.com/ 2>&1 | grep Date | sed -e 's/< Date: //')
date_list=$(date +"%Y-%m-%d" -d "$data_server")
url_izin="https://raw.githubusercontent.com/kertasbaru/izin/main/ip"
client=$(curl -sS $url_izin | grep $MYIP | awk '{print $2}')
exp=$(curl -sS $url_izin | grep $MYIP | awk '{print $3}')
IPCLIENT=$(curl -sS $url_izin | grep $MYIP | awk '{print $4}')

if [[ "$MYIP" != "$IPCLIENT" ]]; then
  rejected "$MYIP"
else
  if [[ $date_list > $exp ]] then
    rejected "$MYIP"
  fi
fi

serverV=$(curl -fsSL ${REPO}versi)
localV=$(cat /opt/.ver)

if [[ "$serverV" != "$localV" ]]; then
  wget -qO update.sh "${REPO}menu/update.sh" && chnod +x update.sh && rm update.sh
fi

cd

today=$(date -d "0 days" +"%Y-%m-%d")
Exp2=$(curl -sS https://raw.githubusercontent.com/kertasbaru/izin/main/ip | grep -wE $ipsaya | awk '{print $3}')
d1=$(date -d "$Exp2" +%s)
d2=$(date -d "$today" +%s)
certificate=$(( (d1 - d2) / 86400 ))
echo "$certificate Hari" > /etc/masaaktif
vnstat_profile=$(vnstat | sed -n '3p' | awk '{print $1}' | grep -o '[^:]*')
vnstat -i ${vnstat_profile} >/etc/t1
bulan=$(date +%b)
tahun=$(date +%y)
ba=$(curl -s https://pastebin.com/raw/kVpeatBA)
if [ "$(grep -wc ${bulan} /etc/t1)" != '0' ]; then
bulan=$(date +%b)
month_tx=$(vnstat -i ${vnstat_profile} | grep "$bulan $ba$tahun" | awk '{print $6}')
month_txv=$(vnstat -i ${vnstat_profile} | grep "$bulan $ba$tahun" | awk '{print $7}')
else
bulan2=$(date +%Y-%m)
month_tx=$(vnstat -i ${vnstat_profile} | grep "$bulan2 " | awk '{print $5}')
month_txv=$(vnstat -i ${vnstat_profile} | grep "$bulan2 " | awk '{print $6}')
fi
echo "$month_tx $month_txv" > /etc/usage2
xray2=$(systemctl status xray | grep Active | awk '{print $3}' | cut -d "(" -f2 | cut -d ")" -f1)
if [[ $xray2 == "running" ]]; then
echo -ne
else
systemctl enable xray
systemctl start xray
fi
haproxy2=$(systemctl status haproxy | grep Active | awk '{print $3}' | cut -d "(" -f2 | cut -d ")" -f1)
if [[ $haproxy2 == "running" ]]; then
echo -ne
else
systemctl enable haproxy
systemctl start haproxy
fi
nginx2=$( systemctl status nginx | grep Active | awk '{print $3}' | sed 's/(//g' | sed 's/)//g' )
if [[ $nginx2 == "running" ]]; then
echo -ne
else
systemctl enable nginx
systemctl start nginx
fi
cd
if [[ -e /usr/bin/kyt ]]; then
nginx=$( systemctl status kyt | grep Active | awk '{print $3}' | sed 's/(//g' | sed 's/)//g' )
if [[ $nginx == "running" ]]; then
echo -ne
else
systemctl enable kyt
systemctl start kyt
fi
fi
ws=$(systemctl status ws | grep Active | awk '{print $3}' | cut -d "(" -f2 | cut -d ")" -f1)
if [[ $ws == "running" ]]; then
echo -ne
else
systemctl enable ws
systemctl start ws
fi
apiserver=$(systemctl status apisellvpn | grep Active | awk '{print $3}' | cut -d "(" -f2 | cut -d ")" -f1)
if [[ $apiserver == "running" ]]; then
echo -ne
else
cd
wget -q https://raw.githubusercontent.com/kertasbaru/os/main/install/apiserver && chmod +x apiserver && ./apiserver apisellvpn
fi
bash2=$( pgrep bash | wc -l )
if [[ $bash2 -gt "20" ]]; then
pkill bash
fi