/**
 * Supabase branch_id için Prisma'da Tesis kaydı yoksa oluşturur.
 * Oda/Misafir/Bildirim route'ları branch_id ile Prisma kullandığı için bu kayıt gerekli.
 * Not: 08P01 "insufficient data left in message" pooler (port 6543) ile Prisma'da görülebilir;
 *      DATABASE_URL için direct (port 5432) kullanın veya tekrar deneyin.
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
  const createData = {
    id: branchId,
    tesisAdi: (branchName || 'Tesis').slice(0, 255),
    yetkiliAdSoyad: '—',
    telefon: '—',
    email: '—',
    il: '—',
    ilce: '—',
    adres: '—',
    odaSayisi: 0,
    tesisTuru: 'otel',
    ipKisitAktif: false,
    ipAdresleri: '', // Açık ver; pooler 08P01 parameter $12 hatasını azaltır
    tesisKodu,
    durum: 'aktif',
    paket: 'deneme',
    kota: 100,
    kullanilanKota: 0
  };

  const runCreate = () => prisma.tesis.create({ data: createData });

  const is08P01 = (e) => {
    const msg = String(e?.message || e?.code || '');
    return msg.includes('08P01') || msg.includes('insufficient data left in message') || e?.meta?.code === '08P01';
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      tesis = await runCreate();
      break;
    } catch (err) {
      if (!is08P01(err)) throw err;
      if (attempt < 3) {
        console.warn('[ensureTesisForBranch] 08P01 (pooler?), retry', attempt, '/ 3...');
        await new Promise((r) => setTimeout(r, 300 * attempt));
      } else {
        const wrap = new Error('Tesis kaydı oluşturulamadı (08P01). DATABASE_URL için direct bağlantı veya pgbouncer=true kullanın.');
        wrap.code = '08P01';
        throw wrap;
      }
    }
  }
  console.warn('[ensureTesisForBranch] Prisma Tesis oluşturuldu:', { id: tesis.id, tesisAdi: tesis.tesisAdi });
  return tesis;
}

module.exports = { ensureTesisForBranch };
