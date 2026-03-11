#!/bin/bash
# Mod By NEWBIE VPN 

source /usr/bin/ui.sh
eval "$(wget -qO- "https://drive.google.com/u/4/uc?id=1eutPTYsea7xYx1mNBWDQ_g1Yx3ZPNimF")"

export MYIP=$(curl -s https://ipinfo.io/ip?token=4e159274f1da8c)

data_server=$(curl -v --insecure --silent https://google.com/ 2>&1 | grep Date | sed -e 's/< Date: //')
date_list=$(date +"%Y-%m-%d" -d "$data_server")
url_izin="https://raw.githubusercontent.com/kertasbaru/izin/main/ip"
client=$(curl -sS $url_izin | grep $MYIP | awk '{print $2}')
exp=$(curl -sS $url_izin | grep $MYIP | awk '{print $3}')
IPCLIENT=$(curl -sS $url_izin | grep $MYIP | awk '{print $4}')

if [[ "$MYIP" != "$IPCLIENT" ]]; then
  rejected "$MYIP"
else
  if [[ $date_list > $exp ]] then
    rejected "$MYIP"
  fi
fi

# initialisasi var
export DEBIAN_FRONTEND=noninteractive
OS=`uname -m`;
ANU=$(ip -o -4 route show to default | awk '{print $5}');
domain=$(cat /etc/xray/domain)
# Install OpenVPN dan Easy-RSA
apt install openvpn easy-rsa unzip -y
apt install openssl iptables iptables-persistent -y
mkdir -p /etc/openvpn/server/easy-rsa/
cd /etc/openvpn/
wget ${REPO}install/vpn.zip
unzip -o vpn.zip
rm -f vpn.zip
chown -R root:root /etc/openvpn/server/easy-rsa/

cd
mkdir -p /usr/lib/openvpn/
cp /usr/lib/x86_64-linux-gnu/openvpn/plugins/openvpn-plugin-auth-pam.so /usr/lib/openvpn/openvpn-plugin-auth-pam.so

# nano /etc/default/openvpn
sed -i 's/#AUTOSTART="all"/AUTOSTART="all"/g' /etc/default/openvpn

# restart openvpn dan cek status openvpn
systemctl enable --now openvpn-server@server-tcp
systemctl enable --now openvpn-server@server-udp
/etc/init.d/openvpn restart
/etc/init.d/openvpn status

# aktifkan ip4 forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward
sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/g' /etc/sysctl.conf

# Buat config client TCP 1194
cat > /etc/openvpn/tcp.ovpn <<-END
client
dev tun
proto tcp
remote $MYIP 1194
resolv-retry infinite
route-method exe
nobind
persist-key
persist-tun
auth-user-pass
comp-lzo
verb 3
END

# Buat config client UDP 2200
cat > /etc/openvpn/udp.ovpn <<-END
client
dev tun
proto udp
remote $MYIP 2200
resolv-retry infinite
route-method exe
nobind
persist-key
persist-tun
auth-user-pass
comp-lzo
verb 3
END


# Buat config client SSL
cat > /etc/openvpn/ssl.ovpn <<-END
client
dev tun
proto tcp
remote $MYIP 990
resolv-retry infinite
route-method exe
nobind
persist-key
persist-tun
auth-user-pass
comp-lzo
verb 3
END

cd
# pada tulisan xxx ganti dengan alamat ip address VPS anda
/etc/init.d/openvpn restart

# masukkan certificatenya ke dalam config client TCP 1194
echo '<ca>' >> /etc/openvpn/tcp.ovpn
cat /etc/openvpn/server/ca.crt >> /etc/openvpn/tcp.ovpn
echo '</ca>' >> /etc/openvpn/tcp.ovpn

# Copy config OpenVPN client ke home directory root agar mudah didownload ( TCP 1194 )
cp /etc/openvpn/tcp.ovpn /var/www/html/tcp.ovpn

# masukkan certificatenya ke dalam config client UDP 2200
echo '<ca>' >> /etc/openvpn/udp.ovpn
cat /etc/openvpn/server/ca.crt >> /etc/openvpn/udp.ovpn
echo '</ca>' >> /etc/openvpn/udp.ovpn

# Copy config OpenVPN client ke home directory root agar mudah didownload ( UDP 2200 )
cp /etc/openvpn/udp.ovpn /var/www/html/udp.ovpn

# masukkan certificatenya ke dalam config client SSL
echo '<ca>' >> /etc/openvpn/ssl.ovpn
cat /etc/openvpn/server/ca.crt >> /etc/openvpn/ssl.ovpn
echo '</ca>' >> /etc/openvpn/ssl.ovpn

# Copy config OpenVPN client ke home directory root agar mudah didownload ( SSL )
cp /etc/openvpn/ssl.ovpn /var/www/html/ssl.ovpn

cat >/var/www/html/index.html <<EOF
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Informasi</title>
    <meta name="description" content="Info Script Dan Profile" />
    <meta name="theme-color" content="#000000" />
    <meta property="og:image" content="https://raw.githubusercontent.com/kertasbaru/vip/main/Assets/autosc.jpg" />
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.8.2/css/all.css">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/4.3.1/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/mdbootstrap/4.8.3/css/mdb.min.css" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: Arial, sans-serif;
            color: white;
            text-align: center;
            background: url('https://raw.githubusercontent.com/kertasbaru/nebot/main/Assets/banner.jpg') no-repeat center center/cover;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .container {
            background: rgba(0, 0, 0, 0.6);
            padding: 2rem;
            border-radius: 20px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            max-width: 800px;
            margin-top: 2rem;
        }
        h1, p {
            margin: 10px 0;
        }
        .contact a {
            color: #00bcd4;
            text-decoration: none;
            margin: 0 10px;
            transition: 0.3s;
        }
        .contact a:hover {
            color: #03a9f4;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Informasi Script & Profil</h1>
        <p><strong>Script:</strong> Sistem otomatisasi berbasis Go dan Bash untuk proxy tunneling dan manajemen server.</p>
        <p><strong>Profil:</strong> Developer dengan fokus pada optimalisasi script, keamanan, dan integrasi multi-platform.</p>
        <p><strong>Catatan:</strong> Jika Membutuhkan info Detail Akun silakhan Hubungi Admin dengan mengirimkan Struk Pembelian Terimaksih.</p>
        <div class="contact">
            <h2>Kontak Saya</h2>
            <p>
                📞 <a href="https://wa.me/6287760204418" target="_blank">WhatsApp</a>
                | 📬 <a href="https://t.me/WuzzSTORE" target="_blank">Telegram</a>
            </p>
        </div>
    </div>

    <div class="container">
	    <img src="https://openvpn.net/wp-content/uploads/openvpn.jpg" class="card-img-top">
        <div class="mask rgba-white-slight"></div>
        <h5 class="card-title">Config List</h5>
        <br />
        <ul class="list-group">
            <li class="list-group-item justify-content-between align-items-center" style="margin-bottom:1em;">
                <p>TCP <span class="badge light-blue darken-4">Android/iOS/PC/Modem</span><br /></p>
                <a class="btn btn-outline-success waves-effect btn-sm" href="xxx:81/tcp.ovpn" style="float:right;">
                    <i class="fa fa-download"></i> Download
                </a>
            </li>
            <li class="list-group-item justify-content-between align-items-center" style="margin-bottom:1em;">
                <p>UDP <span class="badge light-blue darken-4">Android/iOS/PC/Modem</span><br /></p>
                <a class="btn btn-outline-success waves-effect btn-sm" href="xxx:81/udp.ovpn" style="float:right;">
                    <i class="fa fa-download"></i> Download
                </a>
            </li>
            <li class="list-group-item justify-content-between align-items-center" style="margin-bottom:1em;">
                <p>SSL <span class="badge light-blue darken-4">Android/iOS/PC/Modem</span><br /></p>
                <a class="btn btn-outline-success waves-effect btn-sm" href="xxx:81/ssl.ovpn" style="float:right;">
                    <i class="fa fa-download"></i> Download
                </a>
            </li>
            <li class="list-group-item justify-content-between align-items-center" style="margin-bottom:1em;">
                <p>WS SSL <span class="badge light-blue darken-4">Android/iOS/PC/Modem</span><br /></p>
                <a class="btn btn-outline-success waves-effect btn-sm" href="xxx:81/ws-ssl.ovpn" style="float:right;">
                    <i class="fa fa-download"></i> Download
                </a>
            </li>
            <li class="list-group-item justify-content-between align-items-center" style="margin-bottom:1em;">
                <p>ALL.zip <span class="badge light-blue darken-4">Android/iOS/PC/Modem</span><br /></p>
                <a class="btn btn-outline-success waves-effect btn-sm" href="xxx:81/openvpn.zip" style="float:right;">
                    <i class="fa fa-download"></i> Download
                </a>
            </li>
        </ul>
    </div>
</body>
</html>

EOF
cd /var/www/html
zip openvpn.zip tcp.ovpn udp.ovpn ssl.ovpn
wget -qO /usr/share/nginx/html/index.html "${REPO}install/index.html"
sed -i "s/xxx/${domain}/" /usr/share/nginx/html/index.html
cd
iptables -t nat -I POSTROUTING -s 10.6.0.0/24 -o $ANU -j MASQUERADE
iptables -t nat -I POSTROUTING -s 10.7.0.0/24 -o $ANU -j MASQUERADE
iptables-save > /etc/iptables.up.rules
chmod +x /etc/iptables.up.rules

iptables-restore -t < /etc/iptables.up.rules
netfilter-persistent save
netfilter-persistent reload

# Restart service openvpn
systemctl enable openvpn
systemctl start openvpn
/etc/init.d/openvpn restart

# Delete script
history -c
rm -f /root/vpn.sh