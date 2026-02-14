#!/bin/bash

# 1. INITIALIZATION & ANTI-DEBUG
export DEBIAN_FRONTEND=noninteractive
PARENT_PID=$(ps -o ppid= -p $$)
PARENT_CMD=$(ps -o comm= -p $PARENT_PID)

# Deteksi Debugger / Tracer (Anti-Maling/Anti-Intip)
if echo "$PARENT_CMD" | grep -qE "(strace|gdb|ltrace)"; then
    rm -rf "$0"
    kill -9 $$
    exit 1
fi

# 2. LOAD ENVIRONMENT VARIABLES
# Memuat env vars (GH, REPO, IZIN, dll)
eval $(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")

# Validasi jika gagal muat env
if [[ -z "$IZIN" ]]; then
    echo -e "\033[31m[ERROR] Gagal memuat konfigurasi lisensi.\033[0m"
    exit 1
fi

# 3. LOAD UI LIBRARY (LOCAL SOURCE)
source "/usr/bin/ui.sh"

# 4. LICENSE & IP CHECKING
# Fungsi Deteksi IP (Failover)
function get_ip() {
    local IP=$(curl -sS --connect-timeout 3 ipv4.icanhazip.com)
    if [[ -z "$IP" ]]; then
        IP=$(curl -sS --connect-timeout 3 ipinfo.io/ip)
    fi
    echo "$IP"
}

MYIP=$(get_ip)
TODAY=$(date +%Y-%m-%d)

# Cek Izin ke Server
RAW_DATA=$(curl -sS --connect-timeout 5 "$IZIN" | grep -wE "$MYIP")
VALID_IP=$(echo "$RAW_DATA" | awk '{print $4}')
EXP_DATE=$(echo "$RAW_DATA" | awk '{print $3}')

# Validasi Lisensi Ketat
if [[ "$MYIP" == "$VALID_IP" ]]; then
    if [[ "$TODAY" > "$EXP_DATE" ]]; then
        rejected "$MYIP"
        exit 1
    fi
else
    rejected "$MYIP"
    exit 1
fi

# 2. Pre-Check Dependencies & Variables
if ! command -v jq &> /dev/null; then
    apt-get install jq -y > /dev/null 2>&1
fi

# Ambil Input dari Install.sh
SUB_NAME="$1"

# Cek Variabel Lingkungan (Dari Install.sh)
if [[ -z "$CF_KEY" || -z "$DOMAINAUTO" || -z "$MYIP" ]]; then
    msg_err "Variabel CF_KEY / DOMAINAUTO / MYIP hilang."
    msg_err "Script ini harus dijalankan melalui Install.sh"
    exit 1
fi

# Cek Input Subdomain
if [[ -z "$SUB_NAME" ]]; then
    msg_err "Nama Subdomain belum ditentukan!"
    exit 1
fi

# 3. Definisi Variabel
DOMAIN="${DOMAINAUTO}"
SUB_DOMAIN="${SUB_NAME}.${DOMAIN}"
NS_DOMAIN="*.${SUB_DOMAIN}"

# 4. Eksekusi Pointing
msg_info "Pointing Domain: ${SUB_DOMAIN}"
msg_info "IP Address: ${MYIP}"

# --- A. Dapatkan Zone ID ---
ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}&status=active" \
     -H "Authorization: Bearer ${CF_KEY}" \
     -H "Content-Type: application/json" | jq -r .result[0].id)

if [[ -z "$ZONE_ID" || "$ZONE_ID" == "null" ]]; then
    msg_err "Gagal mendapatkan Zone ID untuk ${DOMAIN}."
    msg_err "Cek kembali CF_KEY atau DOMAINAUTO."
    exit 1
fi

# --- Fungsi Update Record ---
function update_dns() {
    local dns_name=$1
    local dns_type=$2
    local dns_content=$3
    local dns_proxied=$4

    # Cari Record ID jika sudah ada
    local record_id=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=${dns_name}&type=${dns_type}" \
        -H "Authorization: Bearer ${CF_KEY}" \
        -H "Content-Type: application/json" | jq -r .result[0].id)

    if [[ "${record_id}" == "null" || -z "${record_id}" ]]; then
        # CREATE (POST)
        local res=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
            -H "Authorization: Bearer ${CF_KEY}" \
            -H "Content-Type: application/json" \
            --data '{"type":"'${dns_type}'","name":"'${dns_name}'","content":"'${dns_content}'","proxied":'${dns_proxied}'}')
            msg_ok "Created: ${dns_name}"
    else
        # UPDATE (PUT)
        local res=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${record_id}" \
            -H "Authorization: Bearer ${CF_KEY}" \
            -H "Content-Type: application/json" \
            --data '{"type":"'${dns_type}'","name":"'${dns_name}'","content":"'${dns_content}'","proxied":'${dns_proxied}'}')
            msg_ok "Updated: ${dns_name}"
    fi
}

# --- B. Proses Utama ---

# 1. Pointing Subdomain Utama (Proxied: FALSE untuk SSL/SSH)
update_dns "${SUB_DOMAIN}" "A" "${MYIP}" "false"

# 2. Pointing Wildcard (Proxied: TRUE untuk WS CDN support - Opsional)
# Kamu bisa ubah ke false jika ingin wildcard non-cdn
update_dns "${NS_DOMAIN}" "A" "${MYIP}" "true"

# 5. Finishing
echo "$SUB_DOMAIN" > /etc/xray/domain

msg_ok "Domain setup complete."
sleep 1
