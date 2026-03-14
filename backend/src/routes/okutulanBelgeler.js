/**
 * Okutulan kimlik/pasaport kayıtları — otomatik kayıt + ayarlarda liste.
 * POST: kaydet (body: belgeTuru, ad, soyad, kimlikNo?, pasaportNo?, belgeNo?, dogumTarihi?, uyruk?, photoBase64?)
 * Resimler: Supabase Storage "documents" bucket’a (private); yoksa yerel uploads/okutulan-belgeler.
 * GET: tesis için liste; Storage path’leri signed URL’e çevrilir.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../lib/prisma');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { tenantMiddleware, getTenantIdForRecord } = require('../middleware/tenant');
const { errorResponse } = require('../lib/errorResponse');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { BUCKET_DOCUMENTS } = require('../config/storage');
const { createKBSService } = require('../services/kbs');
const { canSendBildirim } = require('../config/packages');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '../../uploads/okutulan-belgeler');

/** DB’de Storage path mi (documents bucket)? */
const isStoragePath = (photoUrl) =>
  typeof photoUrl === 'string' && photoUrl.startsWith('okutulan-belgeler/') && !photoUrl.startsWith('/');

/** Signed URL süresi (saniye) */
const SIGNED_URL_EXPIRY = 3600;

router.use(authenticateTesisOrSupabase);
router.use(tenantMiddleware);

function getTesisId(req) {
  return req.authSource === 'supabase' ? req.branchId : req.tesis?.id;
}

function getKullaniciId(req) {
  return req.user?.id ?? req.user?.sub ?? null;
}

/** Sunucuda ilgili KBS URL tanımlı mı? (jandarma -> JANDARMA_KBS_URL, polis -> POLIS_KBS_URL) */
function isKbsUrlConfigured(kbsTuru) {
  const t = (kbsTuru || '').toString().trim().toLowerCase();
  if (t === 'jandarma') return !!(process.env.JANDARMA_KBS_URL || '').trim();
  if (t === 'polis') return !!(process.env.POLIS_KBS_URL || '').trim();
  return false;
}

/** KBS / paket kontrolleri için tesis veya branch. */
function getTesisOrBranch(req) {
  if (req.authSource === 'supabase' && req.branch) {
    return {
      id: req.branch.id,
      kbsTuru: req.branch.kbs_turu || null,
      kbsTesisKodu: req.branch.kbs_tesis_kodu || null,
      kbsWebServisSifre: req.branch.kbs_web_servis_sifre || null,
      paket: 'deneme',
      kota: 1000,
      kullanilanKota: 0,
      trialEndsAt: null
    };
  }
  return req.tesis;
}

const GUEST_PASSPORT_LIMIT = 5;

