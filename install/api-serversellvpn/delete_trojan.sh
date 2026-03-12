#!/bin/bash
user=$1
	if ! grep -qwE "^#! $user" /etc/xray/config.json; then
    echo -e "User $user Tidak Ditemukan!!"
    exit 1
    else
    uuid=$(grep -wE "$user" "/etc/xray/config.json" | cut -d '"' -f 4 | tail -n1)
    exp=$(grep -wE "^#! $user" "/etc/xray/config.json" | cut -d ' ' -f 3 | sort | uniq)
    sed -i "/^#! $user $exp/,/^},{/d" /etc/xray/config.json
    echo "#! $user $uuid" >> /etc/xray/.userall.db
	sed -i "/^### $user $exp/,/^},{/d" /etc/trojan/.trojan.db
    rm -rf /etc/trojan/$user
    rm -rf /etc/kyt/limit/trojan/ip
	rm -rf /var/www/html/trojan-$user.txt
    systemctl restart xray > /dev/null 2>&1
    clear
    echo -e "${WHITEBLD}    Client Name : $user ${NC}"
    echo -e "${WHITEBLD}    Expired On  : $exp  ${NC}"
    fi