#!/bin/bash

source /usr/bin/ui.sh
eval "$(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")"

if [[ "$MYIP" != "$IPCLIENT" ]]; then
  rejected "$MYIP"
else
  if [[ $date_list > $exp ]]; then
    rejected "$MYIP"
  fi
fi

file_path="/etc/handeling"

# Cek apakah file ada
if [ ! -f "$file_path" ]; then
  echo -e "WUZZSTORE Connected\nGreen" | tee "$file_path" > /dev/null
  echo "File '$file_path' berhasil dibuat."
else
  if [ ! -s "$file_path" ]; then
    echo -e "WUZZSTORE Connected\nGreen" | tee "$file_path" > /dev/null
    echo "File '$file_path' kosong dan telah diisi."
  else
    echo "File '$file_path' sudah ada dan berisi data."
  fi
fi
wget -qO /usr/bin/ws "${REPO}sshws/ws"
wget -qO /usr/bin/config.conf "${REPO}sshws/config.conf"
chmod +x /usr/bin/ws
wget -qO /usr/bin/ohpserver "${REPO}sshws/ohpserver"
chmod +x /usr/bin/ohpserver

# Buat wrapper script untuk OHP server (port 8080, 8880, 2082)
cat > /usr/bin/ohp.sh << 'EOF'
#!/bin/bash
ohpserver -port 8080 -proxy 127.0.0.1:3128 &
PID1=$!
ohpserver -port 8880 -proxy 127.0.0.1:3128 &
PID2=$!
ohpserver -port 2082 -proxy 127.0.0.1:3128 &
PID3=$!
wait $PID1 $PID2 $PID3
EOF
chmod +x /usr/bin/ohp.sh
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

cat > /etc/systemd/system/ohp.service << END
[Unit]
Description=OHP Server By Newbie Store
After=network.target

[Service]
User=root
ExecStart=/usr/bin/ohp.sh
Restart=on-failure
RestartPreventExitStatus=23
LimitNPROC=65535
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target

END

systemctl daemon-reload
systemctl enable ws.service
systemctl restart ws.service
systemctl enable ohp.service
systemctl restart ohp.service