const express = require('express');
const axios = require('axios');
const router = express.Router();

/** JANDARMA_KBS_URL erişilebilir mi, ne dönüyor (SOAP servis GET ?wsdl genelde 200) */
router.get('/kbs-ping', async (req, res) => {
  const baseURL = process.env.JANDARMA_KBS_URL || '';
  if (!baseURL) {
    return res.json({
      ok: false,
      message: 'JANDARMA_KBS_URL env tanımlı değil',
      hint: 'Backend .env veya VPS env\'e JANDARMA_KBS_URL ekleyin.',
    });
  }
  const wsdlUrl = baseURL.includes('?') ? `${baseURL}&wsdl` : `${baseURL}?wsdl`;
  try {
    const resp = await axios.get(wsdlUrl, {
      timeout: 15000,
      headers: { Accept: 'application/xml, text/xml, */*' },
      validateStatus: () => true,
    });
    const status = resp.status;
    const ok = status === 200;
    const contentType = resp.headers['content-type'] || '';
    const isXml = contentType.includes('xml') || (resp.data && typeof resp.data === 'string' && resp.data.includes('<?xml'));
    res.json({
      ok,
      status,
      url: wsdlUrl,
      message: ok
        ? (isXml ? 'KBS sunucusuna erişildi (WSDL/XML). Gerçek çağrılar SOAP formatında yapılmalı.' : 'Yanıt alındı (format kontrol edin).')
        : `KBS yanıt: HTTP ${status}. Servis SOAP/WCF ise REST yerine SOAP client gerekir.`,
      hint: status === 404 || status === 405 ? 'Resmi Jandarma KBS .svc servisi SOAP/WCF kullanır; mevcut REST client yanıt alamaz. SOAP client veya resmi API dokümanı gerekir.' : undefined,
    });
  } catch (err) {
    const code = err.code || '';
    const message = err.message || '';
    console.warn('[debug/kbs-ping]', code, message);
    res.json({
      ok: false,
      status: err.response?.status || null,
      code,
      message: code === 'ETIMEDOUT' || code === 'ECONNABORTED'
        ? 'Zaman aşımı. Sunucu IP whitelist (KBS tarafında) ve firewall kontrol edin.'
        : code === 'ECONNREFUSED'
          ? 'Bağlantı reddedildi'
          : code === 'ENOTFOUND'
            ? 'DNS çözülemedi'
            : message,
      url: wsdlUrl,
      hint: 'VPS kullanıyorsanız GET /debug/egress-ip ile çıkan IP\'yi Jandarma KBS whitelist\'e yazdırın.',
    });
  }
});

/**
 * Egress IP: Backend'in dışarıya (internete) çıkarken kullandığı IP.
 * KBS whitelist'e yazılacak IP'yi doğrulamak için kullanılır.
 * VPS (örn. Hetzner 178.104.12.20) kullanıyorsanız bu endpoint 178.104.12.20 dönmeli.
 * Auth gerekmez; curl http://BACKEND/debug/egress-ip ile test edilebilir.
 */
router.get('/egress-ip', async (req, res) => {
  try {
    const resp = await axios.get('https://api.ipify.org?format=json', {
      timeout: 5000,
      headers: { 'Accept': 'application/json' },
    });
    const data = resp?.data || {};
    const ip = data?.ip || null;
    if (!ip) {
      return res.status(502).json({
        ok: false,
        message: 'Egress IP alınamadı',
        hint: 'api.ipify.org yanıt vermedi veya format değişti.',
      });
    }
    res.json({ ok: true, ip, ts: new Date().toISOString() });
  } catch (err) {
    console.error('[debug/egress-ip]', err?.message || err);
    res.status(502).json({
      ok: false,
      message: err?.message || 'Egress IP sorgulanamadı',
    });
  }
});

module.exports = router;
