# Cyntwix on a Raspberry Pi 5

This setup runs the public site through Nginx and stores shared submissions in
SQLite. The Python API uses only the standard library, so there are no pip
packages or application dependencies to maintain.

## 1. Hardware

- Raspberry Pi 5
- Official 27W USB-C power supply
- Active Cooler or the official fan case
- 32GB or larger high-endurance microSD card; an NVMe or USB SSD is even better
  for a long-running public server
- Ethernet connection if practical

Raspberry Pi recommends the 27W supply and active cooling for Pi 5. Its official
documentation also supports booting from storage other than microSD.

## 2. Image the operating system

1. Install Raspberry Pi Imager from:
   <https://www.raspberrypi.com/software/>
2. Insert the microSD card or SSD into your computer.
3. In Imager choose:
   - Device: **Raspberry Pi 5**
   - OS: **Raspberry Pi OS Lite (64-bit)**
   - Storage: the card or SSD you inserted
4. Open **OS customisation** before writing:
   - Hostname: `cyntwix`
   - Create your administrator username and a strong password
   - Add Wi-Fi details only if you are not using Ethernet
   - Set your locale and time zone
   - Enable SSH
   - Prefer public-key authentication; Imager can create or import a key
5. Write and verify the image, safely eject it, install it in the Pi, connect
   Ethernet, cooling, and power, then allow a couple of minutes for first boot.

Official imaging and SSH instructions:
<https://www.raspberrypi.com/documentation/computers/getting-started.html>

## 3. First login

From Terminal on your Mac or PC, replace `YOUR_USER` with the user created in
Imager:

```sh
ssh YOUR_USER@cyntwix.local
```

Update the Pi and reboot:

```sh
sudo apt update
sudo apt full-upgrade -y
sudo reboot
```

Reconnect after a minute:

```sh
ssh YOUR_USER@cyntwix.local
```

Install the small set of system packages used by the deployment:

```sh
sudo apt install -y nginx rsync sqlite3 certbot python3-certbot-nginx
```

## 4. Copy the site to the Pi

Run this from the computer that contains the `cyntwix` folder, not from the Pi:

```sh
rsync -av --exclude '.DS_Store' --exclude 'var/' \
  /Users/asiismets/Documents/cyntwix/ \
  YOUR_USER@cyntwix.local:/tmp/cyntwix/
```

Then SSH into the Pi and install the files:

```sh
sudo mkdir -p /srv/cyntwix /var/lib/cyntwix
sudo rsync -a --delete /tmp/cyntwix/ /srv/cyntwix/
sudo chown -R root:root /srv/cyntwix
sudo chown -R www-data:www-data /var/lib/cyntwix
sudo chmod 750 /var/lib/cyntwix

sudo install -m 0644 /srv/cyntwix/deploy/cyntwix.service \
  /etc/systemd/system/cyntwix.service
sudo install -m 0644 /srv/cyntwix/deploy/nginx-cyntwix.conf \
  /etc/nginx/sites-available/cyntwix
sudo ln -sfn /etc/nginx/sites-available/cyntwix \
  /etc/nginx/sites-enabled/cyntwix
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now cyntwix nginx
```

The database is created automatically at `/var/lib/cyntwix/entries.db`. It is
kept outside the website folder, so copying a new version of the site will not
overwrite submissions.

## 5. Test it on the local network

On the Pi:

```sh
curl http://127.0.0.1:8000/api/health
systemctl status cyntwix --no-pager
systemctl status nginx --no-pager
```

The health request should return `{"ok":true}`. On another device connected to
the same network, open:

```text
http://cyntwix.local
```

Make a writing submission, then open the Entries page in a private/incognito
window or on a second device. The same submission should appear there.

Useful logs:

```sh
sudo journalctl -u cyntwix -f
sudo tail -f /var/log/nginx/error.log
```

## 6. Put it on the public internet

Do this only after the local-network test passes.

1. Give the Pi a DHCP reservation in your router so its local IP does not
   change.
2. Point the DNS `A` records for `siismets.com` and `www.siismets.com` to your
   home public IPv4 address. If that address changes periodically, use a dynamic
   DNS updater.
3. Forward TCP ports 80 and 443 in the router to the Pi's reserved local IP.
   Do **not** forward SSH port 22.
4. If your ISP uses CGNAT and does not provide a public address, ordinary port
   forwarding will not work. Ask the ISP for a public IP or use a trusted tunnel
   service.
5. After DNS resolves to your home, obtain HTTPS certificates:

```sh
sudo certbot --nginx -d siismets.com -d www.siismets.com
sudo certbot renew --dry-run
```

Nginx uses a request limit and the API also limits repeated submissions. These
are basic protections, not full moderation. A public submission site should be
checked periodically for spam and abusive content.

Nginx reverse-proxy documentation:
<https://nginx.org/en/docs/http/ngx_http_proxy_module.html>

## 7. Backups and updates

Back up the live database:

```sh
sudo mkdir -p /var/backups/cyntwix
sudo sqlite3 /var/lib/cyntwix/entries.db \
  ".backup '/var/backups/cyntwix/entries-backup.db'"
```

Copy the backup off the Pi occasionally. The SD card or SSD is still a single
point of failure.

To deploy later code changes, run the same `rsync` command from your computer,
then on the Pi:

```sh
sudo rsync -a --delete /tmp/cyntwix/ /srv/cyntwix/
sudo chown -R root:root /srv/cyntwix
sudo systemctl restart cyntwix
sudo nginx -t && sudo systemctl reload nginx
```

The database remains untouched because it lives in `/var/lib/cyntwix`.
