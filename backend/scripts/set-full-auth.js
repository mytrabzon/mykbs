/**
 * Belirtilen telefon numarasına sahip kullanıcıya tüm yetkileri verir.
 * Backend (Prisma): rol = sahip, tüm yetkiler true.
 * Bir sonraki girişte sync ile Supabase user_profiles role = admin olur.
 *
 * Kullanım:
 *   cd backend && node scripts/set-full-auth.js
 *   (Varsayılan: 5330483061)
 * Farklı numara: backend/.env içine FULL_AUTH_PHONE=5XXXXXXXXX yazın.
 * PowerShell: $env:FULL_AUTH_PHONE="5XXXXXXXXX"; node scripts/set-full-auth.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function formatPhone(phone) {
  let s = String(phone).trim().replace(/\D/g, '');
  if (s.startsWith('90')) s = s.slice(2);
  if (s.startsWith('0')) s = s.slice(1);
  return s ? '+90' + s : '';
}

async function main() {
  const raw = process.env.FULL_AUTH_PHONE || '5330483061';
  const telefon = formatPhone(raw);
  if (telefon.length < 10) {
    console.error('Geçerli telefon girin. Örnek: FULL_AUTH_PHONE=5330483061');
    process.exit(1);
  }

  const kullanici = await prisma.kullanici.findFirst({
    where: { telefon },
    include: { tesis: true },
  });

  if (!kullanici) {
    console.error('Bu numaraya kayıtlı kullanıcı bulunamadı:', telefon);
    process.exit(1);
  }

  await prisma.kullanici.update({
    where: { id: kullanici.id },
    data: {
      rol: 'sahip',
      checkInYetki: true,
      odaDegistirmeYetki: true,
      bilgiDuzenlemeYetki: true,
    },
  });

  console.log('Tamam. Tüm yetkiler verildi:', telefon);
  console.log('  Kullanıcı:', kullanici.adSoyad, '| Tesis:', kullanici.tesis?.tesisAdi);
  console.log('  Bir sonraki girişte Supabase tarafında da admin rolü senkron olur.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
