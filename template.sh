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