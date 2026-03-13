/**
 * KBS tanı ve bağlantı testi endpoint'leri.
 * SABIT_IP, JANDARMA_KBS_URL, POLIS_KBS_URL durumunu ve erişilebilirliği döner.
 */
const express = require('express');
const axios = require('axios');
const router = express.Router();

async function testUrl(url, timeoutMs = 5000) {
  if (!url || !url.trim()) return { status: 'URL tanımlı değil' };
  try {
    const response = await axios.get(url.trim(), {
      timeout: timeoutMs,
      validateStatus: () => true,
      headers: { Accept: 'application/xml, text/xml, */*' },
    });
    return {
      status: 'ulaşılabilir',
      httpCode: response.status,
      ip: process.env.SABIT_IP || null,
    };
  } catch (error) {
    return {
      status: 'ulaşılamadı',
      error: error.message || 'Bilinmeyen hata',
      code: error.code || null,
      ip: process.env.SABIT_IP || null,
    };
  }
}

/**
 * GET /api/kbs/test-connection
 * Sabit IP ve KBS URL'lerinin tanımlı olup olmadığını ve hedef sunuculara erişimi test eder.
 * Auth gerekmez (tanı/diagnostic).
 */
router.get('/test-connection', async (req, res) => {
  try {
    const sabitIp = (process.env.SABIT_IP || '').trim() || null;
    const jandarmaUrl = (process.env.JANDARMA_KBS_URL || '').trim() || null;
    const polisUrl = (process.env.POLIS_KBS_URL || '').trim() || null;

    const [jandarmaTest, polisTest] = await Promise.all([
      testUrl(jandarmaUrl),
      testUrl(polisUrl),
    ]);

    const testResult = {
      sabitIp: sabitIp || 'Tanımlı değil (GET /debug/egress-ip ile gerçek çıkış IP öğrenilir)',
      jandarmaUrl: jandarmaUrl ? 'Tanımlı' : 'Tanımlı değil',
      polisUrl: polisUrl ? 'Tanımlı' : 'Tanımlı değil',
      jandarmaTest,
      polisTest,
      ts: new Date().toISOString(),
    };

    res.json(testResult);
  } catch (error) {
    console.error('[KBS test-connection]', error?.message || error);
    res.status(500).json({
      error: error.message || 'Test başarısız',
      sabitIp: process.env.SABIT_IP || 'Tanımlı değil',
    });
  }
});

module.exports = router;
