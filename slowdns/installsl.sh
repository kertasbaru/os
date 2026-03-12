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
        --data '{"type":"A","name":"'${NS_DOMAIN}'","content":"'${MYIP}'","proxied":false}' >/dev/null
else
    # Jika Record sudah ada (Update)
    curl -sLX PUT "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records/${RECORD}" \
        -H "Authorization: Bearer ${CF_KEY}" \
        -H "Content-Type: application/json" \
        --data '{"type":"A","name":"'${NS_DOMAIN}'","content":"'${MYIP}'","proxied":false}' >/dev/null
fi

echo $NS_DOMAIN >/etc/xray/dns

cd /etc/slowdns
wget -qO dnstt-server "${REPO}slowdns/dnstt-server"
chmod +x dnstt-server
wget -qO dnstt-client "${REPO}slowdns/dnstt-client"
chmod +x dnstt-client
./dnstt-server -gen-key -privkey-file server.key -pubkey-file server.pub
chmod 600 server.key server.pub
wget -qO /etc/systemd/system/client.service "${REPO}slowdns/client"
wget -qO /etc/systemd/system/server.service "${REPO}slowdns/server"
sed -i "s/xxxx/$NS_DOMAIN/g" /etc/systemd/system/client.service
if grep -q 'yyyy' /etc/systemd/system/client.service; then
  sed -i "s/yyyy/$MYIP/g" /etc/systemd/system/client.service
fi
sed -i "s/xxxx/$NS_DOMAIN/g" /etc/systemd/system/server.service

systemctl daemon-reload
systemctl enable server
systemctl enable client
systemctl restart server
systemctl restart client