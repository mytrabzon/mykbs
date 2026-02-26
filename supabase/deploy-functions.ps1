# .env'den token yukle ve Edge Functions deploy et (script supabase\ icinde, .env proje kokunde)
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
            Set-Item -Path "Env:$name" -Value $value
        }
    }
    Write-Host "[.env yuklendi]" -ForegroundColor DarkGray
}
$env:SUPABASE_ACCESS_TOKEN = $env:SUPABASE_ACCESS_TOKEN
if (-not $env:SUPABASE_ACCESS_TOKEN) {
    Write-Host "Hata: SUPABASE_ACCESS_TOKEN .env icinde tanimli degil." -ForegroundColor Red
    exit 1
}
Set-Location $root
supabase functions deploy @args
