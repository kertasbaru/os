#!/bin/bash
user=$1
if ! getent passwd "$user" >/dev/null 2>&1 || [ -z "$user" ]; then
    echo -e "Failure: User $user tidak ditemukan."
exit 1
else
    userdel "$user" >/dev/null 2>&1
    sed -i "/^$user:/d" /etc/group
    exp=$(grep -w "^#ssh# $user" "/etc/ssh/.ssh.db" | awk '{print $3}' | sort -u)
    grep -wE "^#ssh# $user" "/etc/ssh/.ssh.db" | awk '{print $1" "$2" "$3}' | sort -u | tail -1 >> /etc/xray/.userall.db
    sed -i "/^#ssh# $user/d" /etc/ssh/.ssh.db
    rm -f "/etc/ssh/$user"
    rm -f "/etc/kyt/limit/ssh/ip/${user}"
    rm -f "/var/www/html/ssh-$user.txt"

    echo -e "User $user berhasil dihapus."
fi

