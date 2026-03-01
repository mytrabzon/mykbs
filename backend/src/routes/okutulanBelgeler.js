/**
 * Okutulan kimlik/pasaport kayıtları — otomatik kayıt + ayarlarda liste.
 * POST: kaydet (body: belgeTuru, ad, soyad, kimlikNo?, pasaportNo?, belgeNo?, dogumTarihi?, uyruk?, photoBase64?)
 * GET: tesis için liste (son eklenenler önce)
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { prisma } = require('../lib/prisma');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { errorResponse } = require('../lib/errorResponse');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '../../uploads/okutulan-belgeler');

router.use(authenticateTesisOrSupabase);

function getTesisId(req) {
  return req.authSource === 'supabase' ? req.branchId : req.tesis?.id;
}

function getKullaniciId(req) {
  return req.user?.id ?? req.user?.sub ?? null;
}

/** POST /api/okutulan-belgeler — kaydet (MRZ/check-in sonrası otomatik veya manuel) */
router.post('/', express.json({ limit: '6mb' }), async (req, res) => {
  try {
    const tesisId = getTesisId(req);
    if (!tesisId) return errorResponse(req, res, 401, 'UNAUTHORIZED', 'Tesis bilgisi bulunamadı.');

    const body = req.body || {};
    const belgeTuru = (body.belgeTuru || 'pasaport').toLowerCase() === 'kimlik' ? 'kimlik' : 'pasaport';
    const ad = String(body.ad || '').trim();
    const soyad = String(body.soyad || '').trim();
    if (!ad || !soyad) return errorResponse(req, res, 400, 'MISSING_FIELDS', 'Ad ve soyad zorunludur.');

    const logPrefix = '[okutulan-belgeler]';
    let photoUrl = null;
    if (body.photoBase64 && typeof body.photoBase64 === 'string') {
      const base64 = body.photoBase64.replace(/^data:image\/\w+;base64,/, '');
      let buf;
      try {
        buf = Buffer.from(base64, 'base64');
      } catch (decodeErr) {
        console.warn(logPrefix, "Storage'a yazılmadı: base64 decode hatası. Neden:", decodeErr.message, "- photoBase64 geçersiz format.");
      }
      if (buf && buf.length > 0 && buf.length <= 5 * 1024 * 1024) {
        if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        const filename = `${tesisId.slice(0, 12)}_${Date.now()}.jpg`;
        const filePath = path.join(UPLOAD_DIR, filename);
        try {
          fs.writeFileSync(filePath, buf);
          photoUrl = `/uploads/okutulan-belgeler/${filename}`;
          console.log(logPrefix, "Storage'a yazıldı:", filePath, { bufLen: buf.length });
        } catch (writeErr) {
          console.error(logPrefix, "Storage yazma hatası:", writeErr.message, "- path:", filePath);
        }
      } else if (buf) {
        if (buf.length === 0) {
          console.warn(logPrefix, "Storage'a yazılmadı: base64 decode sonrası buffer boş. Neden: photoBase64 decode 0 byte.");
        } else {
          console.warn(logPrefix, "Storage'a yazılmadı: dosya boyutu limit aşımı. Neden: max 5MB, gelen:", Math.round(buf.length / 1024), 'KB');
        }
      }
    }

    const rec = await prisma.okutulanBelge.create({
      data: {
        tesisId,
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
      },
    });

    return res.status(201).json({ ok: true, id: rec.id, createdAt: rec.createdAt });
  } catch (e) {
    console.error('[okutulan-belgeler] POST error:', e);
    return errorResponse(req, res, 500, 'SAVE_FAILED', e.message || 'Kayıt başarısız.');
  }
});

/** GET /api/okutulan-belgeler — liste (ayarlar ekranı) */
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

    return res.json({
      items: items.map((r) => ({
        id: r.id,
        belgeTuru: r.belgeTuru,
        ad: r.ad,
        soyad: r.soyad,
        kimlikNo: r.kimlikNo ? maskDocNo(r.kimlikNo) : null,
        pasaportNo: r.pasaportNo ? maskDocNo(r.pasaportNo) : null,
        belgeNo: r.belgeNo ? maskDocNo(r.belgeNo) : null,
        dogumTarihi: r.dogumTarihi,
        uyruk: r.uyruk,
        photoUrl: r.photoUrl,
        createdAt: r.createdAt,
      })),
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
