const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const smsService = require('../services/sms');
const emailService = require('../services/email');
const { ensureSupabaseBranchAndProfile } = require('../services/supabaseSync');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { setTrialDefaults } = require('../config/packages');
const prisma = new PrismaClient();

const router = express.Router();

/** Telefonu E.164 (sadece rakam +90) formatına getirir; OTP eşleşmesi için tutarlı kullanılmalı */
function normalizePhone(telefon) {
  if (!telefon || typeof telefon !== 'string') return '';
  const digits = telefon.replace(/\D/g, '');
  if (!digits.length) return '';
  const normalized = digits.startsWith('90') ? digits : (digits.startsWith('0') ? '90' + digits.slice(1) : '90' + digits);
  return '+' + normalized.slice(0, 12);
}

/** E.164 formatından olası DB varyantlarını döndürür (kullanıcı farklı formatta kayıtlı olabilir) */
function phoneVariants(normalized) {
  if (!normalized || typeof normalized !== 'string') return [];
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 10) return [];
  const rest = digits.startsWith('90') ? digits.slice(2) : digits;
  const variants = [
    normalized,
    '0' + rest,
    rest,
    '90' + rest,
  ];
  return [...new Set(variants)];
}

/**
 * Tesis başvurusu
 */
router.post('/basvuru', async (req, res) => {
  try {
    const {
      tesisAdi,
      yetkiliAdSoyad,
      telefon,
      email,
      il,
      ilce,
      adres,
      odaSayisi,
      tesisTuru,
      kbsTuru,
      kbsTesisKoduVarMi,
      kbsKullanimDurumu,
      vergiNo,
      unvan,
      web,
      instagram,
      not
    } = req.body;

    // Zorunlu alan kontrolü
    if (!tesisAdi || !yetkiliAdSoyad || !telefon || !email || !il || !ilce || !adres || !odaSayisi || !tesisTuru) {
      return res.status(400).json({ message: 'Zorunlu alanlar eksik' });
    }

    // Tesis kodu oluştur (öncelikle kontrol et)
    let tesisKodu;
    let unique = false;
    while (!unique) {
      tesisKodu = `MYKBS-${Math.floor(100000 + Math.random() * 900000)}`;
      const existing = await prisma.tesis.findUnique({ where: { tesisKodu } });
      if (!existing) unique = true;
    }

    const tesis = await prisma.tesis.create({
      data: {
        ...setTrialDefaults(),
        tesisAdi,
        yetkiliAdSoyad,
        telefon,
        email,
        il,
        ilce,
        adres,
        odaSayisi: parseInt(odaSayisi),
        tesisTuru,
        kbsTuru: kbsTuru || null,
        vergiNo,
        unvan,
        web,
        instagram,
        not,
        tesisKodu,
        durum: 'incelemede'
      }
    });

    res.status(201).json({
      message: 'Başvurunuz alınmıştır. Onaylandığında giriş bilgileriniz WhatsApp ve e-posta ile iletilecektir.',
      tesisKodu: tesis.tesisKodu,
      durum: tesis.durum
    });
  } catch (error) {
    console.error('Başvuru hatası:', error);
    res.status(500).json({ message: 'Başvuru kaydedilemedi', error: error.message });
  }
});

/**
 * Aktivasyon ile giriş (ilk giriş)
 */
router.post('/aktivasyon', async (req, res) => {
  try {
    const { tesisKodu, aktivasyonSifre } = req.body;

    if (!tesisKodu || !aktivasyonSifre) {
      return res.status(400).json({ message: 'Tesis kodu ve aktivasyon şifresi gerekli' });
    }

    const tesis = await prisma.tesis.findUnique({
      where: { tesisKodu }
    });

    if (!tesis) {
      return res.status(404).json({ message: 'Tesis bulunamadı' });
    }

    if (tesis.durum !== 'onaylandi') {
      return res.status(403).json({ message: 'Tesis henüz onaylanmamış' });
    }

    if (!tesis.aktivasyonSifre || tesis.aktivasyonSifre !== aktivasyonSifre) {
      return res.status(401).json({ message: 'Geçersiz aktivasyon şifresi' });
    }

    if (tesis.aktivasyonSifreExpiresAt && new Date() > tesis.aktivasyonSifreExpiresAt) {
      return res.status(401).json({ message: 'Aktivasyon şifresi geçersiz' });
    }

    // İlk kullanıcıyı oluştur (sahip rolü ile)
    let kullanici = await prisma.kullanici.findFirst({
      where: { tesisId: tesis.id, rol: 'sahip' }
    });

    if (!kullanici) {
      kullanici = await prisma.kullanici.create({
        data: {
          tesisId: tesis.id,
          adSoyad: tesis.yetkiliAdSoyad,
          telefon: tesis.telefon,
          email: tesis.email,
          rol: 'sahip',
          checkInYetki: true,
          odaDegistirmeYetki: true,
          bilgiDuzenlemeYetki: true
        }
      });
    }

    // Aktivasyon şifresini iptal et
    await prisma.tesis.update({
      where: { id: tesis.id },
      data: {
        aktivasyonSifre: null,
        aktivasyonSifreExpiresAt: null,
        durum: 'aktif'
      }
    });

    res.json({
      message: 'Aktivasyon başarılı. Lütfen PIN belirleyin.',
      kullaniciId: kullanici.id,
      tesisId: tesis.id,
      requiresPin: !kullanici.pin
    });
  } catch (error) {
    console.error('Aktivasyon hatası:', error);
    res.status(500).json({ message: 'Aktivasyon başarısız', error: error.message });
  }
});

/**
 * PIN belirleme/güncelleme
 */
router.post('/pin', authenticate, async (req, res) => {
  try {
    const { pin, biyometriAktif } = req.body;

    if (!pin || pin.length < 4) {
      return res.status(400).json({ message: 'PIN en az 4 karakter olmalıdır' });
    }

    const hashedPin = await bcrypt.hash(pin, 10);

    await prisma.kullanici.update({
      where: { id: req.user.id },
      data: {
        pin: hashedPin,
        biyometriAktif: biyometriAktif || false
      }
    });

    res.json({ message: 'PIN başarıyla kaydedildi' });
  } catch (error) {
    console.error('PIN kayıt hatası:', error);
    res.status(500).json({ message: 'PIN kaydedilemedi', error: error.message });
  }
});

/**
 * Yeni kayıt (email/telefon + şifre ile)
 */
