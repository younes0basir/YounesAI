# start-mobile.ps1 — Expo Go on LAN (no Android Studio).
# Phone + PC must be on the same Wi-Fi. API uses mobile/.env (EXPO_PUBLIC_API_URL).

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$MobileDir = Join-Path $RootDir "mobile"

Set-Location $MobileDir

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "[mobile] Created mobile/.env from .env.example — set EXPO_PUBLIC_API_URL if needed." -ForegroundColor Yellow
}

$lanIp = (
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
    Select-Object -First 1 -ExpandProperty IPAddress
)
if (-not $lanIp) {
    $lanIp = (ipconfig | Select-String "IPv4" | Select-Object -First 1) -replace ".*:\s*", ""
}

Write-Host "[mobile] LAN URL for Expo Go: exp://${lanIp}:8082" -ForegroundColor Green
Write-Host "[mobile] Or open http://localhost:8082 in browser for QR code." -ForegroundColor Green

npx expo start --lan --port 8082
