# setup-android-sdk.ps1 — Minimal Android SDK (no Android Studio).
# Run once, then: .\scripts\install-mobile-usb.ps1

$ErrorActionPreference = "Stop"
$SdkRoot = "$env:LOCALAPPDATA\Android\Sdk"
$CmdlineZip = Join-Path $env:TEMP "android-cmdline-tools.zip"
$CmdlineUrl = "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"

Write-Host "[sdk] Installing to $SdkRoot" -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path $SdkRoot | Out-Null

if (-not (Test-Path "$SdkRoot\cmdline-tools\latest\bin\sdkmanager.bat")) {
    Write-Host "[sdk] Downloading command-line tools (~150 MB) ..."
    Invoke-WebRequest -Uri $CmdlineUrl -OutFile $CmdlineZip -UseBasicParsing

    $extractDir = Join-Path $env:TEMP "android-cmdline-extract"
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
    Expand-Archive -Path $CmdlineZip -DestinationPath $extractDir -Force

    New-Item -ItemType Directory -Force -Path "$SdkRoot\cmdline-tools\latest" | Out-Null
    Copy-Item "$extractDir\cmdline-tools\*" "$SdkRoot\cmdline-tools\latest\" -Recurse -Force
    Remove-Item $CmdlineZip -Force -ErrorAction SilentlyContinue
}

$sdkmanager = "$SdkRoot\cmdline-tools\latest\bin\sdkmanager.bat"
Write-Host "[sdk] Installing platform-tools, build-tools, platform ..."
$env:ANDROID_HOME = $SdkRoot

# Accept licenses non-interactively
" y" * 20 | & $sdkmanager --licenses 2>$null | Out-Null
& $sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"

[Environment]::SetEnvironmentVariable("ANDROID_HOME", $SdkRoot, "User")
$path = [Environment]::GetEnvironmentVariable("Path", "User")
if ($path -notlike "*$SdkRoot\platform-tools*") {
    [Environment]::SetEnvironmentVariable("Path", "$path;$SdkRoot\platform-tools;$SdkRoot\cmdline-tools\latest\bin", "User")
}

Write-Host "[ok] ANDROID_HOME=$SdkRoot" -ForegroundColor Green
Write-Host "[ok] Close and reopen PowerShell, then run: .\scripts\install-mobile-usb.ps1" -ForegroundColor Green
