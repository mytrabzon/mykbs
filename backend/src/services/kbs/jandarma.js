const axios = require('axios');

/** XML içinde kullanılacak metinleri escape et */
function escapeXml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Jandarma KBS SOAP servisi – bağlantı testi için ParametreListele SOAP isteği.
 * Resmi servis: https://vatandas.jandarma.gov.tr/KBS_Tesis_Servis/SrvShsYtkTml.svc (SOAP/WCF)
 */
function buildParametreListeleSoapEnvelope(tesisKodu, webServisSifre) {
  const t = escapeXml(tesisKodu);
  const s = escapeXml(webServisSifre);
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tempuri.org/">',
    '  <soap:Body>',
    '    <tns:ParametreListele>',
    '      <tns:TesisKodu>' + t + '</tns:TesisKodu>',
    '      <tns:Sifre>' + s + '</tns:Sifre>',
    '    </tns:ParametreListele>',
    '  </soap:Body>',
    '</soap:Envelope>'
  ].join('\n');
}

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
   * Gerçek bağlantı testi: Jandarma KBS SOAP servisine ParametreListele ile istek atar.
   * IP erişimi + tesis kodu + web servis şifresi doğrulanır.
   */
  async testBaglanti() {
    if (!this.baseURL) {
      return { success: false, message: 'JANDARMA_KBS_URL ortam değişkeni tanımlı değil. .env veya sunucu ayarlarında gerçek KBS adresini ekleyin.' };
    }
    const soapAction = 'http://tempuri.org/ISrvShsYtkTml/ParametreListele';
    const body = buildParametreListeleSoapEnvelope(this.tesisKodu, this.webServisSifre);
    try {
      const response = await axios.post(this.baseURL, body, {
        timeout: 15000,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': soapAction
        },
        validateStatus: () => true
      });

      const status = response.status;
      const data = response.data;

      if (status !== 200) {
        if (status === 401) return { success: false, message: 'Web servis şifresi hatalı' };
        if (status === 403) return { success: false, message: 'Bu IP yetkili değil. Backend çıkış IP\'sini (GET /debug/egress-ip) Jandarma KBS whitelist\'e ekleyin.' };
        if (status === 404 || status === 405) return { success: false, message: 'KBS endpoint bulunamadı veya yöntem kabul etmiyor. Servis adresini kontrol edin.' };
        if (status === 500) {
          const faultMsg = parseSoapFaultMessage(data);
          return { success: false, message: faultMsg || 'KBS sunucusu hata döndü (500). Tesis kodu ve şifreyi kontrol edin.' };
        }
        return { success: false, message: `KBS yanıt: HTTP ${status}` };
      }

      const fault = parseSoapFault(data);
      if (fault) {
        return { success: false, message: fault };
      }

      const basarili = parseParametreListeleSuccess(data);
      if (basarili === true) {
        return { success: true, message: 'KBS bağlantısı ve tesis bilgileri doğrulandı.' };
      }
      if (basarili === false) {
        const msg = parseParametreListeleMessage(data);
        return { success: false, message: msg || 'Tesis kodu veya web servis şifresi hatalı.' };
      }

      return { success: true, message: 'KBS sunucusuna erişildi. Yanıt formatı beklenenden farklı olabilir.' };
    } catch (error) {
      const code = error.code || '';
      const status = error.response?.status;
      const url = this.baseURL;
      console.warn('[JandarmaKBS] testBaglanti failed', { code, status, url, message: error.message });
      if (error.response) {
        const message = error.response.data?.message || error.message;
        if (status === 401) return { success: false, message: 'Web servis şifresi hatalı' };
        if (status === 403) return { success: false, message: 'Bu IP yetkili değil. GET /debug/egress-ip ile IP\'yi Jandarma KBS whitelist\'e ekleyin.' };
        if (status === 404 || status === 405) return { success: false, message: 'KBS endpoint bulunamadı (404/405). Servis adresini kontrol edin.' };
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

function parseSoapFault(xmlStr) {
  const str = typeof xmlStr === 'string' ? xmlStr : (xmlStr && typeof xmlStr === 'object' ? '' : String(xmlStr));
  if (!str) return null;
  const faultMatch = str.match(/<faultstring[^>]*>([^<]*)<\/faultstring>/i) ||
    str.match(/<soap:Fault>[\s\S]*?<faultstring[^>]*>([^<]*)<\/faultstring>/i) ||
    str.match(/<Reason>[\s\S]*?<Text[^>]*>([^<]*)<\/Text>/i);
  return faultMatch ? faultMatch[1].trim() : null;
}

function parseSoapFaultMessage(xmlStr) {
  const fault = parseSoapFault(xmlStr);
  if (fault) return fault;
  const str = typeof xmlStr === 'string' ? xmlStr : String(xmlStr || '');
  const detailMatch = str.match(/<detail[^>]*>([\s\S]*?)<\/detail>/i);
  if (detailMatch) {
    const inner = detailMatch[1].replace(/<[^>]+>/g, ' ').trim();
    if (inner.length > 0 && inner.length < 300) return inner;
  }
  return null;
}

function parseParametreListeleSuccess(xmlStr) {
  const str = typeof xmlStr === 'string' ? xmlStr : String(xmlStr || '');
  if (!str) return null;
  if (/<Basarili>true<\/Basarili>/i.test(str) || /<basarili>true<\/basarili>/i.test(str)) return true;
  if (/<Basarili>false<\/Basarili>/i.test(str) || /<basarili>false<\/basarili>/i.test(str)) return false;
  if (/ParametreListeleResponse/i.test(str) && !/<soap:Fault>/i.test(str)) return true;
  return null;
}

function parseParametreListeleMessage(xmlStr) {
  const str = typeof xmlStr === 'string' ? xmlStr : String(xmlStr || '');
  if (!str) return null;
  const mesajMatch = str.match(/<Mesaj[^>]*>([^<]*)<\/Mesaj>/i) || str.match(/<mesaj[^>]*>([^<]*)<\/mesaj>/i);
  return mesajMatch ? mesajMatch[1].trim() : null;
}

module.exports = JandarmaKBS;

