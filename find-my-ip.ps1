# IP Adresinizi Bulma Scripti
Write-Host "=== IP ADRESINIZI BULUN ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Bilgisayarinizin IP adresleri:" -ForegroundColor Yellow
Write-Host ""

# IPv4 adreslerini bul
$ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike "127.*" -and 
    $_.IPAddress -notlike "169.254.*"
} | Select-Object IPAddress, InterfaceAlias

if ($ipAddresses) {
    Write-Host "IPv4 Adresleri:" -ForegroundColor Green
    foreach ($ip in $ipAddresses) {
        Write-Host "  - $($ip.IPAddress) ($($ip.InterfaceAlias))" -ForegroundColor White
    }
    Write-Host ""
    
    # En muhtemel IP'yi bul (WiFi veya Ethernet)
    $mainIP = $ipAddresses | Where-Object {
        $_.InterfaceAlias -like "*Wi-Fi*" -or 
        $_.InterfaceAlias -like "*Ethernet*" -or
        $_.InterfaceAlias -like "*Local Area Connection*"
    } | Select-Object -First 1
    
    if ($mainIP) {
        Write-Host "Ana IP Adresi (Backend icin):" -ForegroundColor Cyan
        Write-Host "  $($mainIP.IPAddress)" -ForegroundColor Green -BackgroundColor Black
        Write-Host ""
        Write-Host "Bu IP'yi KBS servislerine verebilirsiniz." -ForegroundColor Yellow
    } else {
        Write-Host "Ana IP Adresi:" -ForegroundColor Cyan
        Write-Host "  $($ipAddresses[0].IPAddress)" -ForegroundColor Green -BackgroundColor Black
        Write-Host ""
    }
} else {
    Write-Host "IP adresi bulunamadi!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== NOTLAR ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. IP kisitlamasi su anda KAPALI - IP girmenize gerek yok!" -ForegroundColor White
Write-Host "2. Eger KBS servisleri IP kontrolu isterse, yukaridaki IP'yi kullanin" -ForegroundColor White
Write-Host "3. Mobil uygulama icin IP girmeyin (farkli aglardan baglanir)" -ForegroundColor White
Write-Host ""

pause

