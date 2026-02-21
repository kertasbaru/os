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

wget -q -O /usr/bin/limit-ip "${REPO}install/limit-ip"
chmod +x /usr/bin/*
cd /usr/bin
sed -i 's/\r//' limit-ip
cd
systemctl daemon-reload
wget -q -O /etc/systemd/system/limitvmess.service "${REPO}install/limitvmess.service" && chmod +x limitvmess.service >/dev/null 2>&1
wget -q -O /etc/systemd/system/limitvless.service "${REPO}install/limitvless.service" && chmod +x limitvless.service >/dev/null 2>&1
wget -q -O /etc/systemd/system/limittrojan.service "${REPO}install/limittrojan.service" && chmod +x limittrojan.service >/dev/null 2>&1
wget -q -O /etc/systemd/system/limitshadowsocks.service "${REPO}install/limitshadowsocks.service" && chmod +x limitshadowsocks.service >/dev/null 2>&1
wget -q -O /etc/xray/limit.vmess "${REPO}install/vmess" >/dev/null 2>&1
wget -q -O /etc/xray/limit.vless "${REPO}install/vless" >/dev/null 2>&1
wget -q -O /etc/xray/limit.trojan "${REPO}install/trojan" >/dev/null 2>&1
wget -q -O /etc/xray/limit.shadowsocks "${REPO}install/shadowsocks" >/dev/null 2>&1
chmod +x /etc/xray/limit.vmess
chmod +x /etc/xray/limit.vless
chmod +x /etc/xray/limit.trojan
chmod +x /etc/xray/limit.shadowsocks
systemctl daemon-reload
systemctl enable --now limitvmess
systemctl enable --now limitvless
systemctl enable --now limittrojan
systemctl enable --now limitshadowsocks
systemctl start limitvmess
systemctl start limitvless
systemctl start limittrojan
systemctl start limitshadowsocks
