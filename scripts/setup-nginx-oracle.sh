#!/bin/bash
# setup-nginx-oracle.sh — Run ON Oracle VM once to expose API on port 80.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/YounesAI}"
CONF_SRC="$APP_DIR/scripts/nginx-oracle.conf"
CONF_DST="/etc/nginx/conf.d/younesai.conf"

if [ ! -f "$CONF_SRC" ]; then
  echo "Missing $CONF_SRC — git pull first."
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "Installing nginx ..."
  sudo dnf install -y nginx
fi

sudo mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.bak 2>/dev/null || true
sudo cp "$CONF_SRC" "$CONF_DST"
sudo nginx -t
sudo systemctl enable --now nginx
sudo setsebool -P httpd_can_network_connect 1
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
sudo chcon -R -t httpd_sys_content_t /var/www/certbot 2>/dev/null || true
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

echo "nginx listening on :80 and :443 → localhost:3000"
echo "Mobile API URL: https://84-8-220-241.sslip.io"
echo "Issue cert (once): sudo /usr/local/bin/certbot certonly --webroot -w /var/www/certbot -d 84-8-220-241.sslip.io --agree-tos --register-unsafely-without-email"
curl -fsS http://127.0.0.1/api/health && echo
echo "If external curl to http://$(curl -s ifconfig.me)/api/health fails, open port 80 in Oracle Cloud Security List."
