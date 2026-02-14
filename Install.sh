#!/bin/bash
# ==========================================================
#  WuzzSTORE Installer - Complete Edition
#  Version: 2.0 (Full Features + Security)
# ==========================================================

# 1. INITIALIZATION & ANTI-DEBUG
export DEBIAN_FRONTEND=noninteractive
PARENT_PID=$(ps -o ppid= -p $$)
PARENT_CMD=$(ps -o comm= -p $PARENT_PID)

if echo "$PARENT_CMD" | grep -qE "(strace|gdb|ltrace)"; then
    rm -rf "$0"
    kill -9 $$
    exit 1
fi

# 2. LOAD ENVIRONMENT VARIABLES
eval $(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")

if [[ -z "$REPO" || -z "$IZIN" ]]; then
    echo "CRITICAL ERROR: Environment Variables gagal dimuat."
    exit 1
fi

[[ "${REPO}" != */ ]] && REPO="${REPO}/"

# 3. LOAD UI LIBRARY
wget -qO /usr/bin/ui.sh "${REPO}install/ui.sh"
if [[ -f "/usr/bin/ui.sh" ]]; then
    source /usr/bin/ui.sh
    chmod +x /usr/bin/ui.sh
else
    echo "ERROR: UI Library tidak ditemukan."
    exit 1
fi

# 4. INPUT VALIDATION
name="$1"
domain_input="$2"

if [[ -z "$name" || -z "$domain_input" ]]; then
    clear
    lane_atas
    tengah "USAGE ERROR" "${RED}${BOLD}"
    lane_bawah
    echo -e ""
    msg_info "Cara Penggunaan:"
    echo -e " bash $0 ${YELLOW}<username> <domain|random>${RESET}"
    echo -e ""
    exit 1
fi

if [[ ! "$name" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
    msg_err "Username mengandung karakter ilegal!"
    exit 1
fi

# 5. SYSTEM PREPARATION & IP DETECTION
echo 1 > /proc/sys/net/ipv6/conf/all/disable_ipv6
sysctl -w net.ipv6.conf.all.disable_ipv6=1 >/dev/null 2>&1
ln -fs /usr/share/zoneinfo/Asia/Jakarta /etc/localtime

function get_ip() {
    local IP=$(curl -sS ipv4.icanhazip.com)
    [[ -z "$IP" ]] && IP=$(curl -sS ipinfo.io/ip)
    [[ -z "$IP" ]] && IP=$(curl -sS ip.dekaa.my.id)
    echo "$IP"
}

IP_FILE="/usr/bin/.ipvps"
MYIP=$(get_ip)
echo "$MYIP" > "$IP_FILE"

if [[ -z "$MYIP" ]]; then
    msg_err "Gagal mendeteksi IP Public VPS!"
    exit 1
fi

# 6. LICENSE CHECKING
msg_info "Checking License Status..."
RAW_DATA=$(curl -sS "$IZIN" | grep -wE "$MYIP")
VALID_IP=$(echo "$RAW_DATA" | awk '{print $4}')
EXP_DATE=$(echo "$RAW_DATA" | awk '{print $3}')
USER_SERVER=$(echo "$RAW_DATA" | awk '{print $2}')

TODAY=$(date +%Y-%m-%d)

if [[ "$MYIP" == "$VALID_IP" ]]; then
    if [[ "$TODAY" > "$EXP_DATE" ]]; then
        rejected "$MYIP"
    else
        accepted
    fi
else
    rejected "$MYIP"
fi

# Simpan Data User
echo "$name" > /etc/xray/username
echo "$USER_SERVER" > /usr/bin/user
echo "$EXP_DATE" > /usr/bin/e

# 7. INSTALLATION FUNCTIONS

function base_package() {
    clear
    lane_atas
    tengah "INSTALLING DEPENDENCIES"
    lane_bawah
    
    msg_info "Updating System..."
    apt-get update -y
    
    msg_info "Installing Tools..."
    apt-get install -y sudo wget curl ncurses-bin netcat net-tools \
    zip unzip pwgen openssl socat cron bash-completion \
    figlet ruby libxml-parser-perl ntpdate jq \
    iptables iptables-persistent netfilter-persistent \
    squid nmap screen bzip2 gzip coreutils rsyslog iftop htop \
    sed gnupg gnupg1 bc apt-transport-https build-essential \
    dirmngr libxml-parser-perl neofetch lsof openvpn easy-rsa \
    fail2ban tmux chrony python3-full php php-fpm php-cli \
    php-mysql libcurl4-openssl-dev lsb-release haproxy nginx git make

    apt-get purge -y apache2 ufw firewalld exim4
    apt-get autoremove -y

    systemctl enable chrony
    systemctl restart chrony
    chronyc sourcestats -v
    chronyc tracking -v
    
    msg_ok "Dependencies Installed"
}

function make_folder_data() {
    clear
    lane_atas
    tengah "SETUP DATABASE"
    lane_bawah
    
    msg_info "Creating Directory Structure..."
    
    rm -rf /etc/xray
    rm -rf /etc/vmess
    rm -rf /etc/vless
    rm -rf /etc/trojan
    rm -rf /etc/shadowsocks
    rm -rf /etc/ssh
    rm -rf /etc/bot
    rm -rf /etc/udp
    
    mkdir -p /etc/xray
    mkdir -p /etc/vmess
    mkdir -p /etc/vless
    mkdir -p /etc/trojan
    mkdir -p /etc/shadowsocks
    mkdir -p /etc/ssh
    mkdir -p /etc/bot
    mkdir -p /etc/udp
    mkdir -p /var/log/xray
    mkdir -p /var/www/html
    
    mkdir -p /etc/kyt/limit/vmess/ip
    mkdir -p /etc/kyt/limit/vless/ip
    mkdir -p /etc/kyt/limit/trojan/ip
    mkdir -p /etc/kyt/limit/ssh/ip
    mkdir -p /etc/limit/vmess
    mkdir -p /etc/limit/vless
    mkdir -p /etc/limit/trojan
    mkdir -p /etc/limit/ssh
    
    chmod +x /var/log/xray
    touch /var/log/xray/access.log
    touch /var/log/xray/error.log
    
    msg_info "Initializing Database Files..."
    
    touch /etc/xray/domain
    touch /etc/vmess/.vmess.db
    touch /etc/vless/.vless.db
    touch /etc/trojan/.trojan.db
    touch /etc/shadowsocks/.shadowsocks.db
    touch /etc/ssh/.ssh.db
    touch /etc/bot/.bot.db
    
    echo "& plughin Account" >> /etc/vmess/.vmess.db
    echo "& plughin Account" >> /etc/vless/.vless.db
    echo "& plughin Account" >> /etc/trojan/.trojan.db
    echo "& plughin Account" >> /etc/shadowsocks/.shadowsocks.db
    echo "& plughin Account" >> /etc/ssh/.ssh.db

    msg_ok "Database Structure Created"
}

function pasang_domain() {
    clear
    lane_atas
    tengah "SETUP DOMAIN"
    lane_bawah

    mkdir -p /etc/xray
    mkdir -p /var/lib/kyt

    if [[ "$domain_input" == "random" ]]; then
        msg_info "Generating Random Subdomain..."
        SUBDOMAIN="$(tr -dc 'a-z0-9' </dev/urandom | head -c5)"
        DOMAIN="${SUBDOMAIN}.${DOMAINAUTO}"
        
        wget -qO pointing.sh "${REPO}install/pointing.sh"
        chmod +x pointing.sh
        ./pointing.sh "$SUBDOMAIN"
        rm -f pointing.sh
        
        msg_ok "Random Domain: $DOMAIN"
    else
        DOMAIN="$domain_input"
        msg_ok "Custom Domain: $DOMAIN"
    fi

    echo "$DOMAIN" > /etc/xray/domain
    echo "$DOMAIN" > /root/domain
    echo "IP=$DOMAIN" > /var/lib/kyt/ipvps.conf
}

function pasang_ssl() {
    msg_info "Installing SSL Certificate..."
    systemctl stop nginx
    systemctl stop haproxy

    domain=$(cat /etc/xray/domain)
    mkdir -p /root/.acme.sh
    curl https://get.acme.sh | sh -s email=admin@wuzzstore.com
    /root/.acme.sh/acme.sh --upgrade --auto-upgrade
    /root/.acme.sh/acme.sh --set-default-ca --server letsencrypt
    /root/.acme.sh/acme.sh --issue -d $domain --standalone -k ec-256 --force
    /root/.acme.sh/acme.sh --installcert -d $domain \
        --fullchainpath /etc/xray/xray.crt \
        --keypath /etc/xray/xray.key \
        --ecc

    chmod 644 /etc/xray/xray.key
    msg_ok "SSL Installed"
}

function install_xray() {
    clear
    lane_atas
    tengah "INSTALLING XRAY CORE"
    lane_bawah

    mkdir -p /var/log/xray
    mkdir -p /etc/xray
    chown www-data:www-data /var/log/xray
    chmod 755 /var/log/xray
    touch /var/log/xray/access.log
    touch /var/log/xray/error.log

    bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install -u www-data --version 1.8.4

    wget -qO /etc/xray/config.json "${REPO}install/wuzzstore.json"
    wget -qO /etc/haproxy/haproxy.cfg "${REPO}install/haproxy.cfg"
    wget -qO /etc/nginx/conf.d/xray.conf "${REPO}install/xray.conf"
    wget -qO /etc/nginx/nginx.conf "${REPO}install/nginx.conf"

    domain=$(cat /etc/xray/domain)
    sed -i "s/xxx/${domain}/g" /etc/haproxy/haproxy.cfg
    sed -i "s/xxx/${domain}/g" /etc/nginx/conf.d/xray.conf

    cat /etc/xray/xray.crt /etc/xray/xray.key > /etc/haproxy/hap.pem

    cat > /etc/systemd/system/xray.service <<EOF
[Unit]
Description=Xray Service
Documentation=https://github.com/xtls
After=network.target nss-lookup.target

[Service]
User=www-data
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ExecStart=/usr/local/bin/xray run -config /etc/xray/config.json
Restart=on-failure
RestartPreventExitStatus=23
LimitNPROC=65535
LimitNOFILE=1000000

[Install]
WantedBy=multi-user.target
EOF
    msg_ok "Xray Core Installed"
}

function install_ssh_features() {
    clear
    lane_atas
    tengah "INSTALLING SSH & TOOLS"
    lane_bawah

    wget -qO /etc/issue.net "${REPO}install/issue.net"
    wget -qO /etc/pam.d/common-password "${REPO}install/passwordssh"
    chmod +x /etc/pam.d/common-password

    apt-get install dropbear -y
    wget -qO /etc/default/dropbear "${REPO}install/dropbear"
    
    sed -i 's/#Banner/Banner/g' /etc/ssh/sshd_config
    sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/g' /etc/ssh/sshd_config
    echo "Banner /etc/issue.net" >> /etc/ssh/sshd_config
    
    wget -qO /usr/sbin/badvpn "${REPO}install/badvpn"
    chmod +x /usr/sbin/badvpn
    wget -qO /etc/systemd/system/badvpn1.service "${REPO}install/badvpn1.service"
    wget -qO /etc/systemd/system/badvpn2.service "${REPO}install/badvpn2.service"
    wget -qO /etc/systemd/system/badvpn3.service "${REPO}install/badvpn3.service"
    systemctl enable badvpn1 badvpn2 badvpn3

    wget -qO insshws.sh "${REPO}sshws/insshws.sh"
    chmod +x insshws.sh && ./insshws.sh

    mkdir -p /etc/udp
    wget -qO /etc/udp/udp-custom "${REPO}install/udp-custom"
    wget -qO /etc/udp/config.json "${REPO}install/config.json"
    chmod +x /etc/udp/udp-custom

    cat <<EOF > /etc/systemd/system/udp-custom.service
[Unit]
Description=UDP Custom
After=network.target

[Service]
User=root
Type=simple
ExecStart=/etc/udp/udp-custom server
WorkingDirectory=/etc/udp/
Restart=always
RestartSec=2s

[Install]
WantedBy=default.target
EOF
    systemctl enable udp-custom

    msg_ok "SSH, Dropbear, WS, UDP Installed"
}

function install_openvpn() {
    clear
    lane_atas
    tengah "INSTALLING OPENVPN"
    lane_bawah
    
    wget -qO vpn.sh "${REPO}install/vpn.sh"
    chmod +x vpn.sh && ./vpn.sh
    rm -f vpn.sh
    
    msg_ok "OpenVPN Installed"
}

function install_slowdns() {
    clear
    lane_atas
    tengah "INSTALLING SLOWDNS"
    lane_bawah
    
    wget -qO installsl.sh "${REPO}slowdns/installsl.sh"
    chmod +x installsl.sh
    ./installsl.sh
    rm -f installsl.sh
    
    msg_ok "SlowDNS Server Installed"
}

function install_backup_rclone() {
    msg_info "Installing Backup & Rclone..."
    
    apt-get install rclone -y
    mkdir -p /root/.config/rclone
    wget -qO /root/.config/rclone/rclone.conf "https://drive.google.com/u/4/uc?id=1Lg8L12_Wwh3IDXSPF7xESVC_xEzlk081"
    
    git clone https://github.com/magnific0/wondershaper.git /tmp/wondershaper
    cd /tmp/wondershaper && make install
    cd
    rm -rf /tmp/wondershaper
    
    wget -qO /etc/ipserver "${REPO}install/ipserver"
    chmod +x /etc/ipserver
    
    msg_ok "Backup & Rclone Installed"
}

function install_vnstat_source() {
    msg_info "Compiling Vnstat 2.6..."
    
    apt-get install -y libsqlite3-dev
    wget -q https://humdi.net/vnstat/vnstat-2.13.tar.gz
    tar zxvf vnstat-2.13.tar.gz
    cd vnstat-2.13
    ./configure --prefix=/usr --sysconfdir=/etc && make && make install
    cd
    
    local NET=$(ip -o -4 route show to default | awk '{print $5}')
    sed -i "s/Interface \"eth0\"/Interface \"$NET\"/g" /etc/vnstat.conf
    
    systemctl enable vnstat
    systemctl restart vnstat
    rm -rf vnstat-2.13.tar.gz vnstat-2.13
    msg_ok "Vnstat 2.13 Compiled"
}

function install_system_tweaks() {
    msg_info "Applying System Tweaks..."
    
    # Gotop
    local gotop_latest="$(curl -s https://api.github.com/repos/xxxserxxx/gotop/releases | grep tag_name | sed -E 's/.*"v(.*)".*/\1/' | head -n 1)"
    local gotop_link="https://github.com/xxxserxxx/gotop/releases/download/v$gotop_latest/gotop_v${gotop_latest}_linux_amd64.deb"
    curl -sL "$gotop_link" -o /tmp/gotop.deb
    dpkg -i /tmp/gotop.deb
    rm -f /tmp/gotop.deb

    # Swap 1GB
    if [[ ! -f /swapfile ]]; then
        dd if=/dev/zero of=/swapfile bs=1024 count=1048576
        mkswap /swapfile
        chmod 600 /swapfile
        swapon /swapfile
        echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
        msg_ok "Swap 1GB Created"
    fi

    # BBR
    wget -qO bbr.sh "${REPO}install/bbr.sh"
    chmod +x bbr.sh && ./bbr.sh
    rm -f bbr.sh

    # Sysctl Tuning
    cat >> /etc/sysctl.conf <<EOF
fs.file-max = 65535
net.netfilter.nf_conntrack_max = 262144
net.netfilter.nf_conntrack_tcp_timeout_time_wait = 30
EOF
    sysctl -p
    msg_ok "Tweaks Applied"
}

function install_menu() {
    clear
    lane_atas
    tengah "INSTALLING MENU"
    lane_bawah

    wget -qO update.sh "${REPO}menu/update.sh"
    chmod +x update.sh && ./update.sh
    
    cat > /root/.profile <<EOF
if [ "\$BASH" ]; then
  if [ -f ~/.bashrc ]; then
    . ~/.bashrc
  fi
fi
mesg n || true
menu
EOF
    
    echo "0 0 * * * root /sbin/reboot" > /etc/cron.d/auto_reboot
    echo "*/10 * * * * root /usr/bin/clearlog" > /etc/cron.d/log_cleaner
    echo "0 0 * * * root /usr/bin/xp" > /etc/cron.d/xp_daily
    service cron restart

    msg_ok "Menu Installed"
}

function finish_install() {
    TIME=$(date '+%d %b %Y %H:%M:%S')
    TEXT="
<code>────────────────────</code>
<b>🟢 INSTALL SUCCESS 🟢</b>
<code>────────────────────</code>
<code>User   : </code><code>$name</code>
<code>Domain : </code><code>$(cat /etc/xray/domain)</code>
<code>IP     : </code><code>$MYIP</code>
<code>Date   : </code><code>$TIME</code>
<code>────────────────────</code>
"
    curl -s -d "chat_id=$CHATID&disable_web_page_preview=1&text=$TEXT&parse_mode=html" \
    "https://api.telegram.org/bot$KEY/sendMessage" > /dev/null

    rm -rf /root/{install.sh,pointing.sh,update.sh,insshws.sh,vpn.sh}
    rm -rf /root/*.zip
    
    history -c
    echo "unset HISTFILE" >> /etc/profile

    clear
    lane_atas
    tengah "INSTALLATION COMPLETED" "${GREEN}${BOLD}"
    lane_tengah
    tengah "Server will reboot in 5 seconds" "${YELLOW}"
    lane_bawah
    garis
    
    sleep 5
    reboot
}

# 8. MAIN EXECUTION FLOW
base_package
make_folder_data
pasang_domain
pasang_ssl
install_xray
install_ssh_features
install_openvpn
install_slowdns
install_vnstat_source
install_backup_rclone
install_system_tweaks
install_menu
finish_install
