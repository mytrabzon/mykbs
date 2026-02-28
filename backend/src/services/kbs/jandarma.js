const axios = require('axios');

/**
 * Jandarma KBS entegrasyon servisi
 */
class JandarmaKBS {
  constructor(tesisKodu, webServisSifre, ipAdresleri = []) {
    this.tesisKodu = tesisKodu;
    this.webServisSifre = webServisSifre;
    this.ipAdresleri = ipAdresleri;
    this.baseURL = process.env.JANDARMA_KBS_URL || 'https://jandarma-kbs-api.example.com';
  }

  /**
   * Bağlantı testi
   */
  async testBaglanti() {
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
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || error.message;
        
        if (status === 401) {
          return { success: false, message: 'Web servis şifresi hatalı' };
        } else if (status === 403) {
          return { success: false, message: 'Bu IP yetkili değil' };
        } else if (status === 503 || error.code === 'ECONNREFUSED') {
          return { success: false, message: 'KBS servisi yanıt vermiyor' };
        }
        
        return { success: false, message: message || 'Bağlantı hatası' };
      }
      
      return { success: false, message: 'KBS servisi yanıt vermiyor' };
    }
  }

  /**
   * Misafir bildirimi gönder
   */
  async bildirimGonder(misafirData) {
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
      return {
        success: false,
        durum: 'hatali',
        hataMesaji: error.response?.data?.message || error.message || 'KBS bağlantı hatası',
        yanit: error.response?.data
      };
    }
  }

  /**
   * Çıkış bildirimi gönder
   */
  async cikisBildir(misafirData) {
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

