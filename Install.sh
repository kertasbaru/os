#!/bin/bash

export DEBIAN_FRONTEND=noninteractive
echo 1 > /proc/sys/net/ipv6/conf/all/disable_ipv6

wget -qO /usr/bin/ui.sh "https://docs.google.com/uc?export=download&id=1uDRCwDrT2TtB3Cskvxaby92GgaqWk-Du"
chmod +x /usr/bin/ui.sh

source /usr/bin/ui.sh
source /etc/os-release

name="$1"
domain_input="$2"

if [[ -z "$name" || -z "$domain_input" || ! "$name" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
  msg_err "Contoh: $0 wuzz_store random"
  exit 1
fi

eval "$(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")"

export MYIP=$(curl -s https://ipinfo.io/ip?token=4e159274f1da8c)
export CITY=$(curl -s https://ipinfo.io/city?token=4e159274f1da8c)
export ISP=$(curl -s https://ipinfo.io/org?token=4e159274f1da8c)

export data_server=$(curl -v --insecure --silent https://google.com/ 2>&1 | grep Date | sed -e 's/< Date: //')
export date_list=$(date +"%Y-%m-%d" -d "$data_server")
export client=$(curl -sS $IZIN | grep $MYIP | awk '{print $2}')
export exp=$(curl -sS $IZIN | grep $MYIP | awk '{print $3}')
export IPCLIENT=$(curl -sS $IZIN | grep $MYIP | awk '{print $4}')

if [[ "$MYIP" == "$IPCLIENT" ]]; then
  if [[ $date_list < $exp ]]; then
    accepted
    apt update -y && apt upgrade -y 
    apt install -y sudo wget curl ncurses-bin lolcat
    gem install lolcat || true
  else
    rejected "$MYIP"
  fi
else
  rejected "$MYIP"
fi

banner() {
  clear
  echo ""
  lane_atas
  tengah "WUZZSTORE VPN INSTALLER" "${BOLD}${WHITE}"
  tengah "Stable Edition" "${YELLOW}"
  tengah ""
  tengah "For Automation Tunnel Installation" "${WHITE}"
  lane_bawah
  echo ""
}

header_install() {
  clear
  echo ""
  lane_atas
  tengah "$1"
  lane_bawah
  echo ""
}

banner

if [[ $(uname -m) != "x86_64" ]]; then 
  msg_err "Arsitektur tidak didukung! Wajib x86_64."
  exit 1
else
  msg_info "Your Architecture is ${YELLOW}$(uname -m)${RESET}"
fi

if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then 
  msg_err "OS tidak didukung! Wajib Ubuntu/Debian."
  exit 1
else
  msg_info "Your OS is ${YELLOW}$PRETTY_NAME${RESET}"
fi

if [[ "$EUID" -ne 0 ]]; then 
  msg_err "Harap jalankan script sebagai root!"
fi

if [[ "$(systemd-detect-virt)" == "openvz" ]]; then 
  msg_err "Virtualisasi tidak didukung!"
  exit 1
else
  msg_info "Your Virtualisation is ${YELLOW}$(systemd-detect-virt)${RESET}"
fi

while IFS=":" read -r a b; do
  case $a in
    "MemTotal") 
      ((mem_used+=${b/kB}))
      mem_total="${b/kB}" 
      ;;
    "Shmem") 
      ((mem_used+=${b/kB}))  
      ;;
    "MemFree" | "Buffers" | "Cached" | "SReclaimable") 
      mem_used="$((mem_used-=${b/kB}))" 
      ;;
  esac
done < /proc/meminfo

sleep 3

make_folder() {
  mkdir -p /etc/{xray,vmess,vless,trojan,shadowsocks,ssh,udp,bot,github}
  mkdir -p /etc/kyt/limit/{vmess,vless,trojan,ssh}/ip
  mkdir -p /etc/limit/{vmess,vless,trojan,ssh}
  mkdir -p /etc/{udp,slowdns}
  mkdir -p /usr/bin/xray /var/log/xray /var/www/html /var/lib/kyt
  
  touch /etc/{xray/domain,vmess/.vmess.db,vless/.vless.db,trojan/.trojan.db,shadowsocks/.shadowsocks.db,ssh/.ssh.db,bot/.bot.db}
  touch /var/log/xray/{access.log,error.log}
  
  for proto in vmess vless trojan shadowsocks ssh; do
    echo "& plughin Account" >> /etc/${proto}/.${proto}.db
  done
  
  echo "$MYIP" > /etc/xray/ipvps
  echo "$CITY" > /etc/xray/city
  echo "$ISP" > /etc/xray/isp
  echo "$client" > /etc/xray/user_client
  echo "$name" > /etc/xray/username
}

first_setup() {
  header_install "FIRST SETUP"
  timedatectl set-timezone Asia/Jakarta
  echo iptables-persistent iptables-persistent/autosave_v4 boolean true | debconf-set-selections
  echo iptables-persistent iptables-persistent/autosave_v6 boolean true | debconf-set-selections
  apt install haproxy nginx -y
}

base_package() {
  header_install "BASE PACKAGES"
  apt dist-upgrade -y
  apt install -y at zip pwgen openssl socat cron bash-completion figlet ntpdate \
    debconf-utils util-linux bsdmainutils software-properties-common \
    gawk iptables iptables-persistent netfilter-persistent ruby \
    libxml-parser-perl squid nmap screen curl jq bzip2 gzip coreutils \
    rsyslog iftop htop unzip net-tools sed gnupg gnupg1 bc \
    apt-transport-https build-essential dirmngr neofetch lsof \
    openvpn easy-rsa fail2ban tmux xz-utils dnsutils lsb-release \
    chrony libnss3-dev libnspr4-dev pkg-config libpam0g-dev \
    libcap-ng-dev libcap-ng-utils libselinux1-dev libcurl4-openssl-dev \
    flex bison make libnss3-tools libevent-dev xl2tpd apt git \
    speedtest-cli p7zip-full libjpeg-dev zlib1g-dev python3-full \
    shc nodejs php php-fpm php-cli php-mysql \
    libsqlite3-dev vnstat
  
  apt purge -y apache2 stunnel4 stunnel ufw firewalld exim4
  apt autoremove -y && apt clean
  
  ntpdate pool.ntp.org
  systemctl enable chrony --now
}

install_domain() {
  header_install "CONFIGURE DOMAIN"
  
  if [[ "$domain_input" == "random" ]]; then
    SUBDOMAIN="$(tr -dc 'a-z0-9' </dev/urandom | head -c5)"
    host1="$SUBDOMAIN.$DOMAINAUTO"
    
    wget -qO pointing.sh ${REPO}install/pointing.sh
    chmod +x pointing.sh "${host1}"
    ./pointing.sh
    rm -f pointing.sh
  else
    host1="$domain_input"
  fi
  
  echo "$host1" > /etc/xray/domain
  echo "IP=$host1" > /var/lib/kyt/ipvps.conf
  export domain=$(cat /etc/xray/domain)
  
  msg_info "Your Domain is ${YELLOW}$domain${RESET}"
  sleep 3
}

install_certificate() {
  header_install "CREATE SSL CERTIFICATE"
  
  systemctl stop nginx haproxy
  
  mkdir -p /root/.acme.sh
  curl -s https://get.acme.sh | sh -s email=${EMAILGIT}
  
  /root/.acme.sh/acme.sh --upgrade --auto-upgrade
  /root/.acme.sh/acme.sh --set-default-ca --server letsencrypt
  /root/.acme.sh/acme.sh --issue -d $domain --standalone -k ec-256
  /root/.acme.sh/acme.sh --installcert -d $domain --fullchainpath /etc/xray/xray.crt --keypath /etc/xray/xray.key --ecc
  
  chmod 777 /etc/xray/xray.key
}

install_xray() {
  header_install "INSTALL XRAY CORE"
  
  mkdir -p /run/xray
  chown www-data:www-data /run/xray
  
  bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
  wget -qO /etc/xray/config.json "${REPO}install/newbie.json"
    
  cat > /etc/systemd/system/runn.service <<EOF
[Unit]
Description=casper9
After=network.target

[Service]
Type=simple
ExecStartPre=-/usr/bin/mkdir -p /var/run/xray
ExecStart=/usr/bin/chown www-data:www-data /var/run/xray
Restart=on-abort

[Install]
WantedBy=multi-user.target
EOF
  
  wget -qO /etc/haproxy/haproxy.cfg "${REPO}install/haproxy.cfg"
  wget -qO /etc/nginx/conf.d/xray.conf "${REPO}install/xray.conf"
  wget -qO /etc/nginx/nginx.conf "${REPO}install/nginx.conf"
  
  sed -i "s/xxx/${domain}/g" /etc/haproxy/haproxy.cfg /etc/nginx/conf.d/xray.conf
  cat /etc/xray/xray.crt /etc/xray/xray.key > /etc/haproxy/hap.pem
  
  cat > /etc/systemd/system/xray.service <<EOF
[Unit]
Description=Xray Service
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
}

install_ssh() {
  header_install "CONFIGURE SSH & ROUTING"
  
  wget -qO /etc/pam.d/common-password "${REPO}install/passwordssh"
  chmod +x /etc/pam.d/common-password
  
  sed -i 's/AcceptEnv/#AcceptEnv/g' /etc/ssh/sshd_config
    sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/g' /etc/ssh/sshd_config
    
  sed -i 's/^#.*Port 22.*/Port 22/g' /etc/ssh/sshd_config

  for port in 22 200 500 40000 51443 58080; do
    grep -q "^Port $port" /etc/ssh/sshd_config || echo "Port $port" >> /etc/ssh/sshd_config
  done

  
  echo "Banner /etc/issue.net" >> /etc/ssh/sshd_config
  wget -qO /etc/issue.net "${REPO}install/issue.net"
  
  apt install dropbear -y
  wget -qO /etc/default/dropbear "${REPO}install/dropbear"
  
  wget -qO installsl.sh "${REPO}slowdns/installsl.sh"
  chmod +x installsl.sh
  ./installsl.sh "ns-$domain"
  rm installsl.sh
  
  wget -qO insshws.sh "${REPO}sshws/insshws.sh"
  chmod +x insshws.sh
  ./insshws.sh
  rn insshws.sh
  
  wget -qO /usr/local/share/xray/geosite.dat "https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geosite.dat"
  wget -qO /usr/local/share/xray/geoip.dat "https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/geoip.dat"
  
  # Torrent Block Rules
  for str in "get_peers" "announce_peer" "find_node" "BitTorrent" "BitTorrent protocol" "peer_id=" ".torrent" "announce.php?passkey=" "torrent" "announce" "info_hash"; do
    iptables -A FORWARD -m string --algo bm --string "$str" -j DROP
  done
  
  iptables-save > /etc/iptables.up.rules
  iptables-restore -t < /etc/iptables.up.rules
}

install_extra() {
  header_install "EXTRA MODULES"
  
  wget -qO limit.sh "${REPO}install/limit.sh"
  chmod +x limit.sh
  ./limit.sh
  rm limit.sh
  
  wget -qO /usr/bin/limit-ip "${REPO}install/limit-ip"
  chmod +x /usr/bin/limit-ip
  sed -i 's/\r//' /usr/bin/limit-ip
  
  for srv in vmip vlip trip; do
    cat > /etc/systemd/system/${srv}.service <<EOF
[Unit]
Description=Limit IP Service $srv
After=network.target
[Service]
ExecStart=/usr/bin/limit-ip $srv
Restart=always
[Install]
WantedBy=multi-user.target
EOF
  done
  
  wget -qO /usr/sbin/badvpn "${REPO}install/badvpn"
  chmod +x /usr/sbin/badvpn
  for i in 1 2 3; do 
    wget -qO /etc/systemd/system/badvpn${i}.service "${REPO}install/badvpn${i}.service"
  done
  
  wget -qO vpn.sh "${REPO}install/vpn.sh"
  chmod +x vpn.sh
  ./vpn.sh
  
  dd if=/dev/zero of=/swapfile bs=1024 count=1048576
  mkswap /swapfile
  chmod 0600 /swapfile
  swapon /swapfile
  sed -i '$ i\/swapfile      swap swap   defaults    0 0' /etc/fstab
  
  wget -qO bbr.sh "${REPO}install/bbr.sh"
  chmod +x bbr.sh
  ./bbr.sh
  
  wget https://humdi.net/vnstat/vnstat-2.13.tar.gz
  tar zxvf vnstat-2.13.tar.gz
  cd vnstat-2.13
  ./configure --prefix=/usr --sysconfdir=/etc && make && make install
  cd
  vnstat -u -i $NET
  sed -i "s/Interface \"eth0\"/Interface \"$NET\"/g" /etc/vnstat.conf
  chown vnstat:vnstat /var/lib/vnstat -R
  systemctl enable vnstat
  systemctl restart vnstat
  rm -f /root/vnstat-2.13.tar.gz
  rm -rf /root/vnstat-2.13
  
  wget -qO udp-custom.sh "${REPO}install/udp-custom.sh"
  chmod +x udp-custom.sh
  ./udp-custom.sh
  rm udp-custom.sh
}

setup_cron_rc() {
  header_install "CONFIGURE CRONJOB"
  
  cat > /root/.profile <<EOF
if [ "\$BASH" ]; then 
  if [ -f ~/.bashrc ]; then 
    . ~/.bashrc
  fi
fi
mesg n || true
menu
EOF

  wget -qO /usr/bin/autocpu "${REPO}install/autocpu.sh"
  chmod +x /usr/bin/autocpu
  
  wget -qO update.sh "${REPO}menu/update.sh"
  chmod +x update.sh
  ./update.sh
  
  cat > /etc/cron.d/vpn_jobs << EOF
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
0 0 * * * root /usr/bin/xp
0 22 * * * root /usr/bin/backup
*/5 * * * * root /usr/bin/autocpu
1 0 * * * root /usr/bin/expsc
5 0 * * * root /sbin/reboot
*/10 * * * * root truncate -s 0 /var/log/syslog && truncate -s 0 /var/log/nginx/error.log && truncate -s 0 /var/log/nginx/access.log && truncate -s 0 /var/log/xray/error.log && truncate -s 0 /var/log/xray/access.log
EOF

  cat > /etc/rc.local <<EOF
#!/bin/bash
iptables -I INPUT -p udp --dport 5300 -j ACCEPT
iptables -t nat -I PREROUTING -p udp --dport 53 -j REDIRECT --to-ports 5300
systemctl restart netfilter-persistent
exit 0
EOF
  chmod +x /etc/rc.local
}

apply_sysctl() {
  local sys="/etc/sysctl.conf"
  sed -i '/fs.file-max/d' $sys
  echo "fs.file-max = 65535" >> $sys
  
  sed -i '/net.netfilter.nf_conntrack_max/d' $sys
  echo "net.netfilter.nf_conntrack_max=262144" >> $sys
  
  sed -i '/net.netfilter.nf_conntrack_tcp_timeout_time_wait/d' $sys
  echo "net.netfilter.nf_conntrack_tcp_timeout_time_wait=30" >> $sys
  
  sysctl -p >/dev/null 2>&1
}

finalize_services() {
  header_install "RESTART & ENABLE SERVICES"
  
  systemctl daemon-reload
  for svc in nginx xray runn dropbear openvpn cron haproxy netfilter-persistent ws fail2ban udp-custom vnstat badvpn1 badvpn2 badvpn3 rc-local; do
    systemctl enable --now $svc >/dev/null 2>&1
    systemctl restart $svc >/dev/null 2>&1
  done
  /etc/init.d/ssh restart
}

make_folder
first_setup
base_package
install_domain
install_certificate
install_xray
install_ssh
install_extra
setup_cron_rc
apply_sysctl
finalize_services

URL="https://api.telegram.org/bot${KEY}/sendMessage"
TEXT="<code>───────────────</code>%0A<b>🟢 NOTIFICATIONS INSTALL 🟢</b>%0A<code>───────────────</code>%0A<code>Domain : $domain</code>%0A<code>IP VPS : $MYIP</code>%0A<code>OS     : $PRETTY_NAME</code>%0A<code>Time   : $(date)</code>%0A<code>───────────────</code>"
curl -s --max-time 10 -d "chat_id=$CHATID&disable_web_page_preview=1&text=$TEXT&parse_mode=html" "$URL" >/dev/null

# --- Pembersihan Sistem ---
history -c
echo "unset HISTFILE" >> /etc/profile
rm -rf /root/{menu,*.zip,*.sh,LICENSE,README.md,domain,*.log,openvpn,key.pem,cert.pem}

sudo hostnamectl set-hostname "$name"
grep -q "$name" /etc/hosts || echo "127.0.1.1    $name" >> /etc/hosts

clear
echo ""
lane_atas
tengah "INSTALLATION SUCCESS" "${BGREEN}${WHITE}${BOLD}"
lane_tengah
tengah "Domain : $domain" "${WHITE}"
tengah "IP VPS : $MYIP" "${WHITE}"
lane_tengah
tengah "Server Rebooting..." "${YELLOW}"
lane_bawah
echo ""

sleep 2
reboot