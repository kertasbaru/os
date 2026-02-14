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
eval $(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")

# Validasi jika gagal muat env
if [[ -z "$IZIN" ]]; then
  echo -e "\033[31m[ERROR] Gagal memuat konfigurasi lisensi.\033[0m"
  exit 1
fi

# 3. LOAD UI LIBRARY (LOCAL SOURCE)
source "/usr/bin/ui.sh"

# 4. LICENSE & IP CHECKING
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

# 2. HELPER FUNCTIONS
function sysctl_add() {
    local key="$1"
    local value="$2"
    local file="/etc/sysctl.conf"
    
    # Cek jika key sudah ada
    if grep -q "^$key" "$file"; then
        # Update nilai jika sudah ada
        sed -i "s|^$key.*|$key = $value|" "$file"
    else
        # Tambahkan jika belum ada
        echo "$key = $value" >> "$file"
    fi
}

function limits_add() {
    local domain="$1"
    local type="$2"
    local item="$3"
    local value="$4"
    local file="/etc/security/limits.conf"

    if ! grep -q "$domain $type $item $value" "$file"; then
        echo "$domain $type $item $value" >> "$file"
    fi
}

# 3. KERNEL CHECK
# BBR butuh kernel 4.9+
KERNEL_VER=$(uname -r | cut -d. -f1,2)
if (( $(echo "$KERNEL_VER < 4.9" | bc -l) )); then
    msg_err "Kernel too old ($KERNEL_VER). Upgrade to 4.9+ first."
    exit 1
fi

# ==========================================================
#  MAIN INSTALLATION
# ==========================================================

msg_info "Installing TCP BBR..."

# 1. Enable BBR Module
# ----------------------------------------------------------
if ! lsmod | grep -q tcp_bbr; then
    modprobe tcp_bbr
    echo "tcp_bbr" >> /etc/modules-load.d/modules.conf
fi
echo "net.core.default_qdisc = fq" >> /etc/sysctl.conf
echo "net.ipv4.tcp_congestion_control = bbr" >> /etc/sysctl.conf

# 2. Optimize Parameters (Sysctl Tuning)
# ----------------------------------------------------------
msg_info "Applying Network Optimization..."

# Limits
limits_add "*" "soft" "nofile" "65535"
limits_add "*" "hard" "nofile" "65535"
limits_add "root" "soft" "nofile" "51200"
limits_add "root" "hard" "nofile" "51200"

# IPv4 & IPv6 Forwarding
sysctl_add "net.ipv4.conf.all.route_localnet" "1"
sysctl_add "net.ipv4.ip_forward" "1"
sysctl_add "net.ipv4.conf.all.forwarding" "1"
sysctl_add "net.ipv4.conf.default.forwarding" "1"

# Performance Tuning
sysctl_add "net.core.netdev_budget" "50000"
sysctl_add "net.core.netdev_budget_usecs" "5000"
sysctl_add "fs.file-max" "51200"
sysctl_add "net.netfilter.nf_conntrack_max" "262144"
sysctl_add "net.netfilter.nf_conntrack_tcp_timeout_time_wait" "30"

# Buffer Sizes (Optimized for High Speed)
sysctl_add "net.core.rmem_max" "67108864"
sysctl_add "net.core.wmem_max" "67108864"
sysctl_add "net.core.rmem_default" "67108864"
sysctl_add "net.core.wmem_default" "67108864"
sysctl_add "net.core.optmem_max" "65536"
sysctl_add "net.core.somaxconn" "10000"

# TCP Tuning
sysctl_add "net.ipv4.tcp_rmem" "4096 87380 67108864"
sysctl_add "net.ipv4.tcp_wmem" "4096 65536 67108864"
sysctl_add "net.ipv4.tcp_mtu_probing" "1"
sysctl_add "net.ipv4.tcp_keepalive_time" "1200"
sysctl_add "net.ipv4.tcp_keepalive_intvl" "15"
sysctl_add "net.ipv4.tcp_keepalive_probes" "5"
sysctl_add "net.ipv4.tcp_timestamps" "1"
sysctl_add "net.ipv4.tcp_tw_reuse" "1"
sysctl_add "net.ipv4.tcp_fin_timeout" "15"
sysctl_add "net.ipv4.tcp_fastopen" "3"
sysctl_add "net.ipv4.tcp_max_syn_backlog" "30000"
sysctl_add "net.ipv4.tcp_max_tw_buckets" "2000000"

# Security Hardening
sysctl_add "net.ipv4.icmp_echo_ignore_broadcasts" "1"
sysctl_add "net.ipv4.icmp_ignore_bogus_error_responses" "1"
sysctl_add "net.ipv4.conf.all.accept_redirects" "0"
sysctl_add "net.ipv4.conf.default.accept_redirects" "0"
sysctl_add "net.ipv4.conf.all.secure_redirects" "0"
sysctl_add "net.ipv4.conf.default.secure_redirects" "0"
sysctl_add "net.ipv4.conf.all.send_redirects" "0"
sysctl_add "net.ipv4.conf.default.send_redirects" "0"
sysctl_add "net.ipv4.conf.default.rp_filter" "0"
sysctl_add "net.ipv4.conf.all.rp_filter" "0"
sysctl_add "net.ipv4.tcp_syncookies" "0"
sysctl_add "net.ipv4.tcp_rfc1337" "0"

# Systemd Limits
if grep -q "DefaultTimeoutStopSec" /etc/systemd/system.conf; then
    sed -i 's/DefaultTimeoutStopSec.*/DefaultTimeoutStopSec=30s/' /etc/systemd/system.conf
else
    echo "DefaultTimeoutStopSec=30s" >> /etc/systemd/system.conf
fi

if grep -q "DefaultLimitNOFILE" /etc/systemd/system.conf; then
    sed -i 's/DefaultLimitNOFILE.*/DefaultLimitNOFILE=65535/' /etc/systemd/system.conf
else
    echo "DefaultLimitNOFILE=65535" >> /etc/systemd/system.conf
fi

# 3. Apply Changes
# ----------------------------------------------------------
sysctl -p > /dev/null 2>&1

# Verify
if [[ $(sysctl net.ipv4.tcp_congestion_control | awk '{print $3}') == "bbr" ]]; then
    msg_ok "BBR is Active!"
else
    msg_err "BBR Installation Failed. Check Kernel Support."
fi

msg_ok "Network Optimization Applied"
sleep 1
