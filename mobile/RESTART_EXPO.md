# Expo Başlatma Sorunları ve Çözümler

## 🔴 Sorun: Port 8081 Kullanılıyor

### Hızlı Çözüm

```powershell
cd C:\MYKBS\mobile

# Mevcut process'i durdur
.\start-expo.ps1

# veya manuel olarak
npx expo start --clear --port 8083
```

### Port'u Temizle

```powershell
# Port 8081'i kullanan process'i bul
netstat -ano | findstr ":8081"

# Process ID'yi durdur (örnek: 16064)
Stop-Process -Id 16064 -Force

# Sonra Expo'yu başlat
npx expo start --clear
```

## ✅ Doğru Başlatma

```powershell
cd C:\MYKBS\mobile
npx expo start --clear
```

## 🔧 Alternatif Port

Eğer port sorunu devam ederse:

```powershell
npx expo start --clear --port 8083
```

## 📝 Notlar

- Expo varsayılan port: **8081**
- Alternatif port: **8083**, **8084**, vb.
- Cache temizleme: `--clear` flag'i
- Tunnel modu: `--tunnel` (internet üzerinden)

