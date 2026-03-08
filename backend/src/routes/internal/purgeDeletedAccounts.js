/**
 * POST /internal/purge-deleted-accounts — 7 gün önce silme talebinde bulunmuş hesapları kalıcı siler.
 * Supabase profiles + Prisma Kullanici. Railway cron (günlük) veya manuel. Header: x-worker-secret
 */
const express = require('express');
const { supabaseAdmin } = require('../../lib/supabaseAdmin');
const { prisma } = require('../../lib/prisma');

const router = express.Router();
const WORKER_SECRET = process.env.WORKER_SECRET;
const DELETION_GRACE_DAYS = 7;

router.post('/purge-deleted-accounts', async (req, res) => {
  const secret = req.headers['x-worker-secret'];
  if (!WORKER_SECRET || secret !== WORKER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const cutoff = new Date(Date.now() - DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();
  const purged = [];
  const purgedPrisma = [];
  const errors = [];

  try {
    // 1) Prisma Kullanici — silme talebi 7 günden eski olanları sil (HotelStaff cascade ile silinir)
    if (prisma) {
      try {
        const toDelete = await prisma.kullanici.findMany({
          where: { deletion_requested_at: { lt: cutoff, not: null } },
          select: { id: true }
        });
        for (const k of toDelete) {
          try {
            await prisma.kullanici.delete({ where: { id: k.id } });
            purgedPrisma.push(k.id);
          } catch (e) {
            console.error('[purge-deleted-accounts] Prisma delete error:', k.id, e?.message || e);
            errors.push({ userId: k.id, source: 'prisma', error: e?.message || String(e) });
          }
        }
      } catch (e) {
        console.error('[purge-deleted-accounts] Prisma list error:', e?.message || e);
        errors.push({ source: 'prisma_list', error: e?.message || String(e) });
      }
    }

    // 2) Supabase profiles
    if (!supabaseAdmin) {
      return res.json({
        ok: true,
        purged: purged.length,
        purgedIds: purged,
        purgedPrisma: purgedPrisma.length,
        purgedPrismaIds: purgedPrisma,
        errors: errors.length ? errors : undefined,
      });
    }

    const { data: profiles, error: listErr } = await supabaseAdmin
      .from('profiles')
      .select('id, deletion_requested_at')
      .not('deletion_requested_at', 'is', null)
      .lt('deletion_requested_at', cutoffIso);

    if (listErr) {
      console.error('[purge-deleted-accounts] list error:', listErr);
      return res.status(500).json({ error: listErr.message });
    }

    for (const row of profiles || []) {
      const userId = row.id;
      try {
        const { data: upRows } = await supabaseAdmin.from('user_profiles').select('branch_id').eq('user_id', userId);
        const branchIds = (upRows || []).map((r) => r.branch_id).filter(Boolean);

        await supabaseAdmin.from('user_profiles').delete().eq('user_id', userId);

        for (const branchId of branchIds) {
          await supabaseAdmin.from('kbs_outbox').delete().eq('branch_id', branchId);
          await supabaseAdmin.from('audit_logs').delete().eq('branch_id', branchId);
          await supabaseAdmin.from('notifications').delete().eq('branch_id', branchId);
          await supabaseAdmin.from('guests').delete().eq('branch_id', branchId);
          await supabaseAdmin.from('documents').delete().eq('branch_id', branchId);
          await supabaseAdmin.from('branches').delete().eq('id', branchId);
        }

        await supabaseAdmin.from('profiles').delete().eq('id', userId);

        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (delErr) {
          console.error('[purge-deleted-accounts] deleteUser error:', userId, delErr);
          errors.push({ userId, error: delErr.message });
        } else {
          purged.push(userId);
        }
      } catch (e) {
        console.error('[purge-deleted-accounts] user error:', userId, e);
        errors.push({ userId, error: e?.message || String(e) });
      }
    }

    return res.json({
      ok: true,
      purged: purged.length,
      purgedIds: purged,
      purgedPrisma: purgedPrisma.length,
      purgedPrismaIds: purgedPrisma,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    console.error('[purge-deleted-accounts]', e);
    return res.status(500).json({ error: e?.message || 'Purge failed' });
  }
});

module.exports = router;
