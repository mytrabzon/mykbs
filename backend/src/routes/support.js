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
 * GET /api/support — Giriş yapmış kullanıcının kendi talepleri (mobil: benim taleplerim)
 */
router.get('/', authenticateTesisOrSupabase, async (req, res) => {
  try {
    const where = {};
    if (req.authSource === 'supabase' && req.user?.id) {
      where.authorUserId = String(req.user.id);
    } else if (req.authSource === 'prisma' && req.tesis?.id) {
      where.tesisId = req.tesis.id;
    } else {
      return res.json({ tickets: [] });
    }
    const tickets = await prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { tesis: { select: { id: true, tesisAdi: true } } },
    });
    res.json({
      tickets: tickets.map((t) => ({
        id: t.id,
        tesisAdi: t.tesis?.tesisAdi ?? null,
        authorName: t.authorName,
        subject: t.subject,
        message: t.message,
        status: t.status,
        adminNote: t.adminNote,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (err) {
    console.error('[support] list mine', err);
    res.status(500).json({ message: 'Talepler alınamadı', error: err?.message || 'Server error' });
  }
});

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
    const authorUserId = req.authSource === 'supabase' && req.user?.id ? String(req.user.id) : null;

    const ticket = await prisma.supportTicket.create({
      data: {
        tesisId,
        authorUserId,
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
