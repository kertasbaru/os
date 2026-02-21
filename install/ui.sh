#!/bin/bash
# =========================================
#  WuzzSTORE UI Library - RGB TrueColor
#  Version: 3.6 (Double Rainbow Lines)
# =========================================

# --- KONFIGURASI UI ---
WIDTH=40
WARNA_FILE="/etc/warna_tema"

# =========================================
# 1. DEFINISI WARNA STANDAR (TPUT)
# =========================================

# --- WARNA FONT ---
BLACK=$(tput setaf 0)
RED=$(tput setaf 1)
GREEN=$(tput setaf 2)
YELLOW=$(tput setaf 3)
BLUE=$(tput setaf 4)
MAGENTA=$(tput setaf 5)
CYAN=$(tput setaf 6)
WHITE=$(tput setaf 7)
GRAY=$(tput setaf 8)
BR=$(tput setaf 9)
BG=$(tput setaf 10)
BY=$(tput setaf 11)
BB=$(tput setaf 12)
BM=$(tput setaf 13)
BC=$(tput setaf 14)
BW=$(tput setaf 15)

# WARNA BACKGROUND TPUT
BBLACK=$(tput setab 0)
BRED=$(tput setab 1)
BGREEN=$(tput setab 2)
BYELLOW=$(tput setab 3)
BBLUE=$(tput setab 4)
BMAGENTA=$(tput setab 5)
BCYAN=$(tput setab 6)
BWHITE=$(tput setab 7)
BGRAY=$(tput setab 8)
BBR=$(tput setab 9)
BBG=$(tput setab 10)
BBY=$(tput setab 11)
BBB=$(tput setab 12)
BBM=$(tput setab 13)
BBC=$(tput setab 14)
BBW=$(tput setab 15)

# PEMBANTU WARNA TPUT
RESET=$(tput sgr0)
BOLD=$(tput bold)
UNDERLINE=$(tput smul)
BLINK=$(tput blink)
REVERSE=$(tput rev)

# --- TAGS SHORTCUT ---
INFO="${YELLOW}[INFO]${RESET}"
OK="${GREEN}[OK]${RESET}"
ERROR="${RED}[ERROR]${RESET}"
WARN="${MAGENTA}[WARN]${RESET}"

# --- WARNA DEFAULT RGB (JIKA FILE TIDAK ADA) ---
DEFAULT_START="0 5 0"  # Hijau Mint
DEFAULT_MID="0 200 0"    # Biru Langit
DEFAULT_END="0 5 0"    # Ungu Magenta

# Variable Global RGB
RGB_START=""
RGB_MID=""
RGB_END=""

# Warna Border UI (Default Box)
BORDER_COLOR="${CYAN}"

# =========================================
# 2. ENGINE WARNA (RGB LOGIC)
# =========================================

function load_theme_color() {
    if [[ -f "$WARNA_FILE" ]]; then
        RGB_START=$(grep -m1 "start=" "$WARNA_FILE" | cut -d= -f2)
        RGB_MID=$(grep -m1 "mid=" "$WARNA_FILE" | cut -d= -f2)
        RGB_END=$(grep -m1 "end=" "$WARNA_FILE" | cut -d= -f2)
    else
        RGB_START="$DEFAULT_START"
        RGB_MID="$DEFAULT_MID"
        RGB_END="$DEFAULT_END"
    fi
}

function set_theme_scheme() {
    cat > "$WARNA_FILE" <<EOF
start=$1
mid=$2
end=$3
EOF
    load_theme_color
}

function print_rainbow() {
    local text="$1"
    read sr sg sb <<< "$RGB_START"
    read mr mg mb <<< "$RGB_MID"
    read er eg eb <<< "$RGB_END"

    echo "$text" | awk -v sr="$sr" -v sg="$sg" -v sb="$sb" \
                       -v mr="$mr" -v mg="$mg" -v mb="$mb" \
                       -v er="$er" -v eg="$eg" -v eb="$eb" '
    {
        len = length($0);
        for (i = 1; i <= len; i++) {
            char = substr($0, i, 1);
            progress = (i - 1) / (len - 1);
            if (len == 1) progress = 0;

            if (progress < 0.5) {
                factor = progress * 2;
                r = int((1 - factor) * sr + factor * mr);
                g = int((1 - factor) * sg + factor * mg);
                b = int((1 - factor) * sb + factor * mb);
            } else {
                factor = (progress - 0.5) * 2;
                r = int((1 - factor) * mr + factor * er);
                g = int((1 - factor) * mg + factor * eg);
                b = int((1 - factor) * mb + factor * eb);
            }
            printf "\033[38;2;%d;%d;%dm%s", r, g, b, char;
        }
        print "\033[0m";
    }'
}

