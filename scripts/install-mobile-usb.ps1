# install-mobile-usb.ps1 - Build APK and install on phone via USB (adb).
# Requires: USB debugging ON, phone shows as "device" in adb devices.
#
# Usage:
#   .\scripts\install-mobile-usb.ps1              # local gradle build + install
#   .\scripts\install-mobile-usb.ps1 -Apk path.apk  # install existing APK only
#   .\scripts\install-mobile-usb.ps1 -EasCloud      # EAS cloud build + install (needs eas login)

param(
    [string]$Apk = "",
    [switch]$EasCloud,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$MobileDir = Join-Path $RootDir "mobile"
$AndroidDir = Join-Path $MobileDir "android"

function Write-Step { param([string]$m) Write-Host "[install] $m" -ForegroundColor Cyan }
function Write-Ok { param([string]$m) Write-Host "[ok] $m" -ForegroundColor Green }

function Find-Adb {
    $adb = Get-Command adb -ErrorAction SilentlyContinue
    if ($adb) { return $adb.Source }
    $fallback = "C:\Users\ken\Desktop\platform-tools\adb.exe"
    if (Test-Path $fallback) { return $fallback }
    throw "adb not found. Add Android platform-tools to PATH."
}

function Ensure-Device {
    param([string]$AdbPath)
    $out = & $AdbPath devices
    if ($out -match "`tdevice`$") {
        Write-Ok "Phone connected (USB debugging authorized)"
        return
    }
    if ($out -match "`tunauthorized`$") {
        throw "Phone unauthorized - tap Allow USB debugging on your Poco."
    }
    throw "No phone detected. Enable USB debugging and connect via USB."
}

function Find-JavaHome {
    $candidates = @(
        $env:JAVA_HOME,
        "C:\Program Files\Microsoft\jdk-17*",
        "C:\Program Files\Java\jdk-17*",
        "C:\Program Files\Android\Android Studio\jbr"
    )
    foreach ($c in $candidates) {
        if (-not $c) { continue }
        $resolved = Resolve-Path $c -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolved -and (Test-Path (Join-Path $resolved "bin\java.exe"))) {
            return $resolved.Path
        }
    }
    return $null
}

function Find-AndroidSdk {
    $candidates = @(
        $env:ANDROID_HOME,
        "$env:LOCALAPPDATA\Android\Sdk",
        "C:\Android\Sdk"
    )
    foreach ($c in $candidates) {
        if ($c -and (Test-Path (Join-Path $c "platform-tools\adb.exe"))) {
            return $c
        }
    }
    return $null
}

$Adb = Find-Adb
Ensure-Device $Adb

if ($Apk) {
    if (-not (Test-Path $Apk)) { throw "APK not found: $Apk" }
    Write-Step "Installing $Apk ..."
    & $Adb install -r $Apk
    Write-Ok "Installed. Open YounesAI on your phone."
    exit 0
}

Set-Location $MobileDir

if ($EasCloud) {
    if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
        npm install -g eas-cli
    }
    Write-Step "EAS cloud build (login required if first time: eas login) ..."
    eas build --platform android --profile preview --wait --non-interactive
    Write-Step "Installing latest build via USB ..."
    eas build:run --platform android --latest --non-interactive
    Write-Ok "Done."
    exit 0
}

if ($SkipBuild) {
    $debugApk = Join-Path $AndroidDir "app\build\outputs\apk\debug\app-debug.apk"
    if (-not (Test-Path $debugApk)) { throw "No debug APK at $debugApk - run without -SkipBuild first." }
    & $Adb install -r $debugApk
    Write-Ok "Installed $debugApk"
    exit 0
}

# Local gradle build
$javaHome = Find-JavaHome
$sdkHome = Find-AndroidSdk

if (-not $javaHome) {
    Write-Host @"

Java (JDK 17) not found. Install once:

  winget install Microsoft.OpenJDK.17

Then close and reopen PowerShell and run this script again.

"@ -ForegroundColor Yellow
    exit 1
}

if (-not $sdkHome) {
    Write-Host @"

Android SDK not found. Minimal install (no full Android Studio):

  1. Download "Command line tools only" from:
     https://developer.android.com/studio#command-line-tools-only
  2. Extract to: $env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest
  3. In PowerShell:

     `$sdk = `"$env:LOCALAPPDATA\Android\Sdk`"
     `$sdkmanager = `"`$sdk\cmdline-tools\latest\bin\sdkmanager.bat`"
     & `$sdkmanager `"platform-tools`" `"platforms;android-35`" `"build-tools;35.0.0`"
     [Environment]::SetEnvironmentVariable(`"ANDROID_HOME`", `$sdk, `"User`")

  4. Reopen PowerShell and run this script again.

OR use cloud build (no SDK on PC):

  eas login
  .\scripts\install-mobile-usb.ps1 -EasCloud

"@ -ForegroundColor Yellow
    exit 1
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $sdkHome
$env:Path = "$javaHome\bin;$sdkHome\platform-tools;$env:Path"

Write-Step "JAVA_HOME=$javaHome"
Write-Step "ANDROID_HOME=$sdkHome"

if (-not (Test-Path $AndroidDir)) {
    Write-Step "Generating native android/ project ..."
    npx expo prebuild --platform android --no-install
}

Write-Step "Building debug APK (first time ~10-20 min) ..."
Push-Location $AndroidDir
try {
    & .\gradlew.bat assembleDebug
} finally {
    Pop-Location
}

$debugApk = Join-Path $AndroidDir "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $debugApk)) {
    throw "Build failed - no APK at $debugApk"
}

Write-Step "Installing on phone via USB ..."
& $Adb install -r $debugApk
Write-Ok "YounesAI installed. Only Oracle backend ($env:EXPO_PUBLIC_API_URL) needs to be running - not your PC."
