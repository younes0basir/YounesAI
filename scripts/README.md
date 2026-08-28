# Deploy scripts

You push to GitHub yourself. These scripts update the Oracle VM and local dev.

## One-time setup

```powershell
copy .env.deploy.example .env.deploy
# Edit .env.deploy — ORACLE_HOST, ORACLE_KEY, PUBLIC_HEALTH_URL
```

## Deploy backend to Oracle (after `git push`)

**Windows (PowerShell or CMD):**

```powershell
.\scripts\deploy-oracle.ps1
```

```cmd
scripts\deploy-oracle.cmd
```

**Git Bash / WSL:**

```bash
ORACLE_HOST=opc@84.8.220.241 ORACLE_KEY=~/.ssh/oracle.key ./scripts/deploy.sh
```

### What it does

1. Uploads `backend/.env` (secrets never go through GitHub)
2. SSH → `git pull` on Oracle
3. `npm ci` + `npm run migrate`
4. `pm2 restart younesai-backend --update-env`
5. Health check on `localhost:3000/api/health`

Optional flags:

```powershell
.\scripts\deploy-oracle.ps1 -Branch develop
.\scripts\deploy-oracle.ps1 -SkipEnvSync   # don't overwrite remote .env
```

## Mobile (Expo Go, no Android Studio)

```powershell
.\scripts\start-mobile.ps1
```

Then on phone: Expo Go → `exp://<your-pc-lan-ip>:8082` or scan QR at http://localhost:8082

## Frontend

`frontend/.env` → `VITE_API_URL=http://84.8.220.241:3000/api`

```powershell
cd frontend
npm run dev
```

Switch to **Deployed** backend mode in the app UI if requests still go to localhost.
