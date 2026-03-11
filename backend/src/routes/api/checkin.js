/**
 * KBS backend API: checkin, checkout, room-change.
 * authenticateTesisOrSupabase kullanır: hem normal kullanıcı hem misafir (anonymous) şube atanmış olur, misafir girişi çalışır.
 * 1) DB yaz 2) kbs_outbox'a ekle (kbs_configured ise) 3) attemptSendOutbox hemen dene.
 */
const express = require('express');
const { supabaseAdmin } = require('../../lib/supabaseAdmin');
const { authenticateTesisOrSupabase } = require('../../middleware/authTesisOrSupabase');
const { errorResponse } = require('../../lib/errorResponse');
const { createOutbox } = require('../../repo/kbsOutboxRepo');
const { attemptSendOutbox } = require('../../worker/kbsOutboxWorker');
const { createKBSService } = require('../../services/kbs');

const router = express.Router();
router.use(authenticateTesisOrSupabase);

/**
 * POST /api/kbs/test-baglanti
 * Body: { tesisKodu?, sifre?, tur? } — boşsa branch KBS bilgisi kullanılır. Gecikme (ms) ve sonuç döner.
 */
router.post('/kbs/test-baglanti', async (req, res) => {
  try {
    const body = req.body || {};
    const tur = (body.tur || (req.branch && req.branch.kbs_turu) || 'jandarma').toLowerCase();
    let tesisLike;
    if (body.tesisKodu && body.sifre) {
      tesisLike = { kbsTuru: tur, kbsTesisKodu: String(body.tesisKodu).trim(), kbsWebServisSifre: body.sifre, ipAdresleri: [] };
    } else if (req.branch && req.branch.kbs_turu && req.branch.kbs_tesis_kodu && req.branch.kbs_web_servis_sifre) {
      tesisLike = { kbsTuru: req.branch.kbs_turu, kbsTesisKodu: req.branch.kbs_tesis_kodu, kbsWebServisSifre: req.branch.kbs_web_servis_sifre, ipAdresleri: [] };
    } else {
      return res.status(400).json({ success: false, mesaj: 'Tesis kodu ve şifre gerekli veya şube KBS bilgisi eksik.' });
    }
    const kbsService = createKBSService(tesisLike);
    const start = Date.now();
    const testResult = await kbsService.testBaglanti();
    const gecikme = Date.now() - start;
    if (testResult.success) {
      return res.json({ success: true, gecikme: `${gecikme}ms`, mesaj: 'Bağlantı başarılı', sunucu: tur === 'jandarma' ? 'Jandarma KBS' : 'Polis KBS' });
    }
    res.status(500).json({
      success: false,
      gecikme: `${gecikme}ms`,
      mesaj: testResult.message || 'Bağlantı başarısız',
      sunucu: tur === 'jandarma' ? 'Jandarma KBS' : 'Polis KBS',
      cozum: ['Tesis kodu ve şifreyi kontrol edin', 'IP adresinizi KBS sistemine tanımladınız mı?', 'Güvenlik duvarı ayarlarını kontrol edin']
    });
  } catch (err) {
    console.error('[kbs/test-baglanti]', err);
    return res.status(500).json({ success: false, mesaj: err?.message || 'Test başarısız' });
  }
});

/**
 * GET /api/checkin/aktif-misafirler
 * Branch'taki çıkış yapmamış misafirler (KBS'ye bildirdiğimiz kayıtlar). Oda bazlı gruplu, milisaniyeler içinde.
 */
