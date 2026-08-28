# deploy-oracle.ps1 — Run on Windows AFTER you push to GitHub.
# Uploads backend/.env, SSHs to Oracle, pulls code, migrates, restarts pm2.
#
# Setup (once):
#   copy .env.deploy.example .env.deploy
#   edit .env.deploy with your IP and SSH key path
#
# Usage:
#   .\scripts\deploy-oracle.ps1
#   .\scripts\deploy-oracle.ps1 -Branch develop
#   .\scripts\deploy-oracle.ps1 -SkipEnvSync

param(
    [string]$Branch = "",
    [switch]$SkipEnvSync
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$DeployConfig = Join-Path $RootDir ".env.deploy"
$BackendEnv = Join-Path $RootDir "backend\.env"
$DeployScript = Join-Path $ScriptDir "deploy-oracle.sh"

function Load-DeployConfig {
    param([string]$Path)
    $vars = @{}
    if (-not (Test-Path $Path)) {
        return $vars
    }
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#")) { return }
        $eq = $line.IndexOf("=")
        if ($eq -lt 1) { return }
        $key = $line.Substring(0, $eq).Trim()
        $val = $line.Substring($eq + 1).Trim().Trim('"').Trim("'")
        $vars[$key] = $val
    }
    return $vars
}

function Write-Step { param([string]$Message) Write-Host "[deploy] $Message" -ForegroundColor Cyan }
function Write-Ok { param([string]$Message) Write-Host "[ok] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[warn] $Message" -ForegroundColor Yellow }

$cfg = Load-DeployConfig $DeployConfig
$OracleHost = $cfg["ORACLE_HOST"]
$OracleKey = $cfg["ORACLE_KEY"]
$AppDir = if ($cfg["ORACLE_APP_DIR"]) { $cfg["ORACLE_APP_DIR"] } else { "~/YounesAI" }
$BranchName = if ($Branch) { $Branch } elseif ($cfg["BRANCH"]) { $cfg["BRANCH"] } else { "main" }
$PublicHealth = $cfg["PUBLIC_HEALTH_URL"]
$SyncEnv = -not $SkipEnvSync -and ($cfg["SYNC_ENV"] -ne "false")

if (-not $OracleHost) {
    Write-Host @"

Oracle deploy config missing.

  1. copy .env.deploy.example .env.deploy
  2. Set ORACLE_HOST and ORACLE_KEY
  3. git push (you do this yourself)
  4. .\scripts\deploy-oracle.ps1

"@ -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $DeployScript)) {
    throw "Missing $DeployScript"
}

$SshArgs = @("-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=15")
if ($OracleKey) {
    if (-not (Test-Path $OracleKey)) {
        throw "SSH key not found: $OracleKey (set ORACLE_KEY in .env.deploy)"
    }
    $SshArgs += @("-i", $OracleKey)
}

Write-Step "Target: $OracleHost | Branch: $BranchName | App: $AppDir"
Write-Step "You push to GitHub — this script only updates the Oracle VM."

if ($SyncEnv) {
    if (-not (Test-Path $BackendEnv)) {
        Write-Warn "No backend/.env locally — skipping env upload"
    } else {
        Write-Step "Uploading backend/.env ..."
        & scp @SshArgs $BackendEnv "${OracleHost}:${AppDir}/backend/.env"
        Write-Ok "backend/.env uploaded"
    }
} else {
    Write-Warn "Skipping .env upload (-SkipEnvSync or SYNC_ENV=false)"
}

Write-Step "Syncing deploy-oracle.sh and running remote deploy ..."
& scp @SshArgs $DeployScript "${OracleHost}:/tmp/deploy-oracle.sh"
$remoteCmd = "chmod +x /tmp/deploy-oracle.sh && APP_DIR=$AppDir BRANCH=$BranchName /tmp/deploy-oracle.sh"
& ssh @SshArgs $OracleHost $remoteCmd

if ($PublicHealth) {
    Write-Step "Public health check: $PublicHealth"
    try {
        $resp = curl.exe -fsS --connect-timeout 15 $PublicHealth
        Write-Ok "Public API: $resp"
    } catch {
        Write-Warn "Public health check failed (Oracle Security List / firewall?). Local deploy may still be OK."
    }
}

Write-Ok "Done. Frontend: npm run dev in frontend/ | Mobile: npx expo start --lan --port 8082"
