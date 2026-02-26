# API URL Sorun Giderme

## Network Error Çözümü

### 1. Backend Çalışıyor mu?

Backend'in çalıştığından emin olun:

```powershell
cd backend
npm run dev
```

Backend çalışıyorsa şunu görmelisiniz:
```
Server running on http://0.0.0.0:3000
Local: http://localhost:3000
```

### 2. Android Emülatör vs Fiziksel Cihaz

#### Android Emülatör Kullanıyorsanız:
- API URL zaten doğru: `http://10.0.2.2:3000/api`
- Değişiklik yapmanıza gerek yok

#### Fiziksel Android Cihaz Kullanıyorsanız:
- Bilgisayarınızın IP adresini kullanmanız gerekir
- IP adresini bulmak için:
  ```powershell
  ipconfig
  # IPv4 Address bulun (örn: 192.168.1.3)
  ```

- `mobile/src/services/api.js` dosyasını açın
- Satır 15'i bulun ve şöyle değiştirin:
  ```javascript
  // ÖNCE:
  apiUrl = 'http://10.0.2.2:3000/api'; // Android emülatör
  
  // SONRA:
  apiUrl = 'http://192.168.1.3:3000/api'; // Android fiziksel (IP'yi güncelleyin)
  ```

### 3. Mobile Uygulamayı Reload Edin

Değişiklik yaptıktan sonra:
1. Expo Go'da cihazı sallayın (Shake gesture)
2. "Reload" seçeneğine tıklayın
3. Veya terminal'de `R` tuşuna basın

### 4. Debug Log'ları Kontrol Edin

Mobile uygulamada konsol log'larında şunu görmelisiniz:
```
[LOG] API URL initialized {"apiUrl": "http://...", "platform": "android"}
```

Eğer yanlış URL görüyorsanız, dosyayı güncelleyip reload edin.

### 5. Test

1. Backend çalışıyor mu? → `http://localhost:3000/health` kontrol edin
2. Mobile uygulama reload edildi mi?
3. Giriş ekranında:
   - Tesis Kodu: `1`
   - PIN: `611633`
   - "Giriş Yap" butonuna tıklayın

### 6. Hala Çalışmıyorsa

- Backend loglarını kontrol edin (backend penceresi)
- Mobile konsol loglarını kontrol edin
- Firewall/antivirus programlarını kontrol edin
- Bilgisayar ve cihazın aynı Wi-Fi ağında olduğundan emin olun

### IP Adresi Bulma (Windows)

```powershell
ipconfig | findstr IPv4
```

Çıktı örneği:
```
IPv4 Address. . . . . . . . . . . : 192.168.1.3
```

Bu IP adresini `api.js` dosyasında kullanın.