/** POST /api/okutulan-belgeler — kaydet (MRZ/check-in sonrası otomatik veya manuel) */
router.post('/', express.json({ limit: '6mb' }), async (req, res) => {
  try {
    const tesisId = getTesisId(req);
    if (!tesisId) return errorResponse(req, res, 401, 'UNAUTHORIZED', 'Tesis bilgisi bulunamadı.');

    if (req.authSource === 'supabase' && req.user?.is_anonymous) {
      const count = await prisma.okutulanBelge.count({ where: { tesisId } });
      if (count >= GUEST_PASSPORT_LIMIT) {
        return errorResponse(req, res, 403, 'GUEST_LIMIT', 'Misafir hesaplar en fazla 5 pasaport/kimlik kaydedebilir. E-posta doğrulayarak limiti kaldırın.');
      }
    }

    const body = req.body || {};
    const belgeTuru = (body.belgeTuru || 'pasaport').toLowerCase() === 'kimlik' ? 'kimlik' : 'pasaport';
    const ad = String(body.ad || '').trim();
    const soyad = String(body.soyad || '').trim();
    if (!ad || !soyad) return errorResponse(req, res, 400, 'MISSING_FIELDS', 'Ad ve soyad zorunludur.');

    const logPrefix = '[okutulan-belgeler]';
    let photoUrl = null;
    let portraitPhotoUrl = null;

    const saveBase64ToStorage = async (base64, prefix) => {
      const base64Clean = base64.replace(/^data:image\/\w+;base64,/, '');
      let buf;
      try {
        buf = Buffer.from(base64Clean, 'base64');
      } catch (decodeErr) {
        console.warn(logPrefix, prefix, "decode hatası:", decodeErr?.message);
        return null;
      }
      if (!buf || buf.length === 0 || buf.length > 5 * 1024 * 1024) return null;
      const storagePath = `okutulan-belgeler/${tesisId}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${prefix}.jpg`;
      if (supabaseAdmin) {
        try {
          const { error: upErr } = await supabaseAdmin.storage
            .from(BUCKET_DOCUMENTS)
            .upload(storagePath, buf, { contentType: 'image/jpeg', upsert: false });
          if (!upErr) {
            console.log(logPrefix, "Supabase Storage'a yazıldı:", storagePath, { prefix });
            return storagePath;
          }
        } catch (e) {
          console.warn(logPrefix, "Supabase Storage hatası:", e?.message);
        }
      }
      if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const filename = `${tesisId.slice(0, 12)}_${Date.now()}_${prefix}.jpg`;
      const filePath = path.join(UPLOAD_DIR, filename);
      try {
        fs.writeFileSync(filePath, buf);
        return `/uploads/okutulan-belgeler/${filename}`;
      } catch (writeErr) {
        console.error(logPrefix, "Yerel Storage yazma hatası:", writeErr.message);
        return null;
      }
    };

    if (body.photoBase64 && typeof body.photoBase64 === 'string') {
      photoUrl = await saveBase64ToStorage(body.photoBase64, 'doc');
    }
    if (body.portraitPhotoBase64 && typeof body.portraitPhotoBase64 === 'string') {
      portraitPhotoUrl = await saveBase64ToStorage(body.portraitPhotoBase64, 'portrait');
    }

    const rawTenantId = getTenantIdForRecord(req);
    // OkutulanBelge.tenantId DB'de UUID; CUID (tesis.id) veya geçersiz değer verilirse Prisma hata atar.
    const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
    const tenantId = rawTenantId && isUuid(rawTenantId) ? rawTenantId.trim() : null;
    const rec = await prisma.okutulanBelge.create({
      data: {
        tesisId,
        ...(tenantId ? { tenantId } : {}),
        kullaniciId: getKullaniciId(req),
        belgeTuru,
        ad,
        soyad,
        kimlikNo: body.kimlikNo ? String(body.kimlikNo).trim() : null,
        pasaportNo: body.pasaportNo ? String(body.pasaportNo).trim() : null,
        belgeNo: body.belgeNo ? String(body.belgeNo).trim() : null,
        dogumTarihi: body.dogumTarihi ? String(body.dogumTarihi).trim() : null,
        uyruk: body.uyruk ? String(body.uyruk).trim() : null,
        photoUrl,
        portraitPhotoUrl: portraitPhotoUrl || undefined,
      },
    });

    return res.status(201).json({ ok: true, id: rec.id, createdAt: rec.createdAt });
  } catch (e) {
    console.error('[okutulan-belgeler] POST error:', e);
    return errorResponse(req, res, 500, 'SAVE_FAILED', e.message || 'Kayıt başarısız.');
  }
});

