$ErrorActionPreference = "Stop"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$MOBILE = Join-Path $ROOT "mobile"

if (!(Test-Path (Join-Path $MOBILE "package.json"))) {
  Write-Host "ERROR: mobile/package.json bulunamadı: $MOBILE" -ForegroundColor Red
  exit 1
}

Set-Location $MOBILE
Write-Host "OK: Working directory -> $PWD" -ForegroundColor Green

npx expo start --clear
