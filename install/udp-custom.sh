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

# install udp-custom
wget -qO /etc/udp/udp-custom "https://docs.google.com/uc?export=download&id=1ixz82G_ruRBnEEp4vLPNF2KZ1k8UfrkV"
chmod +x /etc/udp/udp-custom
wget -qO /etc/udp/config.json "https://docs.google.com/uc?export=download&id=1_XNXsufQXzcTUVVKQoBeX5Ig0J7GngGM"
chmod 644 /etc/udp/config.json

cat > /etc/systemd/system/udp-custom.service <<EOF
[Unit]
Description=UDP Custom by ePro Dev. Team
[Service]
User=root
Type=simple
ExecStart=/etc/udp/udp-custom server
WorkingDirectory=/etc/udp/
Restart=always
RestartSec=2s
[Install]
WantedBy=default.target
EOF

echo start service udp-custom
systemctl start udp-custom &>/dev/null

echo enable service udp-custom
systemctl enable udp-custom &>/dev/null