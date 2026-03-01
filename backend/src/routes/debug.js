const express = require('express');
const axios = require('axios');
const router = express.Router();

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
