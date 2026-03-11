/**
 * Destek talepleri: mobil hamburger menüden POST; admin panel GET /api/app-admin/support ile listeler.
 */
const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');

const router = express.Router();

function getAuthorInfo(req) {
  if (req.authSource === 'prisma' && req.user) {
    const adSoyad = (req.user.adSoyad || req.user.ad + ' ' + (req.user.soyad || '')).trim() || 'Kullanıcı';
    const email = req.user.email || req.user.telefon || null;
    return { authorName: adSoyad, authorEmail: email };
  }
  if (req.authSource === 'supabase' && req.user) {
    const u = req.user;
    const name = u.user_metadata?.full_name || u.user_metadata?.ad_soyad || u.email || u.phone || 'Kullanıcı';
    const email = u.email || u.phone || null;
    return { authorName: String(name), authorEmail: email };
  }
  return { authorName: 'Kullanıcı', authorEmail: null };
}

function getTesisId(req) {
  if (req.authSource === 'prisma' && req.tesis?.id) return req.tesis.id;
  return null;
}

/**
 * POST /api/support — Destek talebi oluştur (mobil, giriş yapmış kullanıcı)
 * Body: { subject: string, message: string }
 */
router.post('/', authenticateTesisOrSupabase, express.json(), async (req, res) => {
  try {
    const { subject, message } = req.body || {};
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ message: 'Konu gerekli' });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ message: 'Mesaj gerekli' });
    }
    const { authorName, authorEmail } = getAuthorInfo(req);
    const tesisId = getTesisId(req);

    const ticket = await prisma.supportTicket.create({
      data: {
        tesisId,
        authorName: authorName.trim(),
        authorEmail: (authorEmail && String(authorEmail).trim()) || null,
        subject: subject.trim().slice(0, 500),
        message: message.trim().slice(0, 10000),
        status: 'acik',
      },
    });

    res.status(201).json({
      message: 'Destek talebiniz alındı. En kısa sürede dönüş yapacağız.',
      id: ticket.id,
      createdAt: ticket.createdAt,
    });
  } catch (err) {
    console.error('[support] create', err);
    res.status(500).json({ message: 'Talep gönderilemedi', error: err?.message || 'Server error' });
  }
});

module.exports = router;
