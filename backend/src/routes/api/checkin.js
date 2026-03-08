/**
 * KBS backend API: checkin, checkout, room-change.
 * 1) DB yaz 2) kbs_outbox'a ekle (kbs_configured ise) 3) attemptSendOutbox hemen dene.
 */
const express = require('express');
const { supabaseAdmin } = require('../../lib/supabaseAdmin');
const { authenticateSupabase } = require('../../middleware/authSupabase');
const { errorResponse } = require('../../lib/errorResponse');
const { createOutbox } = require('../../repo/kbsOutboxRepo');
const { attemptSendOutbox } = require('../../worker/kbsOutboxWorker');

const router = express.Router();
router.use(authenticateSupabase);

/**
 * POST /api/checkin
 * Body: { branch_id, guest: { ad, soyad, kimlikNo?, pasaportNo?, dogumTarihi, uyruk }, room_id?, room_number?, checkin_at? }
 * Mobil uyumluluk: odaId, ad, soyad, kimlikNo, pasaportNo, dogumTarihi, uyruk
 */
router.post('/checkin', async (req, res) => {
  try {
    if (req.user?.is_anonymous) {
      return errorResponse(req, res, 403, 'GUEST_EMAIL_REQUIRED', 'KBS bilgilerini doldurmak için e-posta doğrulaması gerekli. Profil > Telefon ve e-posta bağla bölümünden e-posta ekleyip doğrulayın.');
    }
    const body = req.body || {};
    const branchId = req.branchId;
    const branch = req.branch || {};
    if (branch.kbs_configured && !branch.kbs_approved) {
      return errorResponse(req, res, 409, 'APPROVAL_REQUIRED', 'KBS bilgileriniz admin onayından sonra aktif olacaktır.');
    }

    const ad = body.ad || '';
    const soyad = body.soyad || '';
    const fullName = [ad, soyad].filter(Boolean).join(' ') || 'Misafir';
    const kimlikNo = body.kimlikNo || null;
    const pasaportNo = body.pasaportNo || null;
    const dogumTarihi = body.dogumTarihi || null;
    const uyruk = body.uyruk || 'TÜRK';
    const odaId = body.odaId || body.room_id || null;
    const roomNumber = body.room_number || body.odaNumarasi || null;
    const checkinAt = body.checkin_at ? new Date(body.checkin_at) : new Date();

    if (!ad.trim() || !soyad.trim()) {
      return res.status(400).json({ message: 'Ad ve soyad gerekli' });
    }
    if (!kimlikNo && !pasaportNo) {
      return res.status(400).json({ message: 'Kimlik veya pasaport numarası gerekli' });
    }

    if (!supabaseAdmin) {
      return errorResponse(req, res, 503, 'UNHANDLED_ERROR', 'Supabase yapılandırılmamış');
    }

    const { data: guest, error: guestErr } = await supabaseAdmin
      .from('guests')
      .insert({
        branch_id: branchId,
        full_name: fullName,
        nationality: uyruk,
        document_type: kimlikNo ? 'tc' : 'pasaport',
        document_no: kimlikNo || pasaportNo,
        birth_date: dogumTarihi || null,
        room_number: roomNumber || null
      })
      .select('id')
      .single();

    if (guestErr) {
      console.error('[checkin] guests insert', guestErr);
      return errorResponse(req, res, 500, 'UNHANDLED_ERROR', guestErr?.message || 'Misafir kaydı oluşturulamadı');
    }

    const guestId = guest.id;

    await supabaseAdmin.from('audit_logs').insert({
      branch_id: branchId,
      user_id: req.user.id,
      action: 'checkin_create',
      entity: 'guests',
      entity_id: guestId,
      meta_json: { odaId, room_number: roomNumber }
    });

    const kbsPayload = {
      type: 'checkin',
      guest_id: guestId,
      ad,
      soyad,
      kimlikNo,
      pasaportNo,
      dogumTarihi,
      uyruk,
      girisTarihi: checkinAt.toISOString(),
      odaNumarasi: roomNumber || '0'
    };

    let kbsStatus = 'kbs_off';
    const kbsEnabled = branch.kbs_configured && branch.kbs_approved && branch.kbs_turu && branch.kbs_tesis_kodu && branch.kbs_web_servis_sifre;

    if (kbsEnabled) {
      try {
        const outboxId = await createOutbox(branchId, 'checkin', kbsPayload);
        setImmediate(() => attemptSendOutbox(outboxId).catch((e) => console.error('[checkin] attemptSendOutbox', e)));
        kbsStatus = 'pending';
      } catch (outboxErr) {
        console.error('[checkin] kbs_outbox create', outboxErr);
      }
    }

    res.status(201).json({
      ok: true,
      message: 'Check-in kaydedildi',
      guestId,
      checkin_id: guestId,
      kbs_status: kbsStatus,
      kbs_message: kbsStatus === 'pending' ? 'Bildirim kuyruğa alındı' : 'KBS yapılandırılmamış'
    });
  } catch (err) {
    console.error('[checkin]', err);
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', err?.message || 'Check-in başarısız');
  }
});

/**
 * POST /api/checkout (body: guest_id) veya POST /api/checkout/:guestId
 */
router.post('/checkout/:guestId?', async (req, res) => {
  try {
    if (req.user?.is_anonymous) {
      return errorResponse(req, res, 403, 'GUEST_EMAIL_REQUIRED', 'KBS işlemleri için e-posta doğrulaması gerekli. Profil > E-posta ekleyin.');
    }
    const guestId = req.params?.guestId || req.body?.guest_id || req.body?.misafirId;
    const branchId = req.branchId;
    if (!guestId) {
      return res.status(400).json({ message: 'guest_id gerekli' });
    }

    const { data: guest, error: gErr } = await supabaseAdmin
      .from('guests')
      .select('id, full_name, document_no, document_type, room_number')
      .eq('id', guestId)
      .eq('branch_id', branchId)
      .is('checkout_at', null)
      .single();

    if (gErr || !guest) {
      return res.status(404).json({ message: 'Aktif misafir bulunamadı' });
    }

    const checkoutAt = new Date();

    const { error: upErr } = await supabaseAdmin
      .from('guests')
      .update({ checkout_at: checkoutAt.toISOString() })
      .eq('id', guestId);

    if (upErr) {
      return errorResponse(req, res, 500, 'UNHANDLED_ERROR', upErr?.message || 'Çıkış güncellenemedi');
    }

    const kimlikNo = guest.document_type === 'tc' ? guest.document_no : null;
    const pasaportNo = guest.document_type === 'pasaport' ? guest.document_no : null;

    const kbsPayload = {
      type: 'checkout',
      guest_id: guestId,
      kimlikNo,
      pasaportNo,
      cikisTarihi: checkoutAt.toISOString()
    };

    const branch = req.branch || {};
    const kbsEnabled = branch.kbs_configured && branch.kbs_turu && branch.kbs_tesis_kodu && branch.kbs_web_servis_sifre;
    if (kbsEnabled) {
      try {
        const outboxId = await createOutbox(branchId, 'checkout', kbsPayload);
        setImmediate(() => attemptSendOutbox(outboxId).catch((e) => console.error('[checkout] attemptSendOutbox', e)));
      } catch (e) { console.error('[checkout] createOutbox', e); }
    }

    await supabaseAdmin.from('audit_logs').insert({
      branch_id: branchId,
      user_id: req.user.id,
      action: 'checkout',
      entity: 'guests',
      entity_id: guestId,
      meta_json: { checkout_at: checkoutAt.toISOString() }
    });

    res.json({ ok: true, message: 'Çıkış yapıldı', guest_id: guestId });
  } catch (err) {
    console.error('[checkout]', err);
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', err?.message || 'Çıkış başarısız');
  }
});

/**
 * POST /api/room-change
 * Body: { guest_id, yeni_oda_id?, yeni_oda_numara }
 */
router.post('/room-change', async (req, res) => {
  try {
    if (req.user?.is_anonymous) {
      return errorResponse(req, res, 403, 'GUEST_EMAIL_REQUIRED', 'KBS işlemleri için e-posta doğrulaması gerekli. Profil > E-posta ekleyin.');
    }
    const guestId = req.body?.guest_id || req.body?.misafirId;
    const yeniOdaNumara = req.body?.yeni_oda_numara || req.body?.yeniOdaNumarasi || req.body?.room_number;
    const branchId = req.branchId;

    if (!guestId || !yeniOdaNumara) {
      return res.status(400).json({ message: 'guest_id ve yeni oda numarası gerekli' });
    }

    const { data: guest, error: gErr } = await supabaseAdmin
      .from('guests')
      .select('id, full_name, document_no, document_type, room_number')
      .eq('id', guestId)
      .eq('branch_id', branchId)
      .is('checkout_at', null)
      .single();

    if (gErr || !guest) {
      return res.status(404).json({ message: 'Aktif misafir bulunamadı' });
    }

    const eskiOda = guest.room_number || '0';

    const { error: upErr } = await supabaseAdmin
      .from('guests')
      .update({ room_number: String(yeniOdaNumara) })
      .eq('id', guestId);

    if (upErr) {
      return errorResponse(req, res, 500, 'UNHANDLED_ERROR', upErr?.message || 'Oda güncellenemedi');
    }

    const kimlikNo = guest.document_type === 'tc' ? guest.document_no : null;
    const pasaportNo = guest.document_type === 'pasaport' ? guest.document_no : null;

    const kbsPayload = {
      type: 'room_change',
      guest_id: guestId,
      kimlikNo,
      pasaportNo,
      eskiOda,
      yeniOda: String(yeniOdaNumara)
    };

    const branch = req.branch || {};
    const kbsEnabled = branch.kbs_configured && branch.kbs_turu && branch.kbs_tesis_kodu && branch.kbs_web_servis_sifre;
    if (kbsEnabled) {
      try {
        const outboxId = await createOutbox(branchId, 'room_change', kbsPayload);
        setImmediate(() => attemptSendOutbox(outboxId).catch((e) => console.error('[room-change] attemptSendOutbox', e)));
      } catch (e) { console.error('[room-change] createOutbox', e); }
    }

    await supabaseAdmin.from('audit_logs').insert({
      branch_id: branchId,
      user_id: req.user.id,
      action: 'room_change',
      entity: 'guests',
      entity_id: guestId,
      meta_json: { eskiOda, yeniOda: String(yeniOdaNumara) }
    });

    res.json({ ok: true, message: 'Oda değiştirildi', guest_id: guestId });
  } catch (err) {
    console.error('[room-change]', err);
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', err?.message || 'Oda değişikliği başarısız');
  }
});

module.exports = router;
