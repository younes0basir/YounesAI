# build-mobile-apk.ps1 — Standalone Android APK via EAS (no Android Studio on PC).
# The installed app runs without Expo Go or your PC. Only Oracle backend must be up.
#
# One-time:
#   npm install -g eas-cli
#   eas login
#   cd mobile && eas build:configure   # links project (if first time)
#
# Usage:
#   .\scripts\build-mobile-apk.ps1
#   .\scripts\build-mobile-apk.ps1 -Profile production

param(
    [ValidateSet("preview", "production")]
    [string]$Profile = "preview"
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$MobileDir = Join-Path $RootDir "mobile"

if (-not (Test-Path (Join-Path $MobileDir ".env"))) {
    Write-Host "[build] Copy mobile/.env.example to mobile/.env and set EXPO_PUBLIC_API_URL" -ForegroundColor Yellow
    exit 1
}

Set-Location $MobileDir

if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
    Write-Host "[build] Installing eas-cli globally ..." -ForegroundColor Cyan
    npm install -g eas-cli
}

Write-Host "[build] Building Android APK ($Profile) in Expo cloud ..." -ForegroundColor Cyan
Write-Host "[build] EXPO_PUBLIC_API_URL is baked into the APK from eas.json (cloud) or mobile/.env (local)." -ForegroundColor Cyan
Write-Host "[build] When done, download the APK from the link and install on your Poco." -ForegroundColor Cyan

eas build --platform android --profile $Profile --non-interactive

Write-Host "[ok] Install the APK on your phone — no PC or Expo Go needed after that." -ForegroundColor Green
