#!/bin/bash
# deploy-oracle.sh — Run ON Oracle VM after you `git push` from local.
# Automates: git pull → npm ci → migrate → restart (pm2/docker/systemd) → healthcheck
# Usage:  chmod +x scripts/deploy-oracle.sh
#         ./scripts/deploy-oracle.sh            # pulls main
#         ./scripts/deploy-oracle.sh develop    # pulls other branch
#         BRANCH=main APP_DIR=~/YounesAI ./scripts/deploy-oracle.sh

set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/YounesAI}"
BRANCH="${1:-${BRANCH:-main}}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
LOCK_FILE="/tmp/deploy-oracle.lock"

# ——— helpers ———
info()  { echo -e "\033[1;34m[deploy]\033[0m $*"; }
ok()    { echo -e "\033[1;32m[ok]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[warn]\033[0m $*"; }
fail()  { echo -e "\033[1;31m[fail]\033[0m $*"; }

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  fail "Another deploy is running (lock $LOCK_FILE). Aborting."
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  fail "No git repo at $APP_DIR. Set APP_DIR correctly."
  exit 1
fi

cd "$APP_DIR"
info "App dir: $APP_DIR | Branch: $BRANCH | Health: $HEALTH_URL"

# 1. Preserve .env (never commit it)
if [ -f backend/.env ]; then
  cp backend/.env /tmp/younesai.env.bak
  ok "Backed up backend/.env → /tmp/younesai.env.bak"
fi

# 2. Git pull — stash any local env/untracked noise, keep .env untouched
info "Fetching origin/$BRANCH ..."
git fetch origin "$BRANCH"
# Stash only if dirty (ignores untracked)
if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "Working tree dirty — stashing"
  git stash push -m "deploy-oracle auto stash $(date +%s)" --keep-index || true
fi
info "Pulling --ff-only ..."
git pull --ff-only origin "$BRANCH"
REV="$(git rev-parse --short HEAD)"
ok "Now at $REV ($(git log -1 --oneline))"

# Restore .env if pull overwrote it (shouldn't, it's gitignored, but be safe)
if [ -f /tmp/younesai.env.bak ] && ! cmp -s /tmp/younesai.env.bak backend/.env 2>/dev/null; then
  warn "Restoring backend/.env from backup"
  cp /tmp/younesai.env.bak backend/.env
fi

# 3. Install + migrate (backend only — frontend deploy is separate)
if [ -f backend/package.json ]; then
  info "Installing backend deps ..."
  cd backend
  if command -v npm >/dev/null 2>&1; then
    npm ci --omit=dev || npm install --omit=dev
  else
    warn "npm not found — skipping install"
  fi
  info "Running DB migrations ..."
  npm run migrate 2>&1 | tail -n 50 || warn "migrate failed — check backend/src/migrate.js"
  # optional email migrations (no-op if not needed)
  npm run migrate:email 2>&1 | tail -n 20 || true
  cd "$APP_DIR"
else
  warn "No backend/package.json — skipping install/migrate"
fi

# 4. Restart — auto-detect runtime
RESTARTED=""

if command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ] && docker compose version >/dev/null 2>&1; then
  # Prefer docker compose if compose file present and docker running
  if docker compose ps 2>/dev/null | grep -q backend; then
    info "Restarting via docker compose ..."
    docker compose up -d --build backend
    RESTARTED="docker"
  fi
fi

if [ -z "$RESTARTED" ] && command -v pm2 >/dev/null 2>&1; then
  if pm2 list 2>/dev/null | grep -q "younesai"; then
    info "Restarting via pm2 ..."
    pm2 restart younesai-backend --update-env 2>/dev/null || pm2 restart all --update-env
    pm2 save >/dev/null 2>&1 || true
    RESTARTED="pm2"
  elif pm2 list 2>/dev/null | grep -q "online"; then
    info "pm2 found — restarting all ..."
    pm2 restart all --update-env
    RESTARTED="pm2-all"
  fi
fi

if [ -z "$RESTARTED" ] && systemctl is-active --quiet younesai 2>/dev/null; then
  info "Restarting via systemd ..."
  sudo systemctl restart younesai
  RESTARTED="systemd"
fi

if [ -z "$RESTARTED" ]; then
  warn "No pm2/docker/systemd detected. Trying bare node restart (kill + npm start) ..."
  # fallback: try to kill old node and start detached (tmux/screen-style)
  pkill -f "node src/index.js" || true
  if [ -f backend/package.json ]; then
    info "Starting backend in background (nohup) ..."
    (cd backend && nohup npm start >/tmp/younesai.log 2>&1 &)
    RESTARTED="nohup"
  fi
fi

ok "Restarted via: ${RESTARTED:-unknown}"

# 5. Healthcheck (wait up to 30s)
info "Waiting for $HEALTH_URL ..."
for i in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    ok "Healthcheck passed (attempt $i)"
    curl -s "$HEALTH_URL" | head -c 300; echo
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    fail "Healthcheck failed after 30s — check logs:"
    if [ "$RESTARTED" = "docker" ]; then docker logs --tail 50 younesai-backend 2>&1 | tail -n 50 || true; fi
    if [ "$RESTARTED" = "pm2" ] || [ "$RESTARTED" = "pm2-all" ]; then pm2 logs --lines 50 --nostream 2>&1 | tail -n 50 || true; fi
    if [ -f /tmp/younesai.log ]; then tail -n 50 /tmp/younesai.log || true; fi
    exit 1
  fi
done

ok "Deploy $REV done."
echo "Tip: tail logs with:  pm2 logs  |  docker logs -f younesai-backend  |  tail -f /tmp/younesai.log"
