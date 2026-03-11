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

function maskDocNo(no) {
  if (!no || typeof no !== 'string') return '';
  const s = no.replace(/\D/g, '');
  if (s.length <= 4) return '****';
  return s.slice(0, 2) + '****' + s.slice(-2);
}

module.exports = router;