router.get('/aktif-misafirler', async (req, res) => {
  try {
    const branchId = req.branchId;
    if (!branchId) {
      return res.status(409).json({ message: 'Tesis/şube bilgisi yüklenemedi.' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
    }

    const { data: misafirler, error } = await supabaseAdmin
      .from('guests')
      .select('id, full_name, nationality, document_type, document_no, room_number, checkin_at, birth_date')
      .eq('branch_id', branchId)
      .is('checkout_at', null)
      .order('checkin_at', { ascending: false });

    if (error) {
      console.error('[aktif-misafirler]', error);
      return res.status(500).json({ message: error.message || 'Liste alınamadı' });
    }

    const list = misafirler || [];
    const odalar = {};
    for (const m of list) {
      const odaNo = (m.room_number || '').toString().trim() || '—';
      if (!odalar[odaNo]) odalar[odaNo] = [];
      odalar[odaNo].push({
        id: m.id,
        ad: (m.full_name || '').split(' ').slice(0, -1).join(' ') || m.full_name,
        soyad: (m.full_name || '').split(' ').slice(-1)[0] || '—',
        full_name: m.full_name,
        belge_turu: m.document_type === 'tc' ? 'K' : 'P', // K=kimlik, P=pasaport
        belge_no: m.document_no,
        document_type: m.document_type,
        document_no: m.document_no,
        oda_no: odaNo,
        room_number: m.room_number,
        giris_tarihi: m.checkin_at,
        uyruk: m.nationality,
        dogum_tarihi: m.birth_date
      });
    }

    res.json({
      toplam: list.length,
      doluOda: Object.keys(odalar).length,
      odalar,
      misafirler: list
    });
  } catch (err) {
    console.error('[aktif-misafirler]', err);
    return res.status(500).json({ message: err?.message || 'Sunucu hatası' });
  }
});

/**
 * POST /api/checkin/batch
 * Offline-first sync: toplu check-in. Body: { notifications: [ { local_id, ad, soyad, kimlikNo?, pasaportNo?, dogumTarihi, uyruk, room_number } ] }
 * Her biri için: guests insert + kbs_outbox. KBS worker arka planda gönderir.
 */
router.post('/checkin/batch', async (req, res) => {
  try {
    const branchId = req.branchId;
    const branch = req.branch || {};
    const userId = req.user?.id;
    if (!branchId) {
      return res.status(409).json({ message: 'Tesis/şube bilgisi yüklenemedi.' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
    }

    const notifications = req.body?.notifications || [];
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({ message: 'notifications dizisi gerekli' });
    }
    if (notifications.length > 100) {
      return res.status(400).json({ message: 'En fazla 100 kayıt gönderilebilir' });
    }

    const kbsEnabled = branch.kbs_configured && branch.kbs_approved && branch.kbs_turu && branch.kbs_tesis_kodu && branch.kbs_web_servis_sifre;
    const success = [];
    const failed = [];

    for (const n of notifications) {
      const localId = n.local_id || n.id;
      const ad = (n.ad || '').trim();
      const soyad = (n.soyad || '').trim();
      const fullName = [ad, soyad].filter(Boolean).join(' ') || 'Misafir';
      const kimlikNo = n.kimlikNo || null;
      const pasaportNo = n.pasaportNo || null;
      const dogumTarihi = n.dogumTarihi || null;
      const uyruk = n.uyruk || 'TÜRK';
      const roomNumber = (n.room_number || n.odaNumarasi || '').toString().trim() || null;
      const checkinAt = n.checkin_at ? new Date(n.checkin_at) : new Date();

      if (!ad || !soyad) {
        failed.push({ local_id: localId, error: 'Ad ve soyad gerekli' });
        continue;
      }
      if (!kimlikNo && !pasaportNo) {
        failed.push({ local_id: localId, error: 'Kimlik veya pasaport numarası gerekli' });
        continue;
      }

      try {
        const { data: guest, error: guestErr } = await supabaseAdmin
          .from('guests')
          .insert({
            branch_id: branchId,
            full_name: fullName,
            nationality: uyruk,
            document_type: kimlikNo ? 'tc' : 'pasaport',
            document_no: kimlikNo || pasaportNo,
            birth_date: dogumTarihi || null,
            room_number: roomNumber,
            checkin_at: checkinAt.toISOString()
          })
          .select('id')
          .single();

        if (guestErr) {
          failed.push({ local_id: localId, error: guestErr.message || 'Misafir kaydı oluşturulamadı' });
          continue;
        }

        if (kbsEnabled) {
          try {
            const outboxId = await createOutbox(branchId, 'checkin', {
              type: 'checkin',
              guest_id: guest.id,
              ad,
              soyad,
              kimlikNo,
              pasaportNo,
              dogumTarihi,
              uyruk,
              girisTarihi: checkinAt.toISOString(),
              odaNumarasi: roomNumber || '0'
            });
            setImmediate(() => attemptSendOutbox(outboxId).catch((e) => console.error('[checkin/batch] attemptSendOutbox', e)));
          } catch (outboxErr) {
            console.error('[checkin/batch] outbox', outboxErr);
          }
        }

        await supabaseAdmin.from('audit_logs').insert({
          branch_id: branchId,
          user_id: userId,
          action: 'checkin_create',
          entity: 'guests',
          entity_id: guest.id,
          meta_json: { room_number: roomNumber, batch: true }
        }).then(() => {});

        success.push({ local_id: localId, guest_id: guest.id });
      } catch (err) {
        failed.push({ local_id: localId, error: err?.message || 'Sunucu hatası' });
      }
    }

    res.json({
      processed: notifications.length,
      success: success.length,
      failed: failed.length,
      details: { success, failed }
    });
  } catch (err) {
    console.error('[checkin/batch]', err);
    return res.status(500).json({ message: err?.message || 'Toplu işlem başarısız' });
  }
});

/**
 * POST /api/checkin
 * Body: { branch_id, guest: { ad, soyad, kimlikNo?, pasaportNo?, dogumTarihi, uyruk }, room_id?, room_number?, checkin_at? }
 * Mobil uyumluluk: odaId, ad, soyad, kimlikNo, pasaportNo, dogumTarihi, uyruk
 */
router.post('/checkin', async (req, res) => {
  try {
    const body = req.body || {};
    const branchId = req.branchId;
    const branch = req.branch || (req.tesis ? { kbs_configured: false, kbs_approved: false } : {});
    if (!branchId) {
      return errorResponse(req, res, 409, 'BRANCH_LOAD_FAILED', 'Tesis/şube bilgisi yüklenemedi. Lütfen tekrar giriş yapın.');
    }
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