# =========================================
# 3. KOMPONEN UI UTAMA (BORDER DEFAULT)
# =========================================

function tengah() {
    local text="$1"
    local color="${2:-$WHITE}"
    
    local text_len=${#text}
    local gap=$((WIDTH - text_len))
    
    if [ $gap -lt 0 ]; then
        text="${text:0:$WIDTH}"
        text_len=${#text}
        gap=0
    fi
    
    local pad_left=$((gap / 2))
    local pad_right=$((gap - pad_left))
    
    local spaces_l=$(printf "%*s" $pad_left "")
    local spaces_r=$(printf "%*s" $pad_right "")
    
    echo -e " ${BORDER_COLOR}│${RESET}${color}${spaces_l}${text}${spaces_r}${RESET}${BORDER_COLOR}│${RESET}"
}

function lane_atas() {
    local line=$(printf "%0.s─" $(seq 1 $WIDTH))
    echo -e " ${BORDER_COLOR}┌${line}┐${RESET}"
}

function lane_tengah() {
    local line=$(printf "%0.s─" $(seq 1 $WIDTH))
    echo -e " ${BORDER_COLOR}├${line}┤${RESET}"
}

function lane_bawah() {
    local line=$(printf "%0.s─" $(seq 1 $WIDTH))
    echo -e " ${BORDER_COLOR}└${line}┘${RESET}"
}

# =========================================
# 4. KOMPONEN GARIS RAINBOW DOUBLE
# =========================================

function garis() {
    local total_len=$((WIDTH + 2))
    local line_str=$(printf "%0.s═" $(seq 1 $total_len))
    print_rainbow " $line_str"
}

function garis_atas() {
    local line=$(printf "%0.s═" $(seq 1 $WIDTH))
    print_rainbow " ╔${line}╗"
}

function garis_tengah() {
    local line=$(printf "%0.s═" $(seq 1 $WIDTH))
    print_rainbow " ╠${line}╣"
}

function garis_bawah() {
    local line=$(printf "%0.s═" $(seq 1 $WIDTH))
    print_rainbow " ╚${line}╝"
}

# =========================================
# 5. HELPER STATUS
# =========================================

function msg_info() {
    echo -e " ${INFO} $1"
}

function msg_ok() {
    echo -e " ${OK} $1"
}

function msg_err() {
    echo -e " ${ERROR} $1"
}

# =========================================
# 6. SECURITY & LICENSE NOTIFICATION
# =========================================

function accepted() {
  clear
  lane_atas
  tengah "ACCESS ACCEPTED" "${BGREEN}${WHITE}${BOLD}"
  lane_bawah
  echo -e ""
}

function rejected() {
  local IP="$1"
  clear
  lane_atas
  tengah "ACCESS REJECTED" "${BRED}${WHITE}${BOLD}"
  lane_tengah
  tengah "Your IP: ${IP}" "${YELLOW}"
  tengah "HAS BEEN BANNED" "${RED}${BOLD}"
  lane_tengah
  tengah "Contact Admin to Unlock:" "${WHITE}"
  tengah "WA: 0877-6020-4418" "${CYAN}"
  tengah "TG: t.me/WuzzSTORE" "${CYAN}"
  lane_bawah
  echo ""
  
  rm -f "$0" >/dev/null 2>&1
  exit 1
}

function self_destruct() {
  clear
  lane_atas
  tengah "PELANGGARAN LISENSI" "${BRED}${WHITE}${BOLD}"
  lane_tengah
  tengah "SISTEM MENGHANCURKAN DIRI" "${RED}${BLINK}"
  lane_tengah
  tengah "Hubungi Admin:" "${WHITE}"
  tengah "Telegram: t.me/WuzzSTORE" "${CYAN}"
  tengah "WhatsApp: 0877-6020-4418" "${CYAN}"
  lane_bawah
  
  rm -f "$0" >/dev/null 2>&1
  rm -f /usr/bin/ui.sh >/dev/null 2>&1
  
  sleep 3
  exit 192
}

# --- INIT ---
load_theme_color