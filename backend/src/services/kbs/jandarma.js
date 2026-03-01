const axios = require('axios');

/**
 * Jandarma KBS entegrasyon servisi
 */
class JandarmaKBS {
  constructor(tesisKodu, webServisSifre, ipAdresleri = []) {
    this.tesisKodu = tesisKodu;
    this.webServisSifre = webServisSifre;
    this.ipAdresleri = ipAdresleri;
    // JANDARMA_KBS_URL env zorunlu; boşsa example.com fallback DNS hatası (ENOTFOUND) verir, kullanma.
    this.baseURL = (process.env.JANDARMA_KBS_URL || '').trim() || '';
  }

  /**
   * Bağlantı testi
   */
  async testBaglanti() {
    if (!this.baseURL) {
      return { success: false, message: 'JANDARMA_KBS_URL ortam değişkeni tanımlı değil. .env veya sunucu ayarlarında gerçek KBS adresini ekleyin.' };
    }
    try {
      const response = await axios.post(
        `${this.baseURL}/test`,
        {
          tesisKodu: this.tesisKodu,
          webServisSifre: this.webServisSifre
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        return { success: true, message: 'Bağlantı başarılı' };
      } else {
        return { success: false, message: response.data.message || 'Bağlantı hatası' };
      }
    } catch (error) {
      const code = error.code || '';
      const status = error.response?.status;
      const responseData = error.response?.data;
      const url = `${this.baseURL}/test`;
      console.warn('[JandarmaKBS] testBaglanti failed', { code, status, url, message: error.message });
      if (error.response) {
        const message = error.response.data?.message || error.message;
        if (status === 401) return { success: false, message: 'Web servis şifresi hatalı' };
        if (status === 403) return { success: false, message: 'Bu IP yetkili değil' };
        if (status === 404) return { success: false, message: 'KBS endpoint bulunamadı (404). Servis SOAP/WCF ise REST yerine SOAP client gerekir.' };
        if (status === 405) return { success: false, message: 'KBS yöntem kabul etmiyor (405). Servis SOAP ise REST yerine SOAP client gerekir.' };
        if (status === 503 || code === 'ECONNREFUSED') return { success: false, message: 'KBS servisi yanıt vermiyor' };
        return { success: false, message: message || 'Bağlantı hatası' };
      }
      if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') return { success: false, message: 'KBS zaman aşımı (sunucu veya ağ). IP whitelist ve firewall kontrol edin.' };
      if (code === 'ECONNREFUSED') return { success: false, message: 'KBS bağlantı reddedildi' };
      if (code === 'ENOTFOUND') return { success: false, message: 'KBS sunucu adresi çözülemedi (DNS)' };
      return { success: false, message: `KBS hatası: ${error.message || 'Yanıt yok'}` };
    }
  }

  /**
   * Misafir bildirimi gönder
   */
  async bildirimGonder(misafirData) {
    if (!this.baseURL) {
      return { success: false, durum: 'hatali', hataMesaji: 'JANDARMA_KBS_URL ortam değişkeni tanımlı değil.' };
    }
    try {
      const payload = {
        tesisKodu: this.tesisKodu,
        webServisSifre: this.webServisSifre,
        misafir: {
          ad: misafirData.ad,
          ad2: misafirData.ad2 || null,
          soyad: misafirData.soyad,
          kimlikNo: misafirData.kimlikNo || null,
          pasaportNo: misafirData.pasaportNo || null,
          dogumTarihi: misafirData.dogumTarihi,
          uyruk: misafirData.uyruk,
          misafirTipi: misafirData.misafirTipi || null,
          girisTarihi: misafirData.girisTarihi,
          odaNumarasi: misafirData.odaNumarasi
        }
      };

      const response = await axios.post(
        `${this.baseURL}/bildirim`,
        payload,
        {
          timeout: 12000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        return {
          success: true,
          durum: 'basarili',
          yanit: response.data
        };
      } else {
        return {
          success: false,
          durum: 'hatali',
          hataMesaji: response.data.message || 'Bildirim gönderilemedi',
          yanit: response.data
        };
      }
    } catch (error) {
      const code = error.code || '';
      const status = error.response?.status;
      const msg = error.response?.data?.message || error.message || 'KBS bağlantı hatası';
      if (status === 404 || status === 405) {
        console.warn('[JandarmaKBS] bildirimGonder: servis SOAP/WCF olabilir, REST path yok', { status, url: `${this.baseURL}/bildirim` });
      } else {
        console.warn('[JandarmaKBS] bildirimGonder failed', { code, status, message: error.message });
      }
      return {
        success: false,
        durum: 'hatali',
        hataMesaji: msg,
        yanit: error.response?.data
      };
    }
  }

  /**
   * Çıkış bildirimi gönder
   */
  async cikisBildir(misafirData) {
    if (!this.baseURL) {
      return { success: false, hataMesaji: 'JANDARMA_KBS_URL ortam değişkeni tanımlı değil.' };
    }
    try {
      const payload = {
        tesisKodu: this.tesisKodu,
        webServisSifre: this.webServisSifre,
        misafir: {
          kimlikNo: misafirData.kimlikNo,
          pasaportNo: misafirData.pasaportNo,
          cikisTarihi: misafirData.cikisTarihi
        }
      };

      const response = await axios.post(
        `${this.baseURL}/cikis`,
        payload,
        {
          timeout: 8000
        }
      );

      return {
        success: response.data.success,
        yanit: response.data
      };
    } catch (error) {
      return {
        success: false,
        hataMesaji: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * KBS'te tesisin daha önce bildirdiği (aktif veya son çıkan) misafirleri listele.
   * Resmi Jandarma KBS API'de bu endpoint varsa kullanılır; yoksa { success: false, misafirler: [] } döner.
   * Kullanıcı farklı sistemden geçince "KBS bilgilerini yazınca" mevcut misafirleri çekip sistemimize aktarabilir.
   */
  async misafirListesiGetir() {
    try {
      const response = await axios.post(
        `${this.baseURL}/misafirler`,
        {
          tesisKodu: this.tesisKodu,
          webServisSifre: this.webServisSifre
        },
        {
          timeout: 15000,
          headers: { 'Content-Type': 'application/json' },
          validateStatus: () => true
        }
      );

      if (response.status === 404 || response.status === 501 || response.status === 400) {
        return {
          success: false,
          message: 'Bu KBS türünde misafir listesi sorgulama desteklenmiyor veya yapılandırılmamış.',
          misafirler: []
        };
      }

      if (response.status !== 200 || !response.data) {
        return {
          success: false,
          message: response.data?.message || 'Liste alınamadı',
          misafirler: []
        };
      }

      const list = response.data.misafirler || response.data.liste || [];
      const normalized = (Array.isArray(list) ? list : []).map((m) => ({
        ad: m.ad || '',
        soyad: m.soyad || '',
        kimlikNo: m.kimlikNo || null,
        pasaportNo: m.pasaportNo || null,
        dogumTarihi: m.dogumTarihi || m.girisTarihi,
        uyruk: m.uyruk || 'TÜRK',
        girisTarihi: m.girisTarihi || new Date().toISOString(),
        cikisTarihi: m.cikisTarihi || null,
        odaNumarasi: m.odaNumarasi || m.oda || ''
      }));

      return { success: true, misafirler: normalized };
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'KBS bağlantı hatası';
      return {
        success: false,
        message: msg,
        misafirler: []
      };
    }
  }

  /**
   * Oda değişikliği bildirimi
   */
  async odaDegistir(misafirData, yeniOdaNumarasi) {
    try {
      const payload = {
        tesisKodu: this.tesisKodu,
        webServisSifre: this.webServisSifre,
        misafir: {
          kimlikNo: misafirData.kimlikNo,
          pasaportNo: misafirData.pasaportNo,
          eskiOda: misafirData.odaNumarasi,
          yeniOda: yeniOdaNumarasi
        }
      };

      const response = await axios.post(
        `${this.baseURL}/oda-degistir`,
        payload,
        {
          timeout: 8000
        }
      );

      return {
        success: response.data.success,
        yanit: response.data
      };
    } catch (error) {
      return {
        success: false,
        hataMesaji: error.response?.data?.message || error.message
      };
    }
  }
}

module.exports = JandarmaKBS;

