const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');

/**
 * POST /kyc/mrz-verify
 * Body: { passportNumber, birthDate, expiryDate, issuingCountry?, docType? }
 * Response: { verification_id, status, next }
 */
router.post('/mrz-verify', async (req, res) => {
  try {
    const { passportNumber, birthDate, expiryDate, issuingCountry = '', docType = 'OTHER' } = req.body || {};
    if (!passportNumber || !birthDate || !expiryDate) {
      return res.status(400).json({
        verification_id: null,
        status: 'REJECTED',
        next: 'DONE',
        error: 'passportNumber, birthDate, expiryDate required',
      });
    }
    const passportLast4 = String(passportNumber).trim().slice(-4);
    const record = await prisma.kycVerification.create({
      data: {
        type: 'MRZ',
        passportLast4,
        birthDate: String(birthDate),
        expiryDate: String(expiryDate),
        issuingCountry: String(issuingCountry).slice(0, 3),
        status: 'PENDING',
      },
    });
    return res.json({
      verification_id: record.id,
      status: record.status,
      next: 'NFC',
    });
  } catch (e) {
    console.error('kyc mrz-verify error', e);
    // Tablo yoksa (migration uygulanmamışsa) veya DB hatası: istemci 500 yerine 200 + REJECTED görsün, uygulama kilitlenmesin
    const isTableMissing = e?.code === 'P2021' || (e?.message && /does not exist|relation.*not found/i.test(e.message));
    return res.status(isTableMissing ? 200 : 500).json({
      verification_id: null,
      status: 'REJECTED',
      next: 'DONE',
      error: isTableMissing ? 'kyc_table_missing' : 'server_error',
    });
  }
});

module.exports = router;
