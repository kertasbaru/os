#!/bin/bash

source /usr/bin/ui.sh
eval "$(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")"

if [[ "$MYIP" != "$IPCLIENT" ]]; then
  rejected "$MYIP"
else
  if [[ $date_list > $exp ]] then
    rejected "$MYIP"
  fi
fi

file_path="/etc/handeling"

# Cek apakah file ada
if [ ! -f "$file_path" ]; then
  echo -e "WUZZSTORE Connected\nGreen" | sudo tee "$file_path" > /dev/null
  echo "File '$file_path' berhasil dibuat."
else
  if [ ! -s "$file_path" ]; then
    echo -e "WUZZSTORE Connected\nGreen" | sudo tee "$file_path" > /dev/null
    echo "File '$file_path' kosong dan telah diisi."
  else
    echo "File '$file_path' sudah ada dan berisi data."
  fi
fi
wget -O /usr/bin/ws "${REPO}sshws/ws"
wget -O /usr/bin/config.conf "${REPO}sshws/config.conf"
chmod +x /usr/bin/ws
cat > /etc/systemd/system/ws.service << END
[Unit]
Description=WebSocket E-Pro V1 By Newbie Store
Documentation=https://github.com/kertasbaru
After=syslog.target network-online.target

[Service]
User=root
NoNewPrivileges=true
ExecStart=/usr/bin/ws -f /usr/bin/config.conf
Restart=on-failure
RestartPreventExitStatus=23
LimitNPROC=65535
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target

END

systemctl daemon-reload
systemctl enable ws.service
systemctl start ws.service
systemctl restart ws.service