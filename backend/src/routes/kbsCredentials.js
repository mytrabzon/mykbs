/**
 * KBS tesis bilgisi talep ve durum — request (create/update/delete) → admin onayı → approved.
 * Backend JWT (Prisma veya Supabase) ile; branch_id veya backend_tesis_id kullanılır.
 */
const express = require('express');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { encrypt } = require('../utils/kbsEncrypt');

const router = express.Router();

router.use(authenticateTesisOrSupabase);

function getBranchOrTesisId(req) {
  if (req.authSource === 'supabase') {
    return { branch_id: req.branchId, backend_tesis_id: null, backend_user_id: null, user_id: req.user?.id };
  }
  return { branch_id: null, backend_tesis_id: req.tesis?.id, backend_user_id: req.user?.id, user_id: null };
}

/** POST /kbs/credentials/request — create | update | delete */
router.post('/request', async (req, res) => {
  try {
    const { action, branch_id: bodyBranchId, tesis_kodu, web_servis_sifre } = req.body || {};
    if (!action || !['create', 'update', 'delete'].includes(action)) {
      return res.status(400).json({ message: 'action: create, update veya delete olmalı' });
    }
    if (!supabaseAdmin) return res.status(503).json({ message: 'Servis kullanılamıyor' });

    const { branch_id, backend_tesis_id, backend_user_id, user_id } = getBranchOrTesisId(req);
    const effectiveBranchId = bodyBranchId || branch_id;
    const effectiveTesisId = backend_tesis_id;

    if (action !== 'delete') {
      if (!tesis_kodu || !web_servis_sifre) {
        return res.status(400).json({ message: 'tesis_kodu ve web_servis_sifre gerekli' });
      }
    }

    const insert = {
      user_id: user_id || null,
      branch_id: effectiveBranchId || null,
      backend_user_id: backend_user_id ?? null,
      backend_tesis_id: effectiveTesisId ?? null,
      tesis_kodu: tesis_kodu || '',
      web_servis_sifre: web_servis_sifre || '',
      action,
      status: 'pending',
    };

    const { data, error } = await supabaseAdmin.from('facility_credentials_requests').insert(insert).select('id').single();
    if (error) {
      console.error('[kbs/credentials/request]', error);
      return res.status(500).json({ message: 'Talep kaydedilemedi', error: error.message });
    }
    res.status(201).json({ message: 'Talep oluşturuldu, onay bekleniyor', requestId: data.id });
  } catch (err) {
    console.error('[kbs/credentials/request]', err);
    res.status(500).json({ message: 'Talep hatası', error: err.message });
  }
});

/** GET /kbs/credentials/status?branch_id=... — state: NONE | PENDING | APPROVED, lastRequest?, approved? */
router.get('/status', async (req, res) => {
  try {
    const branchId = req.query.branch_id || null;
    if (!supabaseAdmin) return res.status(503).json({ message: 'Servis kullanılamıyor' });

    const { branch_id, backend_tesis_id, backend_user_id, user_id } = getBranchOrTesisId(req);
    const effectiveBranchId = branchId || branch_id;
    const effectiveTesisId = backend_tesis_id;

    let pendingRequest = null;
    let approvedRow = null;

    if (effectiveTesisId != null && backend_user_id != null) {
      const { data: pending } = await supabaseAdmin
        .from('facility_credentials_requests')
        .select('id, action, status, created_at')
        .eq('backend_tesis_id', effectiveTesisId)
        .eq('backend_user_id', backend_user_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      pendingRequest = pending || null;

      const { data: cred } = await supabaseAdmin
        .from('facility_credentials')
        .select('id, tesis_kodu, updated_at')
        .eq('backend_tesis_id', effectiveTesisId)
        .eq('backend_user_id', backend_user_id)
        .eq('is_active', true)
        .maybeSingle();
      approvedRow = cred || null;
    } else if (effectiveBranchId && user_id) {
      const { data: pending } = await supabaseAdmin
        .from('facility_credentials_requests')
        .select('id, action, status, created_at')
        .eq('branch_id', effectiveBranchId)
        .eq('user_id', user_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      pendingRequest = pending || null;

      const { data: cred } = await supabaseAdmin
        .from('facility_credentials')
        .select('id, tesis_kodu, updated_at')
        .eq('branch_id', effectiveBranchId)
        .eq('user_id', user_id)
        .eq('is_active', true)
        .maybeSingle();
      approvedRow = cred || null;
    }

    let state = 'NONE';
    if (pendingRequest) state = 'PENDING';
    else if (approvedRow) state = 'APPROVED';
    // Supabase: branch üzerinde KBS bilgisi kayıtlıysa doğrudan bağlı say (kaydedince bağlanır)
    else if (effectiveBranchId && req.authSource === 'supabase' && req.branch) {
      const b = req.branch;
      if (b.kbs_tesis_kodu && String(b.kbs_tesis_kodu).trim() && b.kbs_web_servis_sifre && String(b.kbs_web_servis_sifre).trim()) {
        state = 'APPROVED';
      }
    }

    res.json({
      state,
      lastRequest: pendingRequest ? { id: pendingRequest.id, action: pendingRequest.action, created_at: pendingRequest.created_at } : null,
      approved: approvedRow ? { id: approvedRow.id, tesis_kodu: approvedRow.tesis_kodu, updated_at: approvedRow.updated_at } : null,
    });
  } catch (err) {
    console.error('[kbs/credentials/status]', err);
    res.status(500).json({ message: 'Durum alınamadı', error: err.message });
  }
});

module.exports = router;
