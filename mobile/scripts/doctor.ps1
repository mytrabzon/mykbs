# MYKBS Mobile - Proje Doktor Script
# PowerShell'de komutları AYRI SATIRDA çalıştırın (&& kullanmayın):
#   cd C:\MYKBS\mobile
#   npm install
#   npx expo start

$ErrorActionPreference = "Stop"
$checks = @()
$ok = $true

Write-Host "`n=== MYKBS Mobile Doctor ===" -ForegroundColor Cyan
Write-Host ""

# 1) Proje kökü
$mobileRoot = $PSScriptRoot
if ($mobileRoot -notmatch "mobile") {
    $mobileRoot = Join-Path $PSScriptRoot ".."
}
Set-Location $mobileRoot
$checks += "Proje kökü: $mobileRoot"

# 2) Node
try {
    $nodeVer = node --version 2>&1
    $checks += "Node: $nodeVer"
} catch {
    $checks += "Node: EKSIK (node --version calismadi)"
    $ok = $false
}

# 3) npm
try {
    $npmVer = npm --version 2>&1
    $checks += "npm: $npmVer"
} catch {
    $checks += "npm: EKSIK"
    $ok = $false
}

# 4) package.json
if (Test-Path "package.json") {
    $checks += "package.json: OK"
} else {
    $checks += "package.json: BULUNAMADI"
    $ok = $false
}

# 5) node_modules
if (Test-Path "node_modules") {
    $checks += "node_modules: OK"
} else {
    $checks += "node_modules: YOK (npm install calistirin)"
    $ok = $false
}

# 6) MRZ paketi
if (Test-Path "node_modules\@corupta\react-native-mrz-reader") {
    $checks += "@corupta/react-native-mrz-reader: OK"
} else {
    $checks += "@corupta/react-native-mrz-reader: YOK (npm i @corupta/react-native-mrz-reader)"
    $ok = $false
}

# 7) expo
if (Test-Path "node_modules\expo") {
    $checks += "expo: OK"
} else {
    $checks += "expo: YOK"
    $ok = $false
}

# 8) android klasörü (dev build)
if (Test-Path "android") {
    $checks += "android/: OK (dev build hazir)"
} else {
    $checks += "android/: YOK (npx expo prebuild gerekebilir)"
}

# 9) iOS Pods (opsiyonel)
if (Test-Path "ios") {
    if (Test-Path "ios\Pods") {
        $checks += "iOS Pods: OK"
    } else {
        $checks += "iOS Pods: YOK (cd ios; npx pod-install)"
    }
}

$checks | ForEach-Object { Write-Host "  $_" }
Write-Host ""
if ($ok) {
    Write-Host "Sonuc: Gerekli kontroller gecti." -ForegroundColor Green
} else {
    Write-Host "Sonuc: Bazi kontroller basarisiz. Yukaridaki adimlari tamamlayin." -ForegroundColor Yellow
}
Write-Host ""
