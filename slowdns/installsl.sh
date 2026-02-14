#!/bin/bash
# ==========================================================
#  SlowDNS Installer (DNSTT)
#  Optimized for WuzzSTORE
# ==========================================================

# 1. INITIALIZATION & HEADER
export DEBIAN_FRONTEND=noninteractive

# Load Environment Variables
eval $(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")

# Load UI Library
source "/usr/bin/ui.sh"

# 2. LICENSE CHECKING
function get_ip() {
    local IP=$(curl -sS ipv4.icanhazip.com)
    [[ -z "$IP" ]] && IP=$(curl -sS ipinfo.io/ip)
    echo "$IP"
}

MYIP=$(get_ip)
TODAY=$(date +%Y-%m-%d)

# Cek Izin
RAW_DATA=$(curl -sS "$IZIN" | grep -wE "$MYIP")
VALID_IP=$(echo "$RAW_DATA" | awk '{print $4}')
EXP_DATE=$(echo "$RAW_DATA" | awk '{print $3}')

if [[ "$MYIP" == "$VALID_IP" ]]; then
    if [[ "$TODAY" > "$EXP_DATE" ]]; then
        rejected "$MYIP"
        exit 1
    fi
else
    rejected "$MYIP"
    exit 1
fi

# ==========================================================
#  MAIN LOGIC
# ==========================================================

msg_info "Installing SlowDNS (DNSTT)..."

# 1. Setup DNS Record (Cloudflare)
# ----------------------------------------------------------
function setup_cloudflare_ns() {
    # Variabel Hardcoded untuk Zone Utama SlowDNS
    local ZONE_DOMAIN="vpnnewbie.my.id"
    local CF_ID="diahfitriliani9@gmail.com"
    local CF_KEYD="aab71fabc1841251c851a1d1cf91dd2dcc3c8"

    # Variabel User
    local VPS_DOMAIN=$(cat /etc/xray/domain)
    local SUB=$(echo "$VPS_DOMAIN" | cut -d "." -f1)
    local NS_DOMAIN="ns-${SUB}.${ZONE_DOMAIN}"

    msg_info "Pointing NS: ${NS_DOMAIN} -> ${VPS_DOMAIN}"

    # Get Zone ID
    local ZONE=$(curl -sLX GET "https://api.cloudflare.com/client/v4/zones?name=${ZONE_DOMAIN}&status=active" \
        -H "X-Auth-Email: ${CF_ID}" \
        -H "X-Auth-Key: ${CF_KEYD}" \
        -H "Content-Type: application/json" | jq -r .result[0].id)

    if [[ -z "$ZONE" || "$ZONE" == "null" ]]; then
        msg_err "Gagal mengambil Zone ID Cloudflare. Cek API Key."
        return 1
    fi

    # Check Existing Record
    local RECORD=$(curl -sLX GET "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records?name=${NS_DOMAIN}" \
        -H "X-Auth-Email: ${CF_ID}" \
        -H "X-Auth-Key: ${CF_KEYD}" \
        -H "Content-Type: application/json" | jq -r .result[0].id)

    # Create or Update NS Record
    if [[ "${#RECORD}" -le 10 || "$RECORD" == "null" ]]; then
        # Create
        curl -sLX POST "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records" \
        -H "X-Auth-Email: ${CF_ID}" \
        -H "X-Auth-Key: ${CF_KEYD}" \
        -H "Content-Type: application/json" \
        --data '{"type":"NS","name":"'${NS_DOMAIN}'","content":"'${VPS_DOMAIN}'","proxied":false}' > /dev/null
        msg_ok "NS Record Created"
    else
        # Update
        curl -sLX PUT "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records/${RECORD}" \
        -H "X-Auth-Email: ${CF_ID}" \
        -H "X-Auth-Key: ${CF_KEYD}" \
        -H "Content-Type: application/json" \
        --data '{"type":"NS","name":"'${NS_DOMAIN}'","content":"'${VPS_DOMAIN}'","proxied":false}' > /dev/null
        msg_ok "NS Record Updated"
    fi

    # Simpan NS Domain ke file
    echo "$NS_DOMAIN" > /etc/xray/dns
}

# 2. Setup DNSTT Server
# ----------------------------------------------------------
function setup_dnstt() {
    mkdir -p /etc/slowdns
    cd /etc/slowdns

    msg_info "Downloading DNSTT Binaries..."
    wget -qO dnstt-server "${REPO}slowdns/dnstt-server"
    wget -qO dnstt-client "${REPO}slowdns/dnstt-client"
    chmod +x dnstt-server dnstt-client

    # Generate Key (Hanya jika belum ada)
    if [[ ! -f server.key ]]; then
        msg_info "Generating New Keys..."
        ./dnstt-server -gen-key -privkey-file server.key -pubkey-file server.pub
    else
        msg_info "Using Existing Keys..."
    fi
    chmod +x *

    local PUBKEY=$(cat server.pub)
    local NS_DOMAIN=$(cat /etc/xray/dns)

    # Download Service Files dari Repo (Sesuai Permintaan)
    msg_info "Downloading Service Files..."
    
    wget -qO /etc/systemd/system/client.service "${REPO}slowdns/client"
    wget -qO /etc/systemd/system/server.service "${REPO}slowdns/server"

    # Ganti Placeholder 'xxxx' dengan NS Domain
    msg_info "Configuring Services..."
    sed -i "s/xxxx/$NS_DOMAIN/g" /etc/systemd/system/client.service 
    sed -i "s/xxxx/$NS_DOMAIN/g" /etc/systemd/system/server.service 

    # Setup Firewall (PENTING: Open Port 5300 UDP)
    iptables -I INPUT -p udp --dport 5300 -j ACCEPT
    netfilter-persistent save > /dev/null 2>&1

    # Start Services
    systemctl daemon-reload
    systemctl enable server
    systemctl enable client
    systemctl start server
    systemctl start client

    msg_ok "SlowDNS Service Started"
    
    # Save Key Info for Menu
    echo "$PUBKEY" > /etc/slowdns/public.key
}

# Execution
setup_cloudflare_ns
setup_dnstt

# Final Output Info
clear
lane_atas
tengah "SLOWDNS INSTALLED" "${GREEN}${BOLD}"
lane_bawah
echo -e ""
echo -e " ${INFO} NS Domain : $(cat /etc/xray/dns)"
echo -e " ${INFO} Public Key: $(cat /etc/slowdns/server.pub)"
echo -e ""
sleep 2
