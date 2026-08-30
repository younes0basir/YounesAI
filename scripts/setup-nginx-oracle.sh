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
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload

echo "nginx listening on :80 → localhost:3000"
curl -fsS http://127.0.0.1/api/health && echo
echo "If external curl to http://$(curl -s ifconfig.me)/api/health fails, open port 80 in Oracle Cloud Security List."
