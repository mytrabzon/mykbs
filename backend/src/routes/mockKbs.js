/**
 * Mock KBS: POLIS_KBS_URL / JANDARMA_KBS_URL boşken otomatik kullanılır.
 * Ayrıca manuel test için POST /mock/kbs - gelen payload'ı loglar, 200 döner.
 */
const express = require('express');
const router = express.Router();

router.post('/kbs', (req, res) => {
  const body = req.body || {};
  console.log('[Mock KBS]', new Date().toISOString(), JSON.stringify(body));
  res.status(200).json({ success: true, message: 'Mock KBS OK', received: Object.keys(body) });
});

module.exports = router;
