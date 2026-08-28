#!/bin/bash
# deploy.sh — Run LOCALLY. You push yourself, then this SSHs to Oracle and runs deploy-oracle.sh.
# Usage:
#   ORACLE_HOST=opc@152.70.xxx.xxx ./scripts/deploy.sh
#   ORACLE_HOST=opc@152.70.xxx.xxx BRANCH=main ./scripts/deploy.sh
#   (reads ORACLE_HOST from env or .env.deploy)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env.deploy if present (e.g. ORACLE_HOST=opc@1.2.3.4, ORACLE_KEY=~/.ssh/oracle.key)
if [ -f "$ROOT_DIR/.env.deploy" ]; then
  set -a; source "$ROOT_DIR/.env.deploy"; set +a
fi
if [ -f "$SCRIPT_DIR/../backend/.env" ]; then
  # don't auto-source backend env — just for ORACLE_HOST fallback
  true
fi

ORACLE_HOST="${ORACLE_HOST:-${1:-}}"
BRANCH="${BRANCH:-main}"
SSH_KEY="${ORACLE_KEY:-}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

if [ -z "$ORACLE_HOST" ]; then
  echo "Usage: ORACLE_HOST=opc@<IP> $0 [user@host]"
  echo "  or: echo 'ORACLE_HOST=opc@152.70.xxx.xxx' > .env.deploy"
  exit 1
fi
if [ -n "$SSH_KEY" ]; then
  SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
fi

SYNC_ENV="${SYNC_ENV:-true}"
APP_DIR="${ORACLE_APP_DIR:-~/YounesAI}"

echo "[deploy] Pushing to Oracle $ORACLE_HOST branch $BRANCH ..."
echo "[deploy] You already pushed to GitHub — now pulling on Oracle."

# Upload local backend/.env (secrets stay off GitHub)
if [ "$SYNC_ENV" = "true" ] && [ -f "$ROOT_DIR/backend/.env" ]; then
  echo "[deploy] Uploading backend/.env ..."
  scp $SSH_OPTS "$ROOT_DIR/backend/.env" "$ORACLE_HOST:${APP_DIR}/backend/.env"
else
  echo "[deploy] Skipping .env upload (SYNC_ENV=$SYNC_ENV or file missing)"
fi

# Ensure deploy-oracle.sh is on the remote (scp it fresh)
echo "[deploy] Syncing deploy-oracle.sh to remote ..."
scp $SSH_OPTS "$SCRIPT_DIR/deploy-oracle.sh" "$ORACLE_HOST:/tmp/deploy-oracle.sh"
ssh $SSH_OPTS "$ORACLE_HOST" "chmod +x /tmp/deploy-oracle.sh && APP_DIR=$APP_DIR BRANCH=$BRANCH /tmp/deploy-oracle.sh"

echo "[deploy] Done."
