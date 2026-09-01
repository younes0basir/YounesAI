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

### Mobile API (HTTPS)

Android blocks plain HTTP to public IPs on many devices (Poco/Xiaomi, etc.). Use **HTTPS**:

- Mobile APK: `https://84-8-220-241.sslip.io` (`mobile/eas.json`, `mobile/app.config.js`)
- nginx on the VM terminates TLS and proxies to `localhost:3000`

**Oracle Cloud Security List — add ingress for TCP 80 and TCP 443** (443 is required for phones).

Verify from your PC:

```powershell
curl https://84-8-220-241.sslip.io/api/health
```

Then rebuild the APK. VM setup (once): `./scripts/setup-nginx-oracle.sh`

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

## Mobile — install APK on phone via USB (standalone app)

Phone: USB debugging ON, shows `device` in `adb devices`.

**Option A — local build (JDK + SDK on PC, no Android Studio app):**

```powershell
winget install Microsoft.OpenJDK.17
# Close and reopen PowerShell after JDK installs

.\scripts\setup-android-sdk.ps1
# Close and reopen PowerShell after SDK installs

.\scripts\install-mobile-usb.ps1
```

**Option B — cloud build (no SDK on PC, needs free Expo account):**

```powershell
npm install -g eas-cli
eas login
cd mobile
eas build:configure
cd ..
.\scripts\install-mobile-usb.ps1 -EasCloud
```

**Option C — install an APK you already downloaded:**

```powershell
.\scripts\install-mobile-usb.ps1 -Apk C:\path\to\app.apk
```

After install, the app runs without Expo Go or your PC — only Oracle backend must be up.

## Frontend

`frontend/.env` → `VITE_API_URL=http://84.8.220.241:3000/api`

```powershell
cd frontend
npm run dev
```

Switch to **Deployed** backend mode in the app UI if requests still go to localhost.
