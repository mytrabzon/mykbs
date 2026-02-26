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
          soyad: misafirData.soyad,
          kimlikNo: misafirData.kimlikNo,
          pasaportNo: misafirData.pasaportNo,
          dogumTarihi: misafirData.dogumTarihi,
          uyruk: misafirData.uyruk,
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