router.post('/kayit', async (req, res) => {
  try {
    const { 
      telefon, 
      email, 
      sifre, 
      sifreTekrar, 
      adSoyad, 
      tesisAdi, 
      il, 
      ilce, 
      adres, 
      odaSayisi, 
      tesisTuru 
    } = req.body;

    // Validasyon
    if (!telefon && !email) {
      return res.status(400).json({ message: 'Telefon veya email gereklidir' });
    }

    if (!sifre || !sifreTekrar) {
      return res.status(400).json({ message: 'Şifre ve şifre tekrarı gereklidir' });
    }

    if (sifre !== sifreTekrar) {
      return res.status(400).json({ message: 'Şifreler eşleşmiyor' });
    }

    if (sifre.length < 6) {
      return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır' });
    }

    // Telefon E.164 formatında (giriş ile aynı olmalı)
    let formattedPhone = null;
    if (telefon) {
      formattedPhone = normalizePhone(telefon);
      if (!formattedPhone) {
        return res.status(400).json({ message: 'Geçersiz telefon numarası' });
      }
    }

    // Email/telefon kontrolü
    if (email) {
      const existingEmail = await prisma.kullanici.findFirst({
        where: { email: email }
      });
      if (existingEmail) {
        return res.status(400).json({ message: 'Bu email adresi zaten kayıtlı' });
      }
    }

    if (formattedPhone) {
      const existingPhone = await prisma.kullanici.findFirst({
        where: { telefon: formattedPhone }
      });
      if (existingPhone) {
        return res.status(400).json({ message: 'Bu telefon numarası zaten kayıtlı' });
      }
    }

    // Tesis kodu oluştur
    let tesisKodu;
    let unique = false;
    while (!unique) {
      tesisKodu = `MYKBS-${Math.floor(100000 + Math.random() * 900000)}`;
      const existing = await prisma.tesis.findUnique({ where: { tesisKodu } });
      if (!existing) unique = true;
    }

    // Şifreyi hash'le
    const hashedSifre = await bcrypt.hash(sifre, 10);

    // Tesis oluştur (ücretsiz deneme: 3 gün, 100 bildirim)
    const tesis = await prisma.tesis.create({
      data: {
        ...setTrialDefaults(),
        tesisAdi: tesisAdi || adSoyad + ' Tesis',
        yetkiliAdSoyad: adSoyad || 'Tesis Yetkilisi',
        telefon: formattedPhone || '',
        email: email || `${formattedPhone}@mykbs.com`,
        il: il || 'İstanbul',
        ilce: ilce || '',
        adres: adres || '',
        odaSayisi: odaSayisi ? parseInt(odaSayisi) : 10,
        tesisTuru: tesisTuru || 'otel',
        tesisKodu,
        durum: 'aktif'
      }
    });

    // Kullanıcı oluştur (sahip rolü ile)
    const kullanici = await prisma.kullanici.create({
      data: {
        tesisId: tesis.id,
        adSoyad: adSoyad || 'Tesis Yetkilisi',
        telefon: formattedPhone || null,
        email: email || null,
        sifre: hashedSifre, // Yeni alan: hash'lenmiş şifre
        rol: 'sahip',
        checkInYetki: true,
        odaDegistirmeYetki: true,
        bilgiDuzenlemeYetki: true
      }
    });

    // Email gönder (eğer email varsa)
    if (email) {
      await emailService.sendRegistrationEmail(email, {
        adSoyad: adSoyad || 'Tesis Yetkilisi',
        tesisAdi: tesis.tesisAdi,
        tesisKodu: tesis.tesisKodu,
        telefon: formattedPhone || 'Belirtilmemiş'
      });
    }

    // SMS gönder (eğer telefon varsa)
    if (formattedPhone) {
      const smsMessage = `MyKBS'ye hoş geldiniz! Tesis Kodu: ${tesis.tesisKodu}\nGiriş için telefon/email ve şifrenizi kullanın.`;
      await smsService.sendSMS(formattedPhone, smsMessage);
    }

    // JWT token oluştur
    const token = jwt.sign(
      { userId: kullanici.id, tesisId: tesis.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('Yeni kayıt başarılı:', { 
      tesisId: tesis.id, 
      kullaniciId: kullanici.id,
      email: !!email,
      telefon: !!formattedPhone
    });

    res.status(201).json({
      message: 'Kayıt başarıyla tamamlandı',
      token,
      kullanici: {
        id: kullanici.id,
        adSoyad: kullanici.adSoyad,
        email: kullanici.email,
        telefon: kullanici.telefon,
        rol: kullanici.rol
      },
      tesis: {
        id: tesis.id,
        tesisAdi: tesis.tesisAdi,
        tesisKodu: tesis.tesisKodu
      }
    });

  } catch (error) {
    console.error('Kayıt hatası:', error);
    res.status(500).json({ message: 'Kayıt işlemi başarısız', error: error.message });
  }
});

/**
 * Kayıt için OTP iste (telefona SMS ile kod gönder)
 */
router.post('/kayit/otp-iste', async (req, res) => {
  try {
    const { telefon } = req.body;

    if (!telefon) {
      return res.status(400).json({ message: 'Telefon numarası gerekli' });
    }

    const formattedPhone = normalizePhone(telefon);
    if (!formattedPhone) {
      return res.status(400).json({ message: 'Geçersiz telefon numarası' });
    }

    // Bu numara zaten kayıtlı mı?
    const existing = await prisma.kullanici.findFirst({
      where: { telefon: formattedPhone }
    });
    if (existing) {
      return res.status(400).json({ message: 'Bu telefon numarası zaten kayıtlı' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    await prisma.otp.updateMany({
      where: { telefon: formattedPhone, islemTipi: 'kayit', durum: 'beklemede' },
      data: { durum: 'iptal' }
    });

    await prisma.otp.create({
      data: {
        telefon: formattedPhone,
        otp,
        islemTipi: 'kayit',
        expiresAt
      }
    });

    const smsResult = await smsService.sendOTP(formattedPhone, otp);

    if (!smsResult.success) {
      return res.status(500).json({ message: 'SMS gönderilemedi', error: smsResult.error });
    }

    console.log('Kayıt OTP gönderildi:', { telefon: formattedPhone, otp });

    const isDev = process.env.NODE_ENV !== 'production' || process.env.SMS_TEST_MODE === 'true';
    res.json({
      message: 'SMS gönderildi. Lütfen telefonunuzdaki doğrulama kodunu girin.',
      telefon: formattedPhone,
      otpExpiresIn: 5,
      ...(isDev && { otpForDev: otp }),
    });
  } catch (error) {
    console.error('Kayıt OTP isteme hatası:', error);
    res.status(500).json({ message: 'OTP gönderilemedi', error: error.message });
  }
});

/**
 * SMS ile kayıt tamamlama (OTP doğrulama ve kullanıcı oluşturma)
 */
router.post('/kayit/dogrula', async (req, res) => {
  try {
    const { telefon, otp, adSoyad, tesisAdi, il, ilce, adres, odaSayisi, tesisTuru, email, sifre, sifreTekrar } = req.body;

    if (!telefon || !otp) {
      return res.status(400).json({ message: 'Telefon ve OTP gerekli' });
    }

    if (!sifre || !sifreTekrar) {
      return res.status(400).json({ message: 'Şifre ve şifre tekrarı gerekli' });
    }
    if (sifre.length < 6) {
      return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır' });
    }
    if (sifre !== sifreTekrar) {
      return res.status(400).json({ message: 'Şifreler eşleşmiyor' });
    }

    const formattedPhone = normalizePhone(telefon);
    if (!formattedPhone) {
      return res.status(400).json({ message: 'Geçersiz telefon numarası' });
    }

    const otpTrimmed = String(otp).trim();
    const otpRecord = await prisma.otp.findFirst({
      where: {
        telefon: formattedPhone,
        otp: otpTrimmed,
        islemTipi: 'kayit',
        durum: 'beklemede',
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!otpRecord) {
      // Deneme sayısını artır
      await prisma.otp.updateMany({
        where: { telefon: formattedPhone, islemTipi: 'kayit', durum: 'beklemede' },
        data: { denemeSayisi: { increment: 1 } }
      });

      return res.status(401).json({ message: 'Geçersiz OTP' });
    }

    // OTP'yi işaretle
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { durum: 'dogrulandi' }
    });

    // Tesis kodu oluştur
    let tesisKodu;
    let unique = false;
    while (!unique) {
      tesisKodu = `MYKBS-${Math.floor(100000 + Math.random() * 900000)}`;
      const existing = await prisma.tesis.findUnique({ where: { tesisKodu } });
      if (!existing) unique = true;
    }

    // Tesis oluştur (ücretsiz deneme: 3 gün, 100 bildirim)
    const tesis = await prisma.tesis.create({
      data: {
        ...setTrialDefaults(),
        tesisAdi: tesisAdi || adSoyad + ' Tesis',
        yetkiliAdSoyad: adSoyad || 'Tesis Yetkilisi',
        telefon: formattedPhone,
        email: email || `${formattedPhone}@mykbs.com`,
        il: il || 'İstanbul',
        ilce: ilce || '',
        adres: adres || '',
        odaSayisi: odaSayisi ? parseInt(odaSayisi) : 10,
        tesisTuru: tesisTuru || 'otel',
        tesisKodu,
        durum: 'aktif'
      }
    });

    const hashedSifre = await bcrypt.hash(sifre, 10);

    // Kullanıcı oluştur (sahip rolü ile)
    const kullanici = await prisma.kullanici.create({
      data: {
        tesisId: tesis.id,
        adSoyad: adSoyad || 'Tesis Yetkilisi',
        telefon: formattedPhone,
        email: email || null,
        sifre: hashedSifre,
        rol: 'sahip',
        checkInYetki: true,
        odaDegistirmeYetki: true,
        bilgiDuzenlemeYetki: true
      }
    });

    // JWT token oluştur
    const token = jwt.sign(
      { userId: kullanici.id, tesisId: tesis.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('Kayıt tamamlandı:', { tesisId: tesis.id, kullaniciId: kullanici.id });

    res.json({
      message: 'Kayıt başarıyla tamamlandı',
      token,
      kullanici: {
        id: kullanici.id,
        adSoyad: kullanici.adSoyad,
        rol: kullanici.rol
      },
      tesis: {
        id: tesis.id,
        tesisAdi: tesis.tesisAdi,
        tesisKodu: tesis.tesisKodu,
        paket: tesis.paket,
        kota: tesis.kota,
        kullanilanKota: tesis.kullanilanKota,
        trialEndsAt: tesis.trialEndsAt
      }
    });
  } catch (error) {
    console.error('Kayıt doğrulama hatası:', error);
    res.status(500).json({ message: 'Kayıt doğrulama başarısız', error: error.message });
  }
});

/** Prisma hatası girisOnaylandi sütunu eksikse 503 döndür (migrate deploy gerekir) */
function handlePrismaAuthError(res, error) {
  const msg = error?.message || '';
  if (msg.includes('girisOnaylandi') && (msg.includes('does not exist') || msg.includes('no such column'))) {
    console.error('[auth] Veritabanı migration eksik (girisOnaylandi). Çalıştırın: npx prisma migrate deploy');
    return res.status(503).json({
      message: 'Veritabanı güncellemesi gerekli. Lütfen yöneticiye bildirin veya birkaç dakika sonra tekrar deneyin.',
      code: 'DB_MIGRATION_REQUIRED',
    });
  }
  throw error;
}

/**
 * Yeni giriş (email/telefon + şifre)
 */
router.post('/giris/yeni', async (req, res) => {
  try {
    const { email, telefon, sifre } = req.body;

    if ((!email && !telefon) || !sifre) {
      return res.status(400).json({ message: 'Email/telefon ve şifre gereklidir' });
    }

    // Kullanıcıyı bul
    let kullanici;
    try {
      if (email) {
        kullanici = await prisma.kullanici.findFirst({
          where: { email: email },
          include: { tesis: true }
        });
      } else if (telefon) {
        const formattedPhone = normalizePhone(telefon);
        if (!formattedPhone) {
          return res.status(400).json({ message: 'Geçersiz telefon numarası' });
        }
        const variants = phoneVariants(formattedPhone);
        kullanici = await prisma.kullanici.findFirst({
          where: variants.length ? { OR: variants.map((t) => ({ telefon: t })) } : { telefon: formattedPhone },
          include: { tesis: true }
        });
      }
    } catch (e) {
      return handlePrismaAuthError(res, e);
    }

    if (!kullanici) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Şifre kontrolü
    if (!kullanici.sifre) {
      return res.status(401).json({ message: 'Şifre ile giriş yapılamaz. Lütfen OTP ile giriş yapın.' });
    }

    const sifreDogru = await bcrypt.compare(sifre, kullanici.sifre);
    if (!sifreDogru) {
      return res.status(401).json({ message: 'Geçersiz şifre' });
    }

    // Tesis kontrolü (telefon/e-posta + şifre girişi için tesis zorunlu)
    if (!kullanici.tesis) {
      return res.status(403).json({ message: 'Hesabınız bir tesise bağlı değil. Yöneticinize başvurun.' });
    }
    if (kullanici.tesis.durum !== 'aktif') {
      return res.status(403).json({ message: 'Tesis aktif değil' });
    }

    // JWT token oluştur
    const token = jwt.sign(
      { userId: kullanici.id, tesisId: kullanici.tesis.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('Yeni giriş başarılı:', { 
      kullaniciId: kullanici.id, 
      girisTipi: email ? 'email' : 'telefon' 
    });

    res.json({
      token,
      kullanici: {
        id: kullanici.id,
        adSoyad: kullanici.adSoyad,
        email: kullanici.email,
        telefon: kullanici.telefon,
        rol: kullanici.rol,
        biyometriAktif: kullanici.biyometriAktif
      },
      tesis: {
        id: kullanici.tesis.id,
        tesisAdi: kullanici.tesis.tesisAdi,
        tesisKodu: kullanici.tesis.tesisKodu,
        paket: kullanici.tesis.paket,
        kota: kullanici.tesis.kota,
        kullanilanKota: kullanici.tesis.kullanilanKota,
        trialEndsAt: kullanici.tesis.trialEndsAt
      }
    });
  } catch (error) {
    console.error('Yeni giriş hatası:', error);
    res.status(500).json({ message: 'Giriş başarısız', error: error.message });
  }
});

/**
 * SMS ile giriş (telefon numarası ile OTP iste)
 */
router.post('/giris/otp-iste', async (req, res) => {
  try {
    const { telefon } = req.body;

    if (!telefon) {
      return res.status(400).json({ message: 'Telefon numarası gerekli' });
    }

    const formattedPhone = normalizePhone(telefon);
    if (!formattedPhone) {
      return res.status(400).json({ message: 'Geçersiz telefon numarası' });
    }

    // Kullanıcı var mı kontrol et (önce normalize, yoksa ham format - eski kayıtlar için)
    let kullanici = await prisma.kullanici.findFirst({
      where: { telefon: formattedPhone },
      include: { tesis: true }
    });
    if (!kullanici) {
      kullanici = await prisma.kullanici.findFirst({
        where: { telefon: telefon.trim() },
        include: { tesis: true }
      });
    }
    if (!kullanici) {
      return res.status(404).json({ message: 'Bu telefon numarası ile kayıtlı kullanıcı bulunamadı' });
    }

    if (kullanici.tesis.durum !== 'aktif') {
      return res.status(403).json({ message: 'Tesis aktif değil' });
    }

    // OTP oluştur
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5 dakika geçerli

    // Eski bekleyen OTP'leri iptal et
    await prisma.otp.updateMany({
      where: {
        telefon: formattedPhone,
        islemTipi: 'giris',
        durum: 'beklemede'
      },
      data: { durum: 'iptal' }
    });

    // OTP kaydet
    await prisma.otp.create({
      data: {
        telefon: formattedPhone,
        otp,
        kullaniciId: kullanici.id,
        islemTipi: 'giris',
        expiresAt
      }
    });

    // SMS gönder
    const smsResult = await smsService.sendOTP(formattedPhone, otp);

    if (!smsResult.success) {
      return res.status(500).json({ message: 'SMS gönderilemedi', error: smsResult.error });
    }

    console.log('Giriş OTP gönderildi:', { telefon: formattedPhone, kullaniciId: kullanici.id, otp });

    const isDev = process.env.NODE_ENV !== 'production' || process.env.SMS_TEST_MODE === 'true';
    res.json({
      message: 'SMS gönderildi. Lütfen telefonunuzdaki doğrulama kodunu girin.',
      telefon: formattedPhone,
      otpExpiresIn: 5, // dakika
      ...(isDev && { otpForDev: otp }),
    });
  } catch (error) {
    console.error('Giriş OTP isteme hatası:', error);
    res.status(500).json({ message: 'OTP gönderilemedi', error: error.message });
  }
});

/**
 * SMS ile giriş tamamlama (OTP doğrulama).
 * Body'de access_token varsa (Supabase verifyOtp sonrası) supabase-phone-session ile aynı akış.
 */
router.post('/giris/otp-dogrula', async (req, res) => {
  try {
    const accessToken = req.body?.access_token;
    if (accessToken) {
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
      if (!supabaseUrl || !apiKey) {
        return res.status(500).json({ message: 'Supabase yapılandırması eksik' });
      }
      const userRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${accessToken}`, apikey: apiKey },
      });
      if (!userRes.ok) return res.status(401).json({ message: 'Yetkisiz' });
      const supabaseUser = await userRes.json();
      const phone = supabaseUser?.phone || supabaseUser?.user_metadata?.phone;
      if (!phone) return res.status(400).json({ message: 'Telefon bilgisi bulunamadı' });
      let formattedPhone = String(phone).trim();
      if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.startsWith('90')) formattedPhone = '+' + formattedPhone;
        else if (formattedPhone.startsWith('0')) formattedPhone = '+90' + formattedPhone.slice(1);
        else formattedPhone = '+90' + formattedPhone;
      }
      let kullanici;
      try {
        kullanici = await prisma.kullanici.findFirst({
          where: { telefon: formattedPhone },
          include: { tesis: true },
        });
      } catch (e) {
        return handlePrismaAuthError(res, e);
      }
      if (!kullanici) {
        return res.status(404).json({ message: 'Bu telefon numarası ile kayıtlı kullanıcı bulunamadı' });
      }
      if (kullanici.tesis.durum !== 'aktif') {
        return res.status(403).json({ message: 'Tesis aktif değil' });
      }
      await ensureSupabaseBranchAndProfile(supabaseUser.id, kullanici, kullanici.tesis);
      const token = jwt.sign(
        { userId: kullanici.id, tesisId: kullanici.tesis.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      return res.json({
        token,
        kullanici: {
          id: kullanici.id,
          adSoyad: kullanici.adSoyad,
          email: kullanici.email,
          telefon: kullanici.telefon,
          rol: kullanici.rol,
          biyometriAktif: kullanici.biyometriAktif,
        },
        tesis: {
          id: kullanici.tesis.id,
          tesisAdi: kullanici.tesis.tesisAdi,
          tesisKodu: kullanici.tesis.tesisKodu,
          paket: kullanici.tesis.paket,
          kota: kullanici.tesis.kota,
          kullanilanKota: kullanici.tesis.kullanilanKota,
          trialEndsAt: kullanici.tesis.trialEndsAt,
        },
        supabaseAccessToken: accessToken,
      });
    }

    const { telefon, otp } = req.body;

    if (!telefon || !otp) {
      return res.status(400).json({ message: 'Telefon ve OTP gerekli' });
    }

    const formattedPhone = normalizePhone(telefon);
    if (!formattedPhone) {
      return res.status(400).json({ message: 'Geçersiz telefon numarası' });
    }

    // OTP doğrula (string olarak karşılaştır; leading zero kaynaklı uyumsuzluk olmasın)
    const otpTrimmed = String(otp).trim();
    const otpRecord = await prisma.otp.findFirst({
      where: {
        telefon: formattedPhone,
        otp: otpTrimmed,
        islemTipi: 'giris',
        durum: 'beklemede',
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        kullanici: {
          include: {
            tesis: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!otpRecord) {
      // Deneme sayısını artır
      await prisma.otp.updateMany({
        where: { telefon: formattedPhone, islemTipi: 'giris', durum: 'beklemede' },
        data: { denemeSayisi: { increment: 1 } }
      });

      return res.status(401).json({ message: 'Geçersiz OTP' });
    }

    const kullanici = otpRecord.kullanici;
    const tesis = kullanici.tesis;

    if (tesis.durum !== 'aktif') {
      return res.status(403).json({ message: 'Tesis aktif değil' });
    }

    // OTP'yi işaretle
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { durum: 'dogrulandi' }
    });

    // JWT token oluştur
    const token = jwt.sign(
      { userId: kullanici.id, tesisId: tesis.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('Giriş başarılı (OTP):', { kullaniciId: kullanici.id, tesisId: tesis.id });

    res.json({
      token,
      kullanici: {
        id: kullanici.id,
        adSoyad: kullanici.adSoyad,
        email: kullanici.email,
        telefon: kullanici.telefon,
        rol: kullanici.rol,
        biyometriAktif: kullanici.biyometriAktif
      },
      tesis: {
        id: tesis.id,
        tesisAdi: tesis.tesisAdi,
        tesisKodu: tesis.tesisKodu,
        paket: tesis.paket,
        kota: tesis.kota,
        kullanilanKota: tesis.kullanilanKota,
        trialEndsAt: tesis.trialEndsAt
      }
    });
  } catch (error) {
    console.error('Giriş OTP doğrulama hatası:', error);
    res.status(500).json({ message: 'Giriş başarısız', error: error.message });
  }
});

/**
 * PIN ile giriş (Tesis Kodu + PIN) - DEPRECATED - SMS kullanılmalı
 */
router.post('/giris', async (req, res) => {
  try {
    const { tesisKodu, pin } = req.body;

    if (!tesisKodu || !pin) {
      return res.status(400).json({ message: 'Tesis kodu ve PIN gerekli' });
    }

    // Tesis'i bul
    let tesis;
    try {
      tesis = await prisma.tesis.findUnique({
        where: { tesisKodu },
        include: {
          kullanicilar: true
        }
      });
    } catch (e) {
      return handlePrismaAuthError(res, e);
    }

    console.log('Giriş denemesi:', { tesisKodu, pinLength: pin.length, tesisFound: !!tesis });

    if (!tesis) {
      console.log('Tesis bulunamadı:', tesisKodu);
      return res.status(404).json({ message: 'Tesis bulunamadı' });
    }

    if (tesis.durum !== 'aktif') {
      console.log('Tesis aktif değil:', { tesisKodu, durum: tesis.durum });
      return res.status(404).json({ message: 'Tesis aktif değil' });
    }

    console.log('Tesis bulundu:', { tesisId: tesis.id, kullaniciSayisi: tesis.kullanicilar.length });

    if (tesis.kullanicilar.length === 0) {
      console.log('Tesis için kullanıcı bulunamadı');
      return res.status(404).json({ message: 'Tesis için kullanıcı bulunamadı' });
    }

    // PIN ile eşleşen kullanıcıyı bul
    let kullanici = null;
    for (const k of tesis.kullanicilar) {
      if (k.pin) {
        const pinMatch = await bcrypt.compare(pin, k.pin);
        console.log('PIN kontrolü:', { kullaniciId: k.id, pinMatch, hasPin: !!k.pin });
        if (pinMatch) {
          kullanici = k;
          break;
        }
      } else {
        console.log('Kullanıcı PIN yok:', { kullaniciId: k.id });
      }
    }

    if (!kullanici) {
      console.log('PIN eşleşmedi veya kullanıcı bulunamadı');
      return res.status(401).json({ message: 'Geçersiz PIN' });
    }

    // Tesis kodu + PIN girişi admin onayına tabidir; onaylanana kadar token verilmez
    if (!kullanici.girisOnaylandi) {
      await prisma.kullanici.update({
        where: { id: kullanici.id },
        data: { girisTalepAt: new Date() }
      });
      return res.status(200).json({
        success: false,
        pendingApproval: true,
        message: 'Admin onayına sunuldu. Onaylandığı an bildirim yapabileceksin. Çok kısa sürecek.'
      });
    }

    console.log('Giriş başarılı:', { kullaniciId: kullanici.id, rol: kullanici.rol });


    const token = jwt.sign(
      { userId: kullanici.id, tesisId: tesis.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      kullanici: {
        id: kullanici.id,
        adSoyad: kullanici.adSoyad,
        email: kullanici.email,
        telefon: kullanici.telefon,
        rol: kullanici.rol,
        biyometriAktif: kullanici.biyometriAktif
      },
      tesis: {
        id: tesis.id,
        tesisAdi: tesis.tesisAdi,
        tesisKodu: tesis.tesisKodu,
        paket: tesis.paket,
        kota: tesis.kota,
        kullanilanKota: tesis.kullanilanKota,
        trialEndsAt: tesis.trialEndsAt
      }
    });
  } catch (error) {
    console.error('Giriş hatası:', error);
    res.status(500).json({ message: 'Giriş başarısız', error: error.message });
  }
});

/**
 * Şifremi unuttum: Telefona OTP gönder (Supabase yoksa Node SMS ile)
 */
router.post('/sifre-sifirla/otp-iste', async (req, res) => {
  try {
    const { telefon } = req.body;
    if (!telefon) {
      return res.status(400).json({ message: 'Telefon numarası gerekli' });
    }
    const formattedPhone = normalizePhone(telefon);
    if (!formattedPhone) {
      return res.status(400).json({ message: 'Geçersiz telefon numarası' });
    }

    const kullanici = await prisma.kullanici.findFirst({
      where: { telefon: formattedPhone },
      include: { tesis: true },
    });
    if (!kullanici) {
      return res.status(404).json({ message: 'Bu telefon numarası ile kayıtlı hesap bulunamadı' });
    }
    if (kullanici.tesis.durum !== 'aktif') {
      return res.status(403).json({ message: 'Tesis aktif değil' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    await prisma.otp.updateMany({
      where: { telefon: formattedPhone, islemTipi: 'sifre_sifirla', durum: 'beklemede' },
      data: { durum: 'iptal' },
    });
    await prisma.otp.create({
      data: {
        telefon: formattedPhone,
        otp,
        kullaniciId: kullanici.id,
        islemTipi: 'sifre_sifirla',
        expiresAt,
      },
    });

    const smsResult = await smsService.sendOTP(formattedPhone, otp);
    if (!smsResult.success) {
      return res.status(500).json({ message: 'SMS gönderilemedi', error: smsResult.error });
    }
    const isDev = process.env.NODE_ENV !== 'production' || process.env.SMS_TEST_MODE === 'true';
    res.json({
      message: 'Kod gönderildi. Telefonunuza gelen 6 haneli kodu girin.',
      otpExpiresIn: 5,
      ...(isDev && { otpForDev: otp }),
    });
  } catch (error) {
    console.error('Şifre sıfırlama OTP hatası:', error);
    res.status(500).json({ message: 'Kod gönderilemedi', error: error.message });
  }
});

/**
 * Şifremi unuttum: OTP doğrulandıktan sonra şifre sıfırlama.
 * İki yol: 1) Supabase JWT (access_token), 2) Node OTP (telefon + otp) – Supabase yoksa kullanılır.
 */
router.post('/sifre-sifirla', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = (authHeader && authHeader.replace(/Bearer\s+/i, '').trim()) || req.body?.access_token || null;
    const { telefon, otp, yeniSifre, yeniSifreTekrar } = req.body;

    if (!yeniSifre || !yeniSifreTekrar) {
      return res.status(400).json({ message: 'Yeni şifre ve tekrarı gereklidir' });
    }
    if (yeniSifre.length < 6) {
      return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır' });
    }
    if (yeniSifre !== yeniSifreTekrar) {
      return res.status(400).json({ message: 'Şifreler eşleşmiyor' });
    }

    let formattedPhone = null;
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (accessToken && supabaseUrl && apiKey) {
      const userRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: apiKey,
        },
      });
      if (!userRes.ok) {
        return res.status(401).json({ message: 'Doğrulama geçersiz. Tekrar kod isteyip deneyin.' });
      }
      const supabaseUser = await userRes.json();
      const phone = supabaseUser?.phone || supabaseUser?.user_metadata?.phone;
      if (!phone) {
        return res.status(400).json({ message: 'Telefon bilgisi bulunamadı' });
      }
      formattedPhone = String(phone).trim();
      if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.startsWith('90')) formattedPhone = '+' + formattedPhone;
        else if (formattedPhone.startsWith('0')) formattedPhone = '+90' + formattedPhone.slice(1);
        else formattedPhone = '+90' + formattedPhone;
      }
    } else if (telefon && otp) {
      formattedPhone = normalizePhone(telefon);
      if (!formattedPhone) {
        return res.status(400).json({ message: 'Geçersiz telefon numarası' });
      }
      const otpTrimmed = String(otp).trim();
      const otpRecord = await prisma.otp.findFirst({
        where: {
          telefon: formattedPhone,
          otp: otpTrimmed,
          islemTipi: 'sifre_sifirla',
          durum: 'beklemede',
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!otpRecord) {
        return res.status(401).json({ message: 'Kod geçersiz. Yeni kod isteyip tekrar deneyin.' });
      }
      await prisma.otp.update({ where: { id: otpRecord.id }, data: { durum: 'dogrulandi' } });
    } else if (accessToken && (!supabaseUrl || !apiKey)) {
      return res.status(503).json({
        message: 'Şifre sıfırlama şu an sunucu ayarları nedeniyle kullanılamıyor. Lütfen "Sunucu ile kod iste" ile tekrar deneyin veya destek ile iletişime geçin.',
      });
    } else {
      return res.status(400).json({ message: 'Doğrulama gerekli. Önce kodu alıp doğrulayın, ardından yeni şifrenizi girin.' });
    }

    const variants = phoneVariants(formattedPhone);
    const kullanici = await prisma.kullanici.findFirst({
      where: variants.length ? { OR: variants.map((t) => ({ telefon: t })) } : { telefon: formattedPhone },
      include: { tesis: true },
    });
    if (!kullanici) {
      return res.status(404).json({ message: 'Bu telefon numarası ile kayıtlı hesap bulunamadı' });
    }
    if (kullanici.tesis.durum !== 'aktif') {
      return res.status(403).json({ message: 'Tesis aktif değil' });
    }

    const hashedSifre = await bcrypt.hash(yeniSifre, 10);
    await prisma.kullanici.update({
      where: { id: kullanici.id },
      data: { sifre: hashedSifre },
    });

    res.json({ message: 'Şifreniz güncellendi. Telefon veya e-posta ve yeni şifrenizle giriş yapabilirsiniz.' });
  } catch (error) {
    console.error('Şifre sıfırlama hatası:', error);
    res.status(500).json({ message: 'Şifre güncellenemedi', error: error.message });
  }
});

/**
 * Şifre belirleme/güncelleme (giriş yapmış kullanıcı)
 */
router.post('/sifre', authenticate, async (req, res) => {
  try {
    const { sifre, sifreTekrar } = req.body;

    if (!sifre || !sifreTekrar) {
      return res.status(400).json({ message: 'Şifre ve şifre tekrarı gereklidir' });
    }
    if (sifre !== sifreTekrar) {
      return res.status(400).json({ message: 'Şifreler eşleşmiyor' });
    }
    if (sifre.length < 6) {
      return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır' });
    }

    const hashedSifre = await bcrypt.hash(sifre, 10);

    await prisma.kullanici.update({
      where: { id: req.user.id },
      data: { sifre: hashedSifre }
    });

    res.json({ message: 'Şifre başarıyla kaydedildi. Telefon veya email + şifre ile giriş yapabilirsiniz.' });
  } catch (error) {
    console.error('Şifre kayıt hatası:', error);
    res.status(500).json({ message: 'Şifre kaydedilemedi', error: error.message });
  }
});

/**
 * Supabase Phone Auth (Twilio) ile giriş sonrası: access_token ile uygulama token'ı al
 * Supabase Auth > Phone provider + Twilio Verify kullanıldığında çağrılır.
 */
router.post('/supabase-phone-session', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace(/Bearer\s+/i, '') || req.body?.access_token;

    if (!accessToken) {
      return res.status(400).json({ message: 'Supabase access_token gerekli' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !apiKey) {
      return res.status(500).json({ message: 'Supabase yapılandırması eksik (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)' });
    }

    const userRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: apiKey,
      },
    });

    if (!userRes.ok) {
      return res.status(401).json({ message: 'Yetkisiz' });
    }

    const supabaseUser = await userRes.json();
    const phone = supabaseUser?.phone || supabaseUser?.user_metadata?.phone;
    if (!phone) {
      return res.status(400).json({ message: 'Telefon bilgisi bulunamadı' });
    }

    let formattedPhone = String(phone).trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('90')) formattedPhone = '+' + formattedPhone;
      else if (formattedPhone.startsWith('0')) formattedPhone = '+90' + formattedPhone.slice(1);
      else formattedPhone = '+90' + formattedPhone;
    }

    const kullanici = await prisma.kullanici.findFirst({
      where: { telefon: formattedPhone },
      include: { tesis: true },
    });

    if (!kullanici) {
      return res.status(404).json({ message: 'Bu telefon numarası ile kayıtlı kullanıcı bulunamadı' });
    }

    if (kullanici.tesis.durum !== 'aktif') {
      return res.status(403).json({ message: 'Tesis aktif değil' });
    }

    await ensureSupabaseBranchAndProfile(supabaseUser.id, kullanici, kullanici.tesis);

    const token = jwt.sign(
      { userId: kullanici.id, tesisId: kullanici.tesis.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      kullanici: {
        id: kullanici.id,
        adSoyad: kullanici.adSoyad,
        email: kullanici.email,
        telefon: kullanici.telefon,
        rol: kullanici.rol,
        biyometriAktif: kullanici.biyometriAktif,
      },
      tesis: {
        id: kullanici.tesis.id,
        tesisAdi: kullanici.tesis.tesisAdi,
        tesisKodu: kullanici.tesis.tesisKodu,
        paket: kullanici.tesis.paket,
        kota: kullanici.tesis.kota,
        kullanilanKota: kullanici.tesis.kullanilanKota,
        trialEndsAt: kullanici.tesis.trialEndsAt,
      },
      supabaseAccessToken: accessToken,
    });
  } catch (error) {
    console.error('Supabase phone session hatası:', error);
    res.status(500).json({ message: 'Oturum alınamadı', error: error.message });
  }
});

/**
 * Supabase OTP doğrulama proxy: Telefon + OTP ile Supabase /auth/v1/verify çağrısını backend üzerinden yapar.
 * Mobil cihazdan doğrudan Supabase'e giden istekler düşük bot skoru (native app) nedeniyle 403 alabildiği için
 * doğrulama sunucu tarafından yapılır; böylece istek backend IP'sinden gider.
 */
router.post('/kayit/supabase-verify-otp', async (req, res) => {
  try {
    const { phone: rawPhone, token } = req.body;
    if (!rawPhone || !token || String(token).trim().length < 6) {
      return res.status(400).json({ message: 'Telefon ve 6 haneli kod gerekli' });
    }
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      return res.status(400).json({ message: 'Geçersiz telefon numarası' });
    }
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !apiKey) {
      return res.status(500).json({ message: 'Supabase yapılandırması eksik (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)' });
    }
    const verifyRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ type: 'sms', phone, token: String(token).trim() }),
    });
    const data = await verifyRes.json().catch(() => ({}));
    if (verifyRes.ok && data.access_token) {
      return res.json({ access_token: data.access_token });
    }
    const errMsg = data.error_description || data.msg || data.message || (verifyRes.status === 403 ? 'Kod geçersiz. Yeni kod isteyip tekrar deneyin.' : 'Doğrulama başarısız.');
    return res.status(verifyRes.status >= 400 ? verifyRes.status : 400).json({ message: errMsg });
  } catch (error) {
    console.error('Kayıt supabase-verify-otp hatası:', error);
    return res.status(500).json({ message: 'Doğrulama yapılamadı', error: error.message });
  }
});

/**
 * Supabase OTP ile doğrulanmış kayıt: access_token + form bilgileri ile kullanıcı/tesis oluştur.
 * Kayıt ekranında SMS Supabase (Twilio) ile gidiyorsa bu endpoint kullanılır; aynı kanal girişte de kullanıldığı için SMS gelir.
 */
router.post('/kayit/supabase-create', async (req, res) => {
  try {
    const accessToken = req.body.access_token || req.headers.authorization?.replace(/Bearer\s+/i, '');
    const { adSoyad, tesisAdi, il, ilce, adres, odaSayisi, tesisTuru, email, sifre, sifreTekrar } = req.body;

    if (!accessToken) {
      return res.status(400).json({ message: 'Supabase doğrulama gerekli (access_token)' });
    }
    if (!adSoyad || adSoyad.trim().length < 3) {
      return res.status(400).json({ message: 'Ad soyad en az 3 karakter olmalı' });
    }
    if (!sifre || sifre.length < 6) {
      return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır' });
    }
    if (sifre !== sifreTekrar) {
      return res.status(400).json({ message: 'Şifreler eşleşmiyor' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || '';
    const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !apiKey) {
      return res.status(500).json({ message: 'Supabase yapılandırması eksik (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)' });
    }

    const userRes = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: apiKey },
    });
    if (!userRes.ok) {
      return res.status(401).json({ message: 'Doğrulama geçersiz. Kodu tekrar isteyip deneyin.' });
    }
    const supabaseUser = await userRes.json();
    const phone = supabaseUser?.phone || supabaseUser?.user_metadata?.phone;
    if (!phone) {
      return res.status(400).json({ message: 'Telefon bilgisi bulunamadı' });
    }

    let formattedPhone = String(phone).trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('90')) formattedPhone = '+' + formattedPhone;
      else if (formattedPhone.startsWith('0')) formattedPhone = '+90' + formattedPhone.slice(1);
      else formattedPhone = '+90' + formattedPhone;
    }

    const existing = await prisma.kullanici.findFirst({ where: { telefon: formattedPhone } });
    if (existing) {
      return res.status(400).json({ message: 'Bu telefon numarası zaten kayıtlı. Giriş yapın.' });
    }

    let tesisKodu;
    let unique = false;
    while (!unique) {
      tesisKodu = `MYKBS-${Math.floor(100000 + Math.random() * 900000)}`;
      const ex = await prisma.tesis.findUnique({ where: { tesisKodu } });
      if (!ex) unique = true;
    }

    const tesis = await prisma.tesis.create({
      data: {
        ...setTrialDefaults(),
        tesisAdi: (tesisAdi && tesisAdi.trim()) || adSoyad.trim() + ' Tesis',
        yetkiliAdSoyad: adSoyad.trim(),
        telefon: formattedPhone,
        email: email && email.trim() ? email.trim() : `${formattedPhone.replace(/\D/g, '')}@mykbs.com`,
        il: il || 'İstanbul',
        ilce: ilce || '',
        adres: adres || '',
        odaSayisi: odaSayisi ? parseInt(odaSayisi) : 10,
        tesisTuru: tesisTuru || 'otel',
        tesisKodu,
        durum: 'aktif',
      },
    });

    const hashedSifre = await bcrypt.hash(sifre, 10);
    const kullanici = await prisma.kullanici.create({
      data: {
        tesisId: tesis.id,
        adSoyad: adSoyad.trim(),
        telefon: formattedPhone,
        email: email && email.trim() ? email.trim() : null,
        sifre: hashedSifre,
        rol: 'sahip',
        checkInYetki: true,
        odaDegistirmeYetki: true,
        bilgiDuzenlemeYetki: true,
      },
    });

    await ensureSupabaseBranchAndProfile(supabaseUser.id, kullanici, tesis);

    const token = jwt.sign(
      { userId: kullanici.id, tesisId: tesis.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Kayıt başarıyla tamamlandı',
      token,
      kullanici: {
        id: kullanici.id,
        adSoyad: kullanici.adSoyad,
        email: kullanici.email,
        telefon: kullanici.telefon,
        rol: kullanici.rol,
        biyometriAktif: kullanici.biyometriAktif,
      },
      tesis: {
        id: tesis.id,
        tesisAdi: tesis.tesisAdi,
        tesisKodu: tesis.tesisKodu,
        paket: tesis.paket,
        kota: tesis.kota,
        kullanilanKota: tesis.kullanilanKota,
        trialEndsAt: tesis.trialEndsAt,
      },
      supabaseAccessToken: accessToken,
    });
  } catch (error) {
    console.error('Kayıt supabase-create hatası:', error);
    res.status(500).json({ message: 'Kayıt tamamlanamadı', error: error.message });
  }
});

/**
 * Mevcut kullanıcı bilgilerini getir (Supabase token veya backend JWT).
 * role: 'user' | 'admin' — mobil Admin sekmesi görünürlüğü için.
 */
router.get('/me', authenticateTesisOrSupabase, async (req, res) => {
  try {
    if (req.authSource === 'supabase') {
      const u = req.user;
      const b = req.branch;
      const profileRole = req.profileRole || 'staff';
      let is_admin = false;
      let role = 'user';
      if (supabaseAdmin) {
        const { data: profileRow } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', u.id).maybeSingle();
        is_admin = profileRow?.is_admin === true;
        const { data: appRole } = await supabaseAdmin.from('app_roles').select('role').eq('user_id', u.id).maybeSingle();
        if (appRole?.role === 'admin') role = 'admin';
        else if (is_admin) role = 'admin';
      }
      return res.json({
        kullanici: {
          id: u.id,
          uid: u.id,
          adSoyad: u.user_metadata?.full_name || u.user_metadata?.ad_soyad || u.email || u.phone || 'Kullanıcı',
          telefon: u.phone || null,
          email: u.email || null,
          rol: profileRole,
          biyometriAktif: false,
          is_admin,
          role,
          yetkiler: { checkIn: true, odaDegistirme: true, bilgiDuzenleme: true }
        },
        tesis: {
          id: b.id,
          tesisAdi: b.name,
          tesisKodu: b.id,
          paket: 'standart',
          kota: 1000,
          kullanilanKota: 0,
          kbsTuru: b.kbs_turu || null
        }
      });
    }

    let kullanici;
    try {
      kullanici = await prisma.kullanici.findUnique({
        where: { id: req.user.id },
        include: {
          tesis: {
            select: {
              id: true,
              tesisAdi: true,
              paket: true,
              kota: true,
              kullanilanKota: true,
              trialEndsAt: true,
            kbsTuru: true
          }
        }
      }
    });
    } catch (e) {
      return handlePrismaAuthError(res, e);
    }

    let role = 'user';
    const adminKullaniciId = process.env.ADMIN_KULLANICI_ID != null ? Number(process.env.ADMIN_KULLANICI_ID) : null;
    if (adminKullaniciId != null && adminKullaniciId === kullanici.id) role = 'admin';
    else if (supabaseAdmin) {
      const { data: appRole } = await supabaseAdmin.from('app_roles').select('role').eq('backend_kullanici_id', kullanici.id).maybeSingle();
      if (appRole?.role === 'admin') role = 'admin';
    }

    res.json({
      kullanici: {
        id: kullanici.id,
        adSoyad: kullanici.adSoyad,
        telefon: kullanici.telefon,
        email: kullanici.email,
        rol: kullanici.rol,
        biyometriAktif: kullanici.biyometriAktif,
        is_admin: role === 'admin',
        role,
        yetkiler: {
          checkIn: kullanici.checkInYetki,
          odaDegistirme: kullanici.odaDegistirmeYetki,
          bilgiDuzenleme: kullanici.bilgiDuzenlemeYetki
        }
      },
      tesis: kullanici.tesis
    });
  } catch (error) {
    console.error('Kullanıcı bilgisi hatası:', error);
    res.status(500).json({ message: 'Bilgi alınamadı', error: error.message });
  }
});

module.exports = router;

