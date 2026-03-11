/**
 * Maliye Bakanlığı rapor verisi: Prisma (legacy) ve Supabase (KBS Prime) destekli.
 * Rapor tipleri: doluluk, aylik, musteri, kbs, vergi
 */
const { prisma } = require('../lib/prisma');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { ensureTesisForBranch } = require('../lib/ensureTesisForBranch');

const KDV_ORANI = 0.08; // Konaklama %8

function parseDate(d) {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t;
}

function formatDateTR(date) {
  if (!date) return '—';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatTimeTR(date) {
  if (!date) return '—';
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Maskele: TC 123*******, Pasaport DE****** */
function maskDocument(docType, no) {
  if (!no) return '—';
  const s = String(no).trim();
  if (docType === 'tc' && s.length >= 3) return s.slice(0, 3) + '*******';
  if (s.length >= 2) return s.slice(0, 2) + '******';
  return '******';
}

/**
 * Prisma ile doluluk + misafir verisi (legacy veya Supabase + ensureTesisForBranch sonrası)
 */
async function getPrismaRaporData(tesisId, fromDate, toDate) {
  const from = parseDate(fromDate);
  const to = parseDate(toDate);
  const tesis = await prisma.tesis.findUnique({
    where: { id: tesisId },
    select: { tesisAdi: true, vergiNo: true, adres: true, il: true, ilce: true },
  });
  if (!tesis) return null;

  const odalar = await prisma.oda.findMany({
    where: { tesisId },
    select: { id: true, odaNumarasi: true, durum: true },
  });
  const toplamOda = odalar.length;
  const doluOda = odalar.filter((o) => o.durum === 'dolu').length;

  const misafirWhere = { tesisId };
  if (from) misafirWhere.girisTarihi = { ...(misafirWhere.girisTarihi || {}), gte: from };
  if (to) misafirWhere.girisTarihi = { ...(misafirWhere.girisTarihi || {}), lte: to };

  const misafirler = await prisma.misafir.findMany({
    where: misafirWhere,
    include: { oda: { select: { odaNumarasi: true } } },
    orderBy: { girisTarihi: 'desc' },
  });

  const bildirimler = await prisma.bildirim.findMany({
    where: { tesisId, createdAt: from && to ? { gte: from, lte: to } : undefined },
    select: { id: true, misafirId: true, durum: true },
  });

  const tcCount = misafirler.filter((m) => m.misafirTipi === 'tc_vatandasi' || (m.kimlikNo && !m.pasaportNo)).length;
  const yabanciCount = misafirler.length - tcCount;

  const kalısGunleri = misafirler
    .filter((m) => m.cikisTarihi)
    .map((m) => (new Date(m.cikisTarihi) - new Date(m.girisTarihi)) / (1000 * 60 * 60 * 24));
  const ortalamaKalıs = kalısGunleri.length ? kalısGunleri.reduce((a, b) => a + b, 0) / kalısGunleri.length : null;

  const uyrukMap = {};
  misafirler.forEach((m) => {
    const u = (m.uyruk || 'Belirsiz').trim();
    uyrukMap[u] = (uyrukMap[u] || 0) + 1;
  });
  const uyrukDagilimi = Object.entries(uyrukMap).map(([uyruk, sayi]) => ({ uyruk, sayi })).sort((a, b) => b.sayi - a.sayi);

  const konaklamaSuresi = { '1-3': 0, '4-7': 0, '8-14': 0, '15+': 0 };
  misafirler.forEach((m) => {
    if (!m.cikisTarihi) return;
    const gun = (new Date(m.cikisTarihi) - new Date(m.girisTarihi)) / (1000 * 60 * 60 * 24);
    if (gun <= 3) konaklamaSuresi['1-3']++;
    else if (gun <= 7) konaklamaSuresi['4-7']++;
    else if (gun <= 14) konaklamaSuresi['8-14']++;
    else konaklamaSuresi['15+']++;
  });

  return {
    tesis: {
      ad: tesis.tesisAdi,
      vergiNo: tesis.vergiNo || '—',
      adres: [tesis.il, tesis.ilce, tesis.adres].filter(Boolean).join(', ') || '—',
    },
    toplamOda,
    doluOda,
    dolulukOrani: toplamOda ? Math.round((doluOda / toplamOda) * 100) : 0,
    misafirler: misafirler.map((m) => ({
      id: m.id,
      adSoyad: `${m.ad} ${m.soyad}`.trim(),
      uyruk: m.uyruk || '—',
      documentType: m.kimlikNo ? 'tc' : 'pasaport',
      documentNo: maskDocument(m.kimlikNo ? 'tc' : 'pasaport', m.kimlikNo || m.pasaportNo),
      girisTarihi: m.girisTarihi,
      cikisTarihi: m.cikisTarihi,
      odaNo: m.oda?.odaNumarasi || '—',
      kbsNo: m.id.slice(-6),
    })),
    toplamBildirim: bildirimler.length,
    tcVatandas: tcCount,
    yabanci: yabanciCount,
    uyrukDagilimi,
    ortalamaKalısGun: ortalamaKalıs != null ? Math.round(ortalamaKalıs * 10) / 10 : null,
    konaklamaSuresi,
    gunlukSatirlar: [], // doluluk raporu için günlük satırlar (aylık özet için doldurulabilir)
  };
}

/**
 * Supabase guests + kbs_outbox ile Maliye rapor verisi
 */
async function getSupabaseRaporData(branchId, branch, fromDate, toDate) {
  if (!supabaseAdmin) return null;

  const from = parseDate(fromDate);
  const to = parseDate(toDate);

  let guestQuery = supabaseAdmin
    .from('guests')
    .select('id, full_name, nationality, document_type, document_no, room_number, checkin_at, checkout_at, created_at')
    .eq('branch_id', branchId);
  if (from) guestQuery = guestQuery.gte('checkin_at', from.toISOString());
  if (to) guestQuery = guestQuery.lte('checkin_at', to.toISOString());
  guestQuery = guestQuery.order('checkin_at', { ascending: false });
  const { data: guestsRows, error: guestsErr } = await guestQuery;

  if (guestsErr) {
    console.error('[maliyeRapor] Supabase guests', guestsErr);
    return null;
  }
  const guests = guestsRows || [];

  let outboxQuery = supabaseAdmin
    .from('kbs_outbox')
    .select('id, payload, status, created_at')
    .eq('branch_id', branchId)
    .eq('type', 'checkin');
  if (from) outboxQuery = outboxQuery.gte('created_at', from.toISOString());
  if (to) outboxQuery = outboxQuery.lte('created_at', to.toISOString());
  const { data: outboxRows } = await outboxQuery;
  const outboxList = outboxRows || [];

  const toplamBildirim = outboxList.filter((o) => o.status === 'sent').length;
  const tcCount = guests.filter((g) => g.document_type === 'tc').length;
  const yabanciCount = guests.length - tcCount;

  const uyrukMap = {};
  guests.forEach((g) => {
    const u = (g.nationality || 'Belirsiz').trim();
    uyrukMap[u] = (uyrukMap[u] || 0) + 1;
  });
  const uyrukDagilimi = Object.entries(uyrukMap).map(([uyruk, sayi]) => ({ uyruk, sayi })).sort((a, b) => b.sayi - a.sayi);

  const checkinAt = (g) => g.checkin_at ? new Date(g.checkin_at) : new Date(g.created_at);
  const kalısGunleri = guests
    .filter((g) => g.checkout_at)
    .map((g) => (new Date(g.checkout_at) - checkinAt(g)) / (1000 * 60 * 60 * 24));
  const ortalamaKalıs = kalısGunleri.length ? kalısGunleri.reduce((a, b) => a + b, 0) / kalısGunleri.length : null;

  const konaklamaSuresi = { '1-3': 0, '4-7': 0, '8-14': 0, '15+': 0 };
  guests.forEach((g) => {
    if (!g.checkout_at) return;
    const gun = (new Date(g.checkout_at) - checkinAt(g)) / (1000 * 60 * 60 * 24);
    if (gun <= 3) konaklamaSuresi['1-3']++;
    else if (gun <= 7) konaklamaSuresi['4-7']++;
    else if (gun <= 14) konaklamaSuresi['8-14']++;
    else konaklamaSuresi['15+']++;
  });

  let toplamOda = (branch && branch.oda_sayisi) ? Number(branch.oda_sayisi) : 0;
  if (toplamOda <= 0) {
    const { data: distinct } = await supabaseAdmin.from('guests').select('room_number').eq('branch_id', branchId).not('room_number', 'is', null);
    const rooms = new Set((distinct || []).map((r) => r.room_number).filter(Boolean));
    toplamOda = rooms.size || 0;
  }
  const aktifCount = guests.filter((g) => !g.checkout_at).length;
  const doluOda = Math.min(aktifCount, toplamOda);
  if (toplamOda === 0 && aktifCount > 0) toplamOda = aktifCount;

  return {
    tesis: {
      ad: (branch && branch.name) || 'Tesis',
      vergiNo: (branch && branch.vergi_no) || '—',
      adres: (branch && branch.address) || '—',
    },
    toplamOda,
    doluOda,
    dolulukOrani: toplamOda ? Math.round((doluOda / toplamOda) * 100) : 0,
    misafirler: guests.map((g) => ({
      id: g.id,
      adSoyad: g.full_name || '—',
      uyruk: g.nationality || '—',
      documentType: g.document_type || 'pasaport',
      documentNo: maskDocument(g.document_type, g.document_no),
      girisTarihi: g.checkin_at || g.created_at,
      cikisTarihi: g.checkout_at || null,
      odaNo: g.room_number || '—',
      kbsNo: g.id.slice(-6),
    })),
    toplamBildirim,
    tcVatandas: tcCount,
    yabanci: yabanciCount,
    uyrukDagilimi,
    ortalamaKalısGun: ortalamaKalıs != null ? Math.round(ortalamaKalıs * 10) / 10 : null,
    konaklamaSuresi,
    gunlukSatirlar: [],
  };
}

/**
 * Tek bir Maliye raporu veri nesnesi döndürür.
 * req: express request (authSource, branchId, branch, tesis)
 */
async function getMaliyeRaporData(req, fromDate, toDate) {
  const from = parseDate(fromDate);
  const to = parseDate(toDate);
  const tarihFrom = from || new Date(new Date().setHours(0, 0, 0, 0));
  const tarihTo = to || new Date();

  if (req.authSource === 'supabase' && req.branchId) {
    await ensureTesisForBranch(prisma, req.branchId, req.branch && req.branch.name);
    const branchSelect = await supabaseAdmin
      .from('branches')
      .select('name, address, oda_sayisi, vergi_no')
      .eq('id', req.branchId)
      .single();
    const branchRow = branchSelect.data || {};
    const data = await getSupabaseRaporData(req.branchId, branchRow, tarihFrom, tarihTo);
    if (data) {
      data.raporNo = `MAL-${formatDateTR(new Date()).replace(/\./g, '')}-${String(Math.random()).slice(-4)}`;
      data.düzenlenmeTarihi = new Date().toISOString();
      data.formatDateTR = formatDateTR;
      data.formatTimeTR = formatTimeTR;
    }
    return data;
  }

  const tesisId = req.authSource === 'supabase' ? req.branchId : req.tesis.id;
  const data = await getPrismaRaporData(tesisId, tarihFrom, tarihTo);
  if (data) {
    data.raporNo = `MAL-${formatDateTR(new Date()).replace(/\./g, '')}-${String(Math.random()).slice(-4)}`;
    data.düzenlenmeTarihi = new Date().toISOString();
    data.formatDateTR = formatDateTR;
    data.formatTimeTR = formatTimeTR;
  }
  return data;
}

/**
 * Vergi (KDV) özeti. Gelir verisi yoksa 0 döner.
 */
function getVergiOzeti(data, toplamGelirTL = 0) {
  const matrah = toplamGelirTL / (1 + KDV_ORANI);
  const kdv = toplamGelirTL - matrah;
  return {
    toplamGelir: toplamGelirTL,
    kdvOrani: KDV_ORANI,
    kdvMatrah: Math.round(matrah * 100) / 100,
    kdvTutar: Math.round(kdv * 100) / 100,
    toplamTahsilat: toplamGelirTL,
  };
}

module.exports = {
  getMaliyeRaporData,
  getVergiOzeti,
  formatDateTR,
  formatTimeTR,
  KDV_ORANI,
};
