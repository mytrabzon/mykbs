/**
 * Admin panel için özel e-posta + şifre hesabı oluşturur.
 * Kullanım: cd backend && node scripts/create-admin-user.js
 *
 * Oluşan kullanıcı id'sini backend .env dosyasına ADMIN_KULLANICI_ID=... olarak ekleyin.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@kbsprime.local';
const ADMIN_PASSWORD = 'KbsAdmin2025!';
const ADMIN_NAME = 'KBS Admin';

async function main() {
  const emailNorm = ADMIN_EMAIL.trim().toLowerCase();

  let tesis = await prisma.tesis.findFirst({ where: { tesisKodu: 'MYKBS-ADMIN' } });
  if (!tesis) {
    tesis = await prisma.tesis.create({
      data: {
        tesisKodu: 'MYKBS-ADMIN',
        tesisAdi: 'KBS Prime Admin Tesis',
        yetkiliAdSoyad: ADMIN_NAME,
        telefon: '+900000000000',
        email: emailNorm,
        il: 'İstanbul',
        ilce: 'Merkez',
        adres: 'Admin Panel',
        odaSayisi: 1,
        tesisTuru: 'otel',
        durum: 'aktif',
        paket: 'pro',
        kota: 10000,
      },
    });
    console.log('Tesis oluşturuldu:', tesis.id);
  } else {
    console.log('Mevcut admin tesis kullanılıyor:', tesis.id);
  }

  let kullanici = await prisma.kullanici.findFirst({
    where: { email: emailNorm },
    include: { tesis: true },
  });

  const hashedSifre = await bcrypt.hash(ADMIN_PASSWORD, 10);

  if (kullanici) {
    await prisma.kullanici.update({
      where: { id: kullanici.id },
      data: { sifre: hashedSifre, girisOnaylandi: true },
    });
    console.log('Kullanıcı şifresi güncellendi:', kullanici.id);
  } else {
    kullanici = await prisma.kullanici.create({
      data: {
        tesisId: tesis.id,
        adSoyad: ADMIN_NAME,
        telefon: '+900000000000',
        email: emailNorm,
        sifre: hashedSifre,
        rol: 'sahip',
        checkInYetki: true,
        odaDegistirmeYetki: true,
        bilgiDuzenlemeYetki: true,
        girisOnaylandi: true,
      },
    });
    console.log('Kullanıcı oluşturuldu:', kullanici.id);
  }

  console.log('\n========================================');
  console.log('ADMIN PANEL GİRİŞ BİLGİLERİ');
  console.log('========================================');
  console.log('E-posta:', ADMIN_EMAIL);
  console.log('Şifre:  ', ADMIN_PASSWORD);
  console.log('========================================');
  console.log('\nBackend .env dosyasına ekleyin (admin yetkisi için):');
  console.log('ADMIN_KULLANICI_ID=' + kullanici.id);
  console.log('\nAdmin panelde "E-posta + Şifre" sekmesini seçip yukarıdaki bilgilerle giriş yapın.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