/** GET /api/okutulan-belgeler — liste (ayarlar ekranı). Storage path’leri signed URL’e çevrilir. */
router.get('/', async (req, res) => {
  try {
    const tesisId = getTesisId(req);
    if (!tesisId) return errorResponse(req, res, 401, 'UNAUTHORIZED', 'Tesis bilgisi bulunamadı.');

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const cursor = req.query.cursor || undefined;

    const list = await prisma.okutulanBelge.findMany({
      where: { tesisId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    const hasMore = list.length > limit;
    const items = hasMore ? list.slice(0, limit) : list;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const itemsWithPhotoUrl = await Promise.all(
      items.map(async (r) => {
        let photoUrl = r.photoUrl;
        let portraitPhotoUrl = r.portraitPhotoUrl;
        const signUrl = async (p) => {
          if (!p || !isStoragePath(p) || !supabaseAdmin) return p;
          try {
            const { data } = await supabaseAdmin.storage
              .from(BUCKET_DOCUMENTS)
              .createSignedUrl(p, SIGNED_URL_EXPIRY);
            return data?.signedUrl || p;
          } catch (_) {
            return p;
          }
        };
        photoUrl = await signUrl(photoUrl);
        portraitPhotoUrl = await signUrl(portraitPhotoUrl);
        return {
          id: r.id,
          belgeTuru: r.belgeTuru,
          ad: r.ad,
          soyad: r.soyad,
          kimlikNo: r.kimlikNo ? maskDocNo(r.kimlikNo) : null,
          pasaportNo: r.pasaportNo ? maskDocNo(r.pasaportNo) : null,
          belgeNo: r.belgeNo ? maskDocNo(r.belgeNo) : null,
          dogumTarihi: r.dogumTarihi,
          uyruk: r.uyruk,
          photoUrl,
          portraitPhotoUrl: portraitPhotoUrl || undefined,
          odaNo: r.odaNo ?? null,
          bildirildi: r.bildirildi ?? false,
          createdAt: r.createdAt,
        };
      })
    );

    return res.json({
      items: itemsWithPhotoUrl,
      nextCursor,
    });
  } catch (e) {
    console.error('[okutulan-belgeler] GET error:', e);
    return errorResponse(req, res, 500, 'LIST_FAILED', e.message || 'Liste alınamadı.');
  }
});

/** PUT /api/okutulan-belgeler/:id/oda — oda ata (body: { odaId }) */
router.put('/:id/oda', express.json(), async (req, res) => {
  try {
    const tesisId = getTesisId(req);
    if (!tesisId) return errorResponse(req, res, 401, 'UNAUTHORIZED', 'Tesis bilgisi bulunamadı.');
    const { id } = req.params;
    const { odaId } = req.body || {};
    if (!odaId) return errorResponse(req, res, 400, 'MISSING_ODA', 'odaId gerekli.');
    const belge = await prisma.okutulanBelge.findFirst({ where: { id, tesisId } });
    if (!belge) return errorResponse(req, res, 404, 'NOT_FOUND', 'Kayıt bulunamadı.');
    const oda = await prisma.oda.findFirst({ where: { id: odaId, tesisId } });
    if (!oda) return errorResponse(req, res, 404, 'ODA_NOT_FOUND', 'Oda bulunamadı.');
    await prisma.okutulanBelge.update({
      where: { id },
      data: { odaNo: oda.odaNumarasi },
    });
    return res.json({ ok: true, odaNo: oda.odaNumarasi });
  } catch (e) {
    console.error('[okutulan-belgeler] PUT oda error:', e);
    return errorResponse(req, res, 500, 'UPDATE_FAILED', e.message || 'Oda atanamadı.');
  }
});

/**
 * POST /api/okutulan-belgeler/:id/bildir
 * Body: { odaId: string, misafirTipi?: 'tc_vatandasi'|'ykn'|'yabanci' }
 * Okutulan belgeyi seçilen odaya check-in edip KBS'ye bildirir.
 */
router.post('/:id/bildir', express.json(), async (req, res) => {
  try {
    if (req.authSource !== 'supabase' && req.user && !req.user.checkInYetki) {
      return errorResponse(req, res, 403, 'FORBIDDEN', 'Bildirim için check-in yetkiniz yok.');
    }

    const tesisId = getTesisId(req);
    if (!tesisId) return errorResponse(req, res, 401, 'UNAUTHORIZED', 'Tesis bilgisi bulunamadı.');

    const { id } = req.params;
    const { odaId, misafirTipi } = req.body || {};
    if (!odaId) return errorResponse(req, res, 400, 'MISSING_ODA', 'Oda seçimi gerekli.');

    const belge = await prisma.okutulanBelge.findFirst({
      where: { id, tesisId }
    });
    if (!belge) return errorResponse(req, res, 404, 'NOT_FOUND', 'Kayıt bulunamadı.');

    if (!belge.kimlikNo && !belge.pasaportNo && !belge.belgeNo) {
      return errorResponse(req, res, 400, 'MISSING_DOC', 'Belge veya kimlik numarası eksik.');
    }

    const kimlikNo = belge.kimlikNo ? String(belge.kimlikNo).trim() : null;
    const pasaportNo = belge.pasaportNo ? String(belge.pasaportNo).trim() : null;
    const belgeNo = belge.belgeNo ? String(belge.belgeNo).trim() : null;
    const docNo = kimlikNo || pasaportNo || belgeNo;
    if (!docNo) return errorResponse(req, res, 400, 'MISSING_DOC', 'Kimlik veya pasaport numarası gerekli.');

    const oda = await prisma.oda.findFirst({
      where: { id: odaId, tesisId }
    });
    if (!oda) return errorResponse(req, res, 404, 'ODA_NOT_FOUND', 'Oda bulunamadı.');
    if (oda.durum === 'dolu') return errorResponse(req, res, 400, 'ODA_DOLU', 'Bu oda dolu.');

    const sendCheck = canSendBildirim(getTesisOrBranch(req));
    if (!sendCheck.allowed) {
      const message = sendCheck.reason === 'trial_ended'
        ? 'Deneme süren tamamlandı. Bildirimlerine kesintisiz devam etmek için paket seç.'
        : 'Bildirim hakkın doldu. Devam etmek için paket seç.';
      return errorResponse(req, res, 402, sendCheck.reason, message);
    }

    let dogumTarihi = new Date('1900-01-01');
    if (belge.dogumTarihi) {
      const s = String(belge.dogumTarihi).trim();
      if (s.includes('.')) {
        const [d, m, y] = s.split('.');
        if (y && m && d) dogumTarihi = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
        else dogumTarihi = new Date(s);
      } else {
        dogumTarihi = new Date(s);
      }
      if (isNaN(dogumTarihi.getTime())) dogumTarihi = new Date('1900-01-01');
    }
    const misafir = await prisma.misafir.create({
      data: {
        tesisId,
        odaId: oda.id,
        ad: belge.ad,
        ad2: null,
        soyad: belge.soyad,
        kimlikNo: /^\d{11}$/.test(String(docNo).replace(/\D/g, '')) ? docNo.replace(/\D/g, '') : (belge.belgeTuru === 'kimlik' ? docNo : null),
        pasaportNo: belge.belgeTuru === 'pasaport' || !/^\d{11}$/.test(String(docNo).replace(/\D/g, '')) ? docNo : null,
        dogumTarihi,
        uyruk: belge.uyruk || 'TÜRK',
        misafirTipi: misafirTipi || null,
        girisTarihi: new Date()
      }
    });

    await prisma.oda.update({
      where: { id: oda.id },
      data: { durum: 'dolu' }
    });

    const bildirim = await prisma.bildirim.create({
      data: {
        tesisId,
        misafirId: misafir.id,
        durum: 'beklemede',
        hataMesaji: null,
        kbsTuru: getTesisOrBranch(req).kbsTuru || null,
        kbsYanit: null
      }
    });

    const tesisSnapshot = getTesisOrBranch(req);
    const kbsUrlConfigured = isKbsUrlConfigured(tesisSnapshot.kbsTuru);
    if (tesisSnapshot.kbsTuru && tesisSnapshot.kbsTesisKodu && tesisSnapshot.kbsWebServisSifre && kbsUrlConfigured) {
      setImmediate(async () => {
        try {
          const kbsService = createKBSService(tesisSnapshot);
          const kbsResult = await kbsService.bildirimGonder({
            ad: misafir.ad,
            ad2: misafir.ad2 || null,
            soyad: misafir.soyad,
            kimlikNo: misafir.kimlikNo,
            pasaportNo: misafir.pasaportNo,
            dogumTarihi: misafir.dogumTarihi,
            uyruk: misafir.uyruk,
            misafirTipi: misafir.misafirTipi || null,
            girisTarihi: misafir.girisTarihi,
            odaNumarasi: oda.odaNumarasi
          });
          await prisma.bildirim.update({
            where: { id: bildirim.id },
            data: {
              durum: kbsResult.durum,
              hataMesaji: kbsResult.hataMesaji || null,
              denemeSayisi: { increment: 1 },
              sonDenemeTarihi: new Date(),
              kbsYanit: kbsResult.yanit ? JSON.stringify(kbsResult.yanit) : null
            }
          });
          if (kbsResult.success && tesisSnapshot.kullanilanKota < tesisSnapshot.kota) {
            await prisma.tesis.update({
              where: { id: tesisSnapshot.id },
              data: { kullanilanKota: { increment: 1 } }
            });
          }
        } catch (err) {
          await prisma.bildirim.update({
            where: { id: bildirim.id },
            data: {
              durum: 'hatali',
              hataMesaji: err.message,
              denemeSayisi: { increment: 1 },
              sonDenemeTarihi: new Date(),
              kbsYanit: JSON.stringify({ error: err.message })
            }
          });
        }
      });
    } else if (tesisSnapshot.kbsTuru && tesisSnapshot.kbsTesisKodu && tesisSnapshot.kbsWebServisSifre && !kbsUrlConfigured) {
      const urlVar = (tesisSnapshot.kbsTuru || '').toString().trim().toLowerCase() === 'polis' ? 'POLIS_KBS_URL' : 'JANDARMA_KBS_URL';
      await prisma.bildirim.update({
        where: { id: bildirim.id },
        data: {
          durum: 'hatali',
          hataMesaji: `Sunucuda ${urlVar} tanımlı değil. Railway Variables'a ekleyip servisi yeniden başlatın.`,
          denemeSayisi: 1,
          sonDenemeTarihi: new Date(),
        },
      });
    }

    await prisma.okutulanBelge.update({
      where: { id: belge.id },
      data: { bildirildi: true, odaNo: oda.odaNumarasi },
    });

    const kbsMessage = !tesisSnapshot.kbsTuru
      ? 'KBS yapılandırılmamış'
      : !kbsUrlConfigured
        ? `Bildirim kaydedildi ancak sunucuda KBS adresi (${(tesisSnapshot.kbsTuru || '').toString().toLowerCase() === 'polis' ? 'POLIS_KBS_URL' : 'JANDARMA_KBS_URL'}) tanımlı değil; KBS'ye iletilemedi. Railway Variables'a ekleyip yeniden başlatın.`
        : 'Bildirim arka planda gönderiliyor';

    return res.status(201).json({
      ok: true,
      message: kbsUrlConfigured ? 'KBS\'ye bildirim gönderildi' : 'Bildirim kaydedildi; KBS\'ye iletilemedi (sunucu ayarı eksik).',
      misafirId: misafir.id,
      bildirimId: bildirim.id,
      odaNumarasi: oda.odaNumarasi,
      kbsBildirimi: kbsMessage,
      kbsGonderilemedi: !kbsUrlConfigured && !!tesisSnapshot.kbsTuru,
    });
  } catch (e) {
    console.error('[okutulan-belgeler] bildir error:', e);
    return errorResponse(req, res, 500, 'BILDIR_FAILED', e.message || 'Bildirim gönderilemedi.');
  }
});

function maskDocNo(no) {
  if (!no || typeof no !== 'string') return '';
  const s = no.replace(/\D/g, '');
  if (s.length <= 4) return '****';
  return s.slice(0, 2) + '****' + s.slice(-2);
}

module.exports = router;
