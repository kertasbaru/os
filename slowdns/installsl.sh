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

NS_DOMAIN="$1"
DOMAIN=$(echo "$NS_DOMAIN" | cut -d "." -f2-)

ZONE=$(curl -sLX GET "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}&status=active" \
    -H "Authorization: Bearer ${CF_KEY}" \
    -H "Content-Type: application/json" | jq -r .result[0].id)

if [[ -z "$ZONE" || "$ZONE" == "null" ]]; then
    msg_err "Gagal mendapatkan Zone ID Cloudflare. Periksa CF_KEY atau domain Anda!"
    exit 1
fi

RECORD=$(curl -sLX GET "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records?name=${NS_DOMAIN}" \
    -H "Authorization: Bearer ${CF_KEY}" \
    -H "Content-Type: application/json" | jq -r .result[0].id)

if [[ "${#RECORD}" -le 10 ]]; then
    # Jika Record belum ada (Create)
    curl -sLX POST "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records" \
        -H "Authorization: Bearer ${CF_KEY}" \
        -H "Content-Type: application/json" \
        --data '{"type":"NS","name":"'${NS_DOMAIN}'","content":"'${MYIP}'","proxied":false}' >/dev/null
else
    # Jika Record sudah ada (Update)
    curl -sLX PUT "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records/${RECORD}" \
        -H "Authorization: Bearer ${CF_KEY}" \
        -H "Content-Type: application/json" \
        --data '{"type":"NS","name":"'${NS_DOMAIN}'","content":"'${MYIP}'","proxied":false}' >/dev/null
fi

echo $NS_DOMAIN >/etc/xray/dns

cd
cd /etc/slowdns
wget -O dnstt-server "${REPO}slowdns/dnstt-server" >/dev/null 2>&1
chmod +x dnstt-server >/dev/null 2>&1
wget -O dnstt-client "${REPO}slowdns/dnstt-client" >/dev/null 2>&1
chmod +x dnstt-client >/dev/null 2>&1
./dnstt-server -gen-key -privkey-file server.key -pubkey-file server.pub
chmod +x *
wget -O /etc/systemd/system/client.service "${REPO}slowdns/client" >/dev/null 2>&1
wget -O /etc/systemd/system/server.service "${REPO}slowdns/server" >/dev/null 2>&1
sed -i "s/xxxx/$NS_DOMAIN/g" /etc/systemd/system/client.service 
sed -i "s/xxxx/$NS_DOMAIN/g" /etc/systemd/system/server.service

systemctl daemon-reload
systemctl enable server
systemctl enable client
systemctl start server
systemctl start client