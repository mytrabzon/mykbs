/**
 * Supabase branch_id için Prisma'da Tesis kaydı yoksa oluşturur.
 * Oda/Misafir/Bildirim route'ları branch_id ile Prisma kullandığı için bu kayıt gerekli.
 * @param {object} prisma - PrismaClient instance
 * @param {string} branchId - Supabase branches.id (UUID)
 * @param {string} branchName - branches.name (tesis adı)
 * @returns {Promise<object>} Prisma Tesis kaydı
 */
async function ensureTesisForBranch(prisma, branchId, branchName = 'Tesis') {
  let tesis = await prisma.tesis.findUnique({
    where: { id: branchId }
  });
  if (tesis) return tesis;

  const tesisKodu = 'SB-' + String(branchId).replace(/-/g, '').slice(0, 8).toUpperCase();
  tesis = await prisma.tesis.create({
    data: {
      id: branchId,
      tesisAdi: branchName || 'Tesis',
      yetkiliAdSoyad: '—',
      telefon: '—',
      email: '—',
      il: '—',
      ilce: '—',
      adres: '—',
      odaSayisi: 0,
      tesisTuru: 'otel',
      tesisKodu,
      durum: 'aktif',
      paket: 'deneme',
      kota: 100,
      kullanilanKota: 0
    }
  });
  console.warn('[ensureTesisForBranch] Prisma Tesis oluşturuldu:', { id: tesis.id, tesisAdi: tesis.tesisAdi });
  return tesis;
}

module.exports = { ensureTesisForBranch };
