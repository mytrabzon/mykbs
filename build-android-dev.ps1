$ErrorActionPreference = "Stop"

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$MOBILE = Join-Path $ROOT "mobile"

Set-Location $MOBILE
Write-Host "OK: Working directory -> $PWD" -ForegroundColor Green

eas build --profile development --platform android --clear-cache
