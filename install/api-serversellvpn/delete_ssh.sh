#!/bin/bash
user=$1
if [ -z "$user" ] || ! getent passwd "$user" >/dev/null 2>&1; then
    echo -e "Failure: User $user tidak ditemukan."
exit 1
else
    userdel "$user" >/dev/null 2>&1
    sed -i "/^$user:/d" /etc/group
    exp=$(grep -w "^### $user" "/etc/xray/ssh" | awk '{print $3}' | sort -u)
    grep -wE "^### $user" "/etc/xray/ssh" | awk '{print $1" "$2" "$3}' | sort -u | tail -1 >> /etc/xray/.userall.db
    sed -i "/^### $user/d" /etc/xray/ssh
    rm -f "/etc/kyt/limit/ssh/ip/${user}"
    rm -f "/var/www/html/ssh-$user.txt"

    echo -e "User $user berhasil dihapus."
fi
