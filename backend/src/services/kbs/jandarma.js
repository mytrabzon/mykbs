const axios = require('axios');

const KBS_TIMEOUT_MS = 10000; // 10 saniye
const KBS_RETRY_COUNT = 3;

/** Jandarma KBS resmi namespace (tempuri.org geçici/örnek, kullanılmaz) */
const JANDARMA_KBS_NS = 'http://jandarma.gov.tr/kbs';

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

/** Jandarma KBS tarih formatı: DD.MM.YYYY (doğum tarihi vb.) */
function formatDateForKbs(value) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).trim();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/** Jandarma KBS tarih-saat formatı: DD.MM.YYYY HH:mm (giriş/çıkış) */
function formatDateTimeForKbs(value) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).trim();
  const datePart = formatDateForKbs(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} ${hours}:${minutes}`;
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
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
    '  <soap:Body>',
    '    <ParametreListele xmlns="' + JANDARMA_KBS_NS + '">',
    '      <TesisKodu>' + t + '</TesisKodu>',
    '      <Sifre>' + s + '</Sifre>',
    '    </ParametreListele>',
    '  </soap:Body>',
    '</soap:Envelope>'
  ].join('\n');
}

/**
 * Jandarma KBS – Misafir giriş bildirimi (SOAP). Namespace: http://jandarma.gov.tr/kbs (tempuri.org kullanılmaz).
 * Ad = ad, Ad2 = baba adı, AnaAdi = ana adı (ayrı; karıştırılmaz).
 */
function buildMisafirGirisSoapEnvelope(tesisKodu, webServisSifre, misafir) {
  const t = escapeXml(tesisKodu);
  const s = escapeXml(webServisSifre);
  const ad = escapeXml(misafir.ad);
  const ad2 = escapeXml(misafir.ad2 || '');
  const anaAdi = escapeXml(misafir.anaAdi || '');
  const soyad = escapeXml(misafir.soyad);
  const tcKimlikNo = escapeXml(misafir.kimlikNo || '');
  const pasaportNo = escapeXml(misafir.pasaportNo || '');
  const dogumTarihi = escapeXml(formatDateForKbs(misafir.dogumTarihi) || '');
  const uyruk = escapeXml(misafir.uyruk || 'TÜRK');
  const girisTarihi = escapeXml(formatDateTimeForKbs(misafir.girisTarihi) || '');
  const odaNo = escapeXml(misafir.odaNumarasi || '');
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
    '  <soap:Body>',
    '    <MisafirGiris xmlns="' + JANDARMA_KBS_NS + '">',
    '      <TesisKodu>' + t + '</TesisKodu>',
    '      <Sifre>' + s + '</Sifre>',
    '      <Ad>' + ad + '</Ad>',
    '      <Ad2>' + ad2 + '</Ad2>',
    '      <AnaAdi>' + anaAdi + '</AnaAdi>',
    '      <Soyad>' + soyad + '</Soyad>',
    '      <TcKimlikNo>' + tcKimlikNo + '</TcKimlikNo>',
    '      <PasaportNo>' + pasaportNo + '</PasaportNo>',
    '      <DogumTarihi>' + dogumTarihi + '</DogumTarihi>',
    '      <Uyruk>' + uyruk + '</Uyruk>',
    '      <GirisTarihi>' + girisTarihi + '</GirisTarihi>',
    '      <OdaNo>' + odaNo + '</OdaNo>',
    '    </MisafirGiris>',
    '  </soap:Body>',
    '</soap:Envelope>'
  ].join('\n');
}

/**
 * Jandarma KBS – Misafir çıkış bildirimi (SOAP). Namespace: http://jandarma.gov.tr/kbs
 */
function buildMisafirCikisSoapEnvelope(tesisKodu, webServisSifre, misafir) {
  const t = escapeXml(tesisKodu);
  const s = escapeXml(webServisSifre);
  const tcKimlikNo = escapeXml(misafir.kimlikNo || '');
  const pasaportNo = escapeXml(misafir.pasaportNo || '');
  const cikisTarihi = escapeXml(formatDateTimeForKbs(misafir.cikisTarihi) || '');
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">',
    '  <soap:Body>',
    '    <MisafirCikis xmlns="' + JANDARMA_KBS_NS + '">',
    '      <TesisKodu>' + t + '</TesisKodu>',
    '      <Sifre>' + s + '</Sifre>',
    '      <TcKimlikNo>' + tcKimlikNo + '</TcKimlikNo>',
    '      <PasaportNo>' + pasaportNo + '</PasaportNo>',
    '      <CikisTarihi>' + cikisTarihi + '</CikisTarihi>',
    '    </MisafirCikis>',
    '  </soap:Body>',
    '</soap:Envelope>'
  ].join('\n');
}

/** Axios ile SOAP isteği atar; 3 deneme, 10 sn timeout. */
async function soapPost(baseURL, body, soapAction) {
  const opts = {
    timeout: KBS_TIMEOUT_MS,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': soapAction
    },
    validateStatus: () => true
  };
  let lastErr;
  for (let i = 0; i < KBS_RETRY_COUNT; i++) {
    try {
      const response = await axios.post(baseURL, body, opts);
      return response;
    } catch (err) {
      lastErr = err;
      if (i < KBS_RETRY_COUNT - 1) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
    }
  }
  throw lastErr;
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
    const soapAction = JANDARMA_KBS_NS + '/IParametreListele';
    const body = buildParametreListeleSoapEnvelope(this.tesisKodu, this.webServisSifre);
    try {
      const response = await soapPost(this.baseURL, body, soapAction);

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
   * Misafir bildirimi gönder (SOAP MisafirGiris). 3 deneme, 10 sn timeout.
   * Jandarma KBS zorunlu alanlar: Ad, Soyad; TcKimlikNo veya PasaportNo (en az biri); Doğum Tarihi; Giriş Tarihi.
   */
  async bildirimGonder(misafirData) {
    if (!this.baseURL) {
      return { success: false, durum: 'hatali', hataMesaji: 'JANDARMA_KBS_URL ortam değişkeni tanımlı değil.' };
    }
    const ad = (misafirData.ad && String(misafirData.ad).trim()) || '';
    const soyad = (misafirData.soyad && String(misafirData.soyad).trim()) || '';
    const kimlikNo = (misafirData.kimlikNo && String(misafirData.kimlikNo).trim()) || '';
    const pasaportNo = (misafirData.pasaportNo && String(misafirData.pasaportNo).trim()) || '';
    if (!ad || !soyad) {
      return { success: false, durum: 'hatali', hataMesaji: 'Jandarma KBS için ad ve soyad zorunludur.' };
    }
    if (!kimlikNo && !pasaportNo) {
      return { success: false, durum: 'hatali', hataMesaji: 'Jandarma KBS için TC kimlik no veya pasaport no zorunludur (en az biri).' };
    }
    if (!misafirData.dogumTarihi) {
      return { success: false, durum: 'hatali', hataMesaji: 'Jandarma KBS için doğum tarihi zorunludur.' };
    }
    if (!misafirData.girisTarihi) {
      return { success: false, durum: 'hatali', hataMesaji: 'Jandarma KBS için giriş tarihi zorunludur.' };
    }
    // ContractFilter mismatch hatası alırsanız WCF bazen operasyon adı bekler: /MisafirGiris. Eski: /IMisafirGiris
    const soapAction = JANDARMA_KBS_NS + '/MisafirGiris';
    const body = buildMisafirGirisSoapEnvelope(this.tesisKodu, this.webServisSifre, {
      ad: misafirData.ad,
      ad2: misafirData.ad2 || null,
      anaAdi: misafirData.anaAdi || null,
      soyad: misafirData.soyad,
      kimlikNo: misafirData.kimlikNo || null,
      pasaportNo: misafirData.pasaportNo || null,
      dogumTarihi: misafirData.dogumTarihi,
      uyruk: misafirData.uyruk || 'TÜRK',
      girisTarihi: misafirData.girisTarihi,
      odaNumarasi: misafirData.odaNumarasi || '0'
    });
    try {
      const response = await soapPost(this.baseURL, body, soapAction);
      const status = response.status;
      const data = response.data;

      if (status !== 200) {
        if (status === 401) return { success: false, durum: 'hatali', hataMesaji: 'Web servis şifresi hatalı' };
        if (status === 403) return { success: false, durum: 'hatali', hataMesaji: 'Bu IP yetkili değil. Backend çıkış IP\'sini Jandarma KBS whitelist\'e ekleyin.' };
        const faultMsg = status === 500 ? parseSoapFaultMessage(data) : null;
        return { success: false, durum: 'hatali', hataMesaji: faultMsg || `KBS yanıt: HTTP ${status}`, yanit: data };
      }

      const fault = parseSoapFault(data);
      if (fault) return { success: false, durum: 'hatali', hataMesaji: fault, yanit: data };

      const basarili = parseParametreListeleSuccess(data);
      if (basarili === false) {
        const msg = parseParametreListeleMessage(data);
        return { success: false, durum: 'hatali', hataMesaji: msg || 'Bildirim kabul edilmedi.', yanit: data };
      }
      return { success: true, durum: 'basarili', yanit: data };
    } catch (error) {
      const code = error.code || '';
      const msg = error.response?.data ? parseSoapFaultMessage(error.response.data) : null;
      const hataMesaji = msg || (code === 'ETIMEDOUT' || code === 'ECONNABORTED' ? 'KBS zaman aşımı (10 sn)' : error.message || 'KBS bağlantı hatası');
      console.warn('[JandarmaKBS] bildirimGonder failed', { code, message: error.message });
      return { success: false, durum: 'hatali', hataMesaji, yanit: error.response?.data };
    }
  }

  /**
   * Çıkış bildirimi gönder (SOAP MisafirCikis). 3 deneme, 10 sn timeout.
   */
  async cikisBildir(misafirData) {
    if (!this.baseURL) {
      return { success: false, hataMesaji: 'JANDARMA_KBS_URL ortam değişkeni tanımlı değil.' };
    }
    const soapAction = JANDARMA_KBS_NS + '/IMisafirCikis';
    const body = buildMisafirCikisSoapEnvelope(this.tesisKodu, this.webServisSifre, {
      kimlikNo: misafirData.kimlikNo || '',
      pasaportNo: misafirData.pasaportNo || '',
      cikisTarihi: misafirData.cikisTarihi || new Date().toISOString()
    });
    try {
      const response = await soapPost(this.baseURL, body, soapAction);
      const status = response.status;
      const data = response.data;

      if (status !== 200) {
        const faultMsg = status === 500 ? parseSoapFaultMessage(data) : null;
        return { success: false, hataMesaji: faultMsg || `KBS yanıt: HTTP ${status}`, yanit: data };
      }
      const fault = parseSoapFault(data);
      if (fault) return { success: false, hataMesaji: fault, yanit: data };
      return { success: true, yanit: data };
    } catch (error) {
      const code = error.code || '';
      const hataMesaji = code === 'ETIMEDOUT' || code === 'ECONNABORTED' ? 'KBS zaman aşımı (10 sn)' : (error.response?.data ? parseSoapFaultMessage(error.response.data) : null) || error.message || 'KBS bağlantı hatası';
      return { success: false, hataMesaji, yanit: error.response?.data };
    }
  }

  /**
   * KBS'te tesisin daha önce bildirdiği misafirleri listele.
   * Resmi Jandarma KBS servisi SOAP ile sadece giriş/çıkış/güncelleme sunar; misafir listesi sorgulama operasyonu yok.
   * Bu yüzden liste çekilemez; kullanıcıya açıklayıcı mesaj dönülür.
   */
  async misafirListesiGetir() {
    return {
      success: false,
      message: 'Jandarma KBS resmi servisi misafir listesi sorgulaması sunmuyor. Sadece yeni giriş/çıkış bildirimi yapılır. Mevcut misafirleri uygulamaya aktarmak için Odalar ekranından manuel check-in kullanın.',
      misafirler: []
    };
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

