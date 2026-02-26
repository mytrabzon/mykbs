/**
 * Supabase admin hesabı (57a7ce11) ile eşleşecek backend kullanıcı oluşturur.
 * Böylece Supabase'te bu telefona sahip admin, SMS ile giriş yapınca backend de kabul eder.
 *
 * backend/.env:
 *   ADMIN_SEED_PHONE=+905324494374
 *   ADMIN_SEED_EMAIL=sonertoprak97@gmail.com
 *   ADMIN_SEED_NAME=Soner Toprak
 *   ADMIN_SEED_PASSWORD=... (opsiyonel; şifre ile giriş için)
 *
 * Kullanım: cd backend && node scripts/seed-admin-link.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function formatPhone(phone) {
  let s = String(phone).trim().replace(/\D/g, '');
  if (s.startsWith('90')) s = s.slice(2);
  if (s.startsWith('0')) s = s.slice(1);
  return s ? '+90' + s : '';
}

async function main() {
  const rawPhone = process.env.ADMIN_SEED_PHONE;
  const email = process.env.ADMIN_SEED_EMAIL || 'sonertoprak97@gmail.com';
  const name = process.env.ADMIN_SEED_NAME || 'Admin';
  const plainPassword = process.env.ADMIN_SEED_PASSWORD;

  if (!rawPhone) {
    console.error('ADMIN_SEED_PHONE gerekli. Örnek: +905551234567');
    process.exit(1);
  }

  const telefon = formatPhone(rawPhone);
  if (telefon.length < 10) {
    console.error('Geçerli bir telefon girin (örn. +905551234567)');
    process.exit(1);
  }

  console.log('Telefon:', telefon, '| Email:', email, '| Ad:', name);

  let tesis = await prisma.tesis.findFirst({ where: { tesisKodu: 'admin-link' } });
  if (!tesis) {
    tesis = await prisma.tesis.create({
      data: {
        tesisKodu: 'admin-link',
        tesisAdi: 'Admin Tesis',
        yetkiliAdSoyad: name,
        telefon,
        email,
        il: 'İstanbul',
        ilce: 'Merkez',
        adres: 'Admin',
        odaSayisi: 10,
        tesisTuru: 'otel',
        durum: 'aktif',
        paket: 'pro',
        kota: 10000,
      },
    });
    console.log('Tesis oluşturuldu:', tesis.id);
  } else {
    console.log('Mevcut tesis kullanılıyor:', tesis.id);
  }

  let kullanici = await prisma.kullanici.findFirst({
    where: { telefon },
    include: { tesis: true },
  });

  const updateData = { email: email || undefined, adSoyad: name };
  if (plainPassword && plainPassword.length >= 6) {
    updateData.sifre = await bcrypt.hash(plainPassword, 10);
  }

  if (kullanici) {
    await prisma.kullanici.update({
      where: { id: kullanici.id },
      data: updateData,
    });
    console.log('Kullanıcı güncellendi:', kullanici.id);
  } else {
    const createData = {
      tesisId: tesis.id,
      adSoyad: name,
      telefon,
      email,
      rol: 'sahip',
      checkInYetki: true,
      odaDegistirmeYetki: true,
      bilgiDuzenlemeYetki: true,
    };
    if (plainPassword && plainPassword.length >= 6) {
      createData.sifre = await bcrypt.hash(plainPassword, 10);
    }
    kullanici = await prisma.kullanici.create({ data: createData });
    console.log('Kullanıcı oluşturuldu:', kullanici.id);
  }

  console.log('\nTamam. Supabase\'te 57a7ce11 kullanıcısına Phone =', telefon, 'ekleyin.');
  console.log('Mobilde: SMS ile giriş →', telefon, '| Şifre ile giriş → telefon veya', email);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
