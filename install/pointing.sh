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

# --- 3. Parsing Nama Domain ---
FULL_DOMAIN="$1"

DO=$(echo "$FULL_DOMAIN" | cut -d "." -f2-)
SUB=$(echo "$FULL_DOMAIN" | cut -d "." -f1)

SUB_DOMAIN="${SUB}.${DO}"

# --- 4. Eksekusi API Cloudflare ---
set -euo pipefail

# Mendapatkan Zone ID
ZONE=$(curl -sLX GET "https://api.cloudflare.com/client/v4/zones?name=${DO}&status=active" \
    -H "Authorization: Bearer ${CF_KEY}" \
    -H "Content-Type: application/json" | jq -r .result[0].id)

if [[ -z "$ZONE" || "$ZONE" == "null" ]]; then
    msg_err "Gagal mendapatkan Zone ID Cloudflare. Periksa CF_KEY atau domain Anda!"
    exit 1
fi

# Mendapatkan Record ID jika sudah ada
RECORD=$(curl -sLX GET "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records?name=${SUB_DOMAIN}" \
    -H "Authorization: Bearer ${CF_KEY}" \
    -H "Content-Type: application/json" | jq -r .result[0].id)

RECORD1=$(curl -sLX GET "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records?name=${NS_DOMAIN}" \
    -H "Authorization: Bearer ${CF_KEY}" \
    -H "Content-Type: application/json" | jq -r .result[0].id)

# --- 5. Create / Update A Record (SUB_DOMAIN) ---
if [[ "${#RECORD}" -le 10 ]]; then
    # Jika Record belum ada (Create)
    curl -sLX POST "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records" \
        -H "Authorization: Bearer ${CF_KEY}" \
        -H "Content-Type: application/json" \
        --data '{"type":"A","name":"'${SUB_DOMAIN}'","content":"'${MYIP}'","proxied":false}' >/dev/null
else
    # Jika Record sudah ada (Update)
    curl -sLX PUT "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records/${RECORD}" \
        -H "Authorization: Bearer ${CF_KEY}" \
        -H "Content-Type: application/json" \
        --data '{"type":"A","name":"'${SUB_DOMAIN}'","content":"'${MYIP}'","proxied":false}' >/dev/null
fi

# --- 6. Create / Update Wildcard Record (NS_DOMAIN) ---
if [[ "${#RECORD1}" -le 10 ]]; then
    # Jika Record Wildcard belum ada (Create)
    curl -sLX POST "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records" \
        -H "Authorization: Bearer ${CF_KEY}" \
        -H "Content-Type: application/json" \
        --data '{"type":"A","name":"'${NS_DOMAIN}'","content":"'${MYIP}'","proxied":true}' >/dev/null
else
    # Jika Record Wildcard sudah ada (Update)
    curl -sLX PUT "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records/${RECORD1}" \
        -H "Authorization: Bearer ${CF_KEY}" \
        -H "Content-Type: application/json" \
        --data '{"type":"A","name":"'${NS_DOMAIN}'","content":"'${MYIP}'","proxied":true}' >/dev/null
fi

# --- 7. Selesai ---
sleep 1
clear
