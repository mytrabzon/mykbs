const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const smsService = require('../services/sms');
const emailService = require('../services/email');
const { ensureSupabaseBranchAndProfile } = require('../services/supabaseSync');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { supabase: supabaseAnon } = require('../services/supabase');
const { setTrialDefaults } = require('../config/packages');
const { BUCKET_AVATARS } = require('../config/storage');

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
          bilgiDuzenlemeYetki: true,
          girisOnaylandi: true
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
 * Yeni kayıt (tek adım: ad soyad, telefon, e-posta, şifre, otel adı, oda sayısı, ortalama bildirim).
 * Kayıt olan kullanıcı hemen uygulamayı kullanabilir; KBS için Ayarlar'dan tesis kodu ve şifre ile onaya gönderir.
 */
router.post('/kayit', async (req, res) => {
  try {
    const {
      adSoyad,
      telefon,
      email,
      sifre,
      sifreTekrar,
      tesisAdi,
      odaSayisi,
      ortalamaBildirim,
      il,
      ilce,
      adres,
      tesisTuru,
    } = req.body;

    if (!adSoyad || String(adSoyad).trim().length < 2) {
      return res.status(400).json({ message: 'Ad soyad en az 2 karakter olmalıdır' });
    }
    // Telefon isteğe bağlı; kayıt sadece e-posta ile yapılır. Telefon profilde eklenebilir.
    const formattedPhone = (telefon && String(telefon).trim().length >= 10)
      ? normalizePhone(telefon)
      : '';
    if (formattedPhone === '' && telefon && String(telefon).trim().length > 0) {
      return res.status(400).json({ message: 'Geçerli bir telefon numarası giriniz veya boş bırakın' });
    }
    if (!email || String(email).trim().length < 5) {
      return res.status(400).json({ message: 'E-posta adresi giriniz' });
    }
    const emailNorm = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json({ message: 'Geçerli bir e-posta adresi giriniz' });
    }
    if (!sifre || sifre.length < 6) {
      return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır' });
    }
    if (sifre !== sifreTekrar) {
      return res.status(400).json({ message: 'Şifreler eşleşmiyor' });
    }
    if (!tesisAdi || String(tesisAdi).trim().length < 2) {
      return res.status(400).json({ message: 'Otel / tesis adı giriniz' });
    }
    const odaNum = parseInt(odaSayisi, 10);
    if (isNaN(odaNum) || odaNum < 1 || odaNum > 10000) {
      return res.status(400).json({ message: 'Oda sayısı 1–10000 arası olmalıdır' });
    }

    // Telefon yoksa DB zorunlu alan için placeholder (e-posta ile kayıt)
    const phoneForDb = formattedPhone || '-';

    const existingEmail = await prisma.kullanici.findFirst({ where: { email: emailNorm } });
    if (existingEmail) {
      return res.status(400).json({ message: 'Bu e-posta adresi zaten kayıtlı' });
    }
    if (formattedPhone) {
      const variants = phoneVariants(formattedPhone);
      const existingPhone = await prisma.kullanici.findFirst({
        where: variants.length ? { OR: variants.map((t) => ({ telefon: t })) } : { telefon: formattedPhone },
      });
      if (existingPhone) {
        return res.status(400).json({ message: 'Bu telefon numarası zaten kayıtlı' });
      }
    }

    let tesisKodu;
    let unique = false;
    while (!unique) {
      tesisKodu = `MYKBS-${Math.floor(100000 + Math.random() * 900000)}`;
      const ex = await prisma.tesis.findUnique({ where: { tesisKodu } });
      if (!ex) unique = true;
    }

    const trialDefaults = setTrialDefaults();
    const kota = Math.min(Math.max(parseInt(ortalamaBildirim, 10) || trialDefaults.kota, 50), 10000);

    const tesis = await prisma.tesis.create({
      data: {
        ...trialDefaults,
        kota,
        tesisAdi: String(tesisAdi).trim(),
        yetkiliAdSoyad: String(adSoyad).trim(),
        telefon: phoneForDb,
        email: emailNorm,
        il: (il && String(il).trim()) || '',
        ilce: (ilce && String(ilce).trim()) || '',
        adres: (adres && String(adres).trim()) || '',
        odaSayisi: odaNum,
        tesisTuru: (tesisTuru && String(tesisTuru).trim()) || 'otel',
        tesisKodu,
        durum: 'aktif',
      },
    });

    const hashedSifre = await bcrypt.hash(sifre, 10);
    const kullanici = await prisma.kullanici.create({
      data: {
        tesisId: tesis.id,
        adSoyad: String(adSoyad).trim(),
        telefon: phoneForDb,
        email: emailNorm,
        sifre: hashedSifre,
        rol: 'sahip',
        checkInYetki: true,
        odaDegistirmeYetki: true,
        bilgiDuzenlemeYetki: true,
        girisOnaylandi: true,
      },
    });

    try {
      if (emailNorm) {
        await emailService.sendRegistrationEmail(emailNorm, {
          adSoyad: String(adSoyad).trim(),
          tesisAdi: tesis.tesisAdi,
          tesisKodu: tesis.tesisKodu,
          telefon: phoneForDb !== '-' ? phoneForDb : undefined,
        });
      }
    } catch (e) {
      console.warn('Kayıt e-posta gönderilemedi:', e?.message);
    }
    try {
      if (formattedPhone) {
        await smsService.sendSMS(formattedPhone, "KBS Prime'a hoş geldiniz! Tesis: " + tesis.tesisAdi + ". Giriş: e-posta ve şifreniz.");
      }
    } catch (e) {
      console.warn('Kayıt SMS gönderilemedi:', e?.message);
    }

    const token = jwt.sign(
      { userId: kullanici.id, tesisId: tesis.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('Yeni kayıt başarılı:', { tesisId: tesis.id, kullaniciId: kullanici.id });

    // Supabase kullanılıyorsa: access_token ile user_profiles + branch_id oluştur ve şifreyi Supabase Auth'a yaz (e-posta+şifre ile giriş çalışsın)
    const accessToken = req.body.access_token;
    if (accessToken && typeof accessToken === 'string' && supabaseAdmin) {
      try {
        const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(accessToken);
        if (!error && supabaseUser?.id) {
          await ensureSupabaseBranchAndProfile(supabaseUser.id, kullanici, tesis);
          const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(supabaseUser.id, { password: sifre });
          if (updateErr) console.warn('[auth/kayit] Supabase şifre güncellemesi atlandı:', updateErr?.message);
        }
      } catch (e) {
        console.warn('[auth/kayit] Supabase sync atlandı:', e?.message);
      }
    }

    res.status(201).json({
      message: "Kayıt tamamlandı. Uygulamayı kullanabilirsiniz. KBS için Ayarlar'dan tesis kodu ve şifre ile onaya gönderin.",
      token,
      kullanici: {
        id: kullanici.id,
        adSoyad: kullanici.adSoyad,
        email: kullanici.email,
        telefon: kullanici.telefon,
        rol: kullanici.rol,
        yetkiler: { checkIn: true, odaDegistirme: true, bilgiDuzenleme: true },
      },
      tesis: {
        id: tesis.id,
        tesisAdi: tesis.tesisAdi,
        tesisKodu: tesis.tesisKodu,
        paket: tesis.paket,
        kota: tesis.kota,
        kullanilanKota: tesis.kullanilanKota ?? 0,
      },
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

    // Kullanıcı oluştur (sahip rolü ile); üye onayı yok, doğrudan giriş yapabilir
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
        bilgiDuzenlemeYetki: true,
        girisOnaylandi: true
      }
    });

    // JWT token oluştur
    const token = jwt.sign(
      { userId: kullanici.id, tesisId: tesis.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('Kayıt tamamlandı:', { tesisId: tesis.id, kullaniciId: kullanici.id });

    // Supabase kullanılıyorsa: access_token ile user_profiles + branch_id oluştur (şube atanması)
    const accessTokenKayit = req.body.access_token;
    if (accessTokenKayit && typeof accessTokenKayit === 'string' && supabaseAdmin) {
      try {
        const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(accessTokenKayit);
        if (!error && supabaseUser?.id) {
          await ensureSupabaseBranchAndProfile(supabaseUser.id, kullanici, tesis);
        }
      } catch (e) {
        console.warn('[auth/kayit/dogrula] Supabase sync atlandı:', e?.message);
      }
    }

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

/** Ortak giriş yanıtı: tesis kontrolü + JWT + kullanici/tesis/supabaseAccessToken */
async function issueGirisYeniResponse(res, kullanici, supabaseAccessToken) {
  if (!kullanici.tesis) {
    return res.status(403).json({ message: 'Hesabınız bir tesise bağlı değil. Yöneticinize başvurun.' });
  }
  if (kullanici.tesis.durum !== 'aktif') {
    return res.status(403).json({ message: 'Tesis aktif değil' });
  }
  const token = jwt.sign(
    { userId: kullanici.id, tesisId: kullanici.tesis.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  const adminKullaniciIdRaw = process.env.ADMIN_KULLANICI_ID != null ? String(process.env.ADMIN_KULLANICI_ID).trim() : '';
  const isAdmin = adminKullaniciIdRaw && adminKullaniciIdRaw === String(kullanici.id);
  const role = isAdmin ? 'admin' : 'user';
  return res.json({
    token,
    kullanici: {
      id: kullanici.id,
      adSoyad: kullanici.adSoyad,
      email: kullanici.email,
      telefon: kullanici.telefon,
      rol: kullanici.rol,
      biyometriAktif: kullanici.biyometriAktif,
      is_admin: isAdmin,
      role,
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
    ...(supabaseAccessToken && { supabaseAccessToken }),
  });
}

/**
 * Yeni giriş (email/telefon + şifre)
 */
router.post('/giris/yeni', async (req, res) => {
  try {
    const { email, telefon, sifre } = req.body;

    const sifreTrim = (sifre && String(sifre).trim()) || '';
    if ((!email && !telefon) || !sifreTrim) {
      return res.status(400).json({ message: 'Email/telefon ve şifre gereklidir' });
    }

    // Silinmiş hesap: destek talebi aç, 403 döndür
    const emailStr = email ? String(email).trim().toLowerCase() : null;
    const phoneStr = telefon ? String(telefon).trim() : null;
    if (emailStr) {
      const deleted = await prisma.deletedAccount.findFirst({ where: { email: emailStr } }).catch(() => null);
      if (deleted) {
        try {
          await prisma.supportTicket.create({
            data: {
              authorName: emailStr,
              authorEmail: emailStr,
              subject: 'Hesap silindi - giriş denemesi',
              message: 'Bu e-posta ile kayıtlı hesap kapatılmış. Kullanıcı giriş yapmaya çalıştı.',
              status: 'acik',
            },
          });
          require('../lib/notifyAdminPush').notifyAdminPush({
            title: 'Hesap silindi - giriş denemesi',
            body: emailStr,
            data: { type: 'deleted_account_ticket' },
          }).catch((e) => console.warn('[auth] admin push', e?.message));
        } catch (e) {
          console.warn('[auth] deleted ticket', e?.message);
        }
        return res.status(403).json({
          code: 'ACCOUNT_DELETED',
          message: 'Hesabınız silindi. Destek talebiniz oluşturuldu; yönetici inceleyecektir.',
        });
      }
    }
    if (phoneStr) {
      const digits = phoneStr.replace(/\D/g, '');
      const variants = digits.startsWith('90') ? [phoneStr, '+' + digits, '0' + digits.slice(2)] : ['+90' + digits.slice(digits.startsWith('0') ? 1 : 0), phoneStr];
      for (const p of variants) {
        const deleted = await prisma.deletedAccount.findFirst({ where: { phone: p } }).catch(() => null);
        if (deleted) {
          try {
            await prisma.supportTicket.create({
              data: {
                authorName: p,
                authorEmail: null,
                subject: 'Hesap silindi - giriş denemesi',
                message: 'Bu telefon ile kayıtlı hesap kapatılmış. Kullanıcı giriş yapmaya çalıştı.',
                status: 'acik',
              },
            });
            require('../lib/notifyAdminPush').notifyAdminPush({
              title: 'Hesap silindi - giriş denemesi',
              body: p,
              data: { type: 'deleted_account_ticket' },
            }).catch((err) => console.warn('[auth] admin push', err?.message));
          } catch (e) {
            console.warn('[auth] deleted ticket', e?.message);
          }
          return res.status(403).json({
            code: 'ACCOUNT_DELETED',
            message: 'Hesabınız silindi. Destek talebiniz oluşturuldu; yönetici inceleyecektir.',
          });
        }
      }
    }

    // Kullanıcıyı bul
    let kullanici;
    try {
      if (email) {
        const emailNorm = String(email).trim().toLowerCase();
        kullanici = await prisma.kullanici.findFirst({
          where: { email: emailNorm },
          include: { tesis: true }
        });
        if (!kullanici) {
          kullanici = await prisma.kullanici.findFirst({
            where: { email: email },
            include: { tesis: true }
          });
        }
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

    // Şifre kontrolü — hesapta şifre yoksa (örn. sadece OTP ile kayıt olunduysa) net mesaj
    const emailForSupabase = (kullanici.email || '').trim().toLowerCase();
    if (!kullanici.sifre) {
      // Prisma'da şifre yok; sadece Supabase ile giriş denenebilir (örn. şifre sadece Supabase'de tanımlı)
      if (emailForSupabase && supabaseAnon?.auth) {
        const { data: supabaseData, error: supabaseErr } = await supabaseAnon.auth.signInWithPassword({
          email: emailForSupabase,
          password: sifreTrim,
        });
        if (!supabaseErr && supabaseData?.session?.access_token) {
          // Supabase ile giriş başarılı — Prisma şifresini senkronize et, sonra aynı payload ile devam
          const hashedSifre = await bcrypt.hash(sifreTrim, 10);
          await prisma.kullanici.update({ where: { id: kullanici.id }, data: { sifre: hashedSifre } }).catch(() => {});
          return await issueGirisYeniResponse(res, kullanici, supabaseData.session.access_token);
        }
      }
      return res.status(401).json({
        message: 'Bu hesapta şifre tanımlı değil. "Kod ile giriş" kullanın veya "Şifremi unuttum" ile şifre oluşturun.',
        code: 'PASSWORD_NOT_SET',
      });
    }

    let sifreDogru = await bcrypt.compare(sifreTrim, kullanici.sifre);
    if (!sifreDogru && emailForSupabase && supabaseAnon?.auth) {
      // Backend (Prisma) şifresi eşleşmedi; şifre sadece Supabase'de güncellenmiş olabilir (internet girişi Supabase ile)
      const { data: supabaseData, error: supabaseErr } = await supabaseAnon.auth.signInWithPassword({
        email: emailForSupabase,
        password: sifreTrim,
      });
      if (!supabaseErr && supabaseData?.session?.access_token) {
        const hashedSifre = await bcrypt.hash(sifreTrim, 10);
        await prisma.kullanici.update({ where: { id: kullanici.id }, data: { sifre: hashedSifre } }).catch(() => {});
        return await issueGirisYeniResponse(res, kullanici, supabaseData.session.access_token);
      }
    }
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

    // Profil ve topluluk için Supabase token — e-posta ile giren herkes topluluk görebilsin
    let supabaseAccessToken = null;
    if (emailForSupabase && supabaseAnon?.auth) {
      try {
        const { data, error } = await supabaseAnon.auth.signInWithPassword({
          email: emailForSupabase,
          password: sifreTrim,
        });
        if (!error && data?.session?.access_token) {
          supabaseAccessToken = data.session.access_token;
        }
      } catch (e) {
        // Supabase'de kullanıcı yoksa oluştur, topluluk çalışsın
        if (supabaseAdmin?.auth) {
          try {
            const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
              email: emailForSupabase,
              password: sifreTrim,
              email_confirm: true,
            });
            if (!createErr && createData?.user?.id) {
              await ensureSupabaseBranchAndProfile(createData.user.id, kullanici, kullanici.tesis);
              const { data: signInData, error: signInErr } = await supabaseAnon.auth.signInWithPassword({
                email: emailForSupabase,
                password: sifreTrim,
              });
              if (!signInErr && signInData?.session?.access_token) {
                supabaseAccessToken = signInData.session.access_token;
              }
            }
          } catch (adminE) {
            // Kullanıcı zaten var vb. — token olmadan devam
          }
        }
      }
    }

    // Admin yetkisi: ADMIN_KULLANICI_ID ile eşleşen kullanıcı mobilde Admin butonunu görür
    const adminKullaniciIdRaw = process.env.ADMIN_KULLANICI_ID != null ? String(process.env.ADMIN_KULLANICI_ID).trim() : '';
    const isAdmin = adminKullaniciIdRaw && adminKullaniciIdRaw === String(kullanici.id);
    const role = isAdmin ? 'admin' : 'user';

    res.json({
      token,
      kullanici: {
        id: kullanici.id,
        adSoyad: kullanici.adSoyad,
        email: kullanici.email,
        telefon: kullanici.telefon,
        rol: kullanici.rol,
        biyometriAktif: kullanici.biyometriAktif,
        is_admin: isAdmin,
        role
      },
      tesis: {
        id: kullanici.tesis.id,
        tesisAdi: kullanici.tesis.tesisAdi,
        tesisKodu: kullanici.tesis.tesisKodu,
        paket: kullanici.tesis.paket,
        kota: kullanici.tesis.kota,
        kullanilanKota: kullanici.tesis.kullanilanKota,
        trialEndsAt: kullanici.tesis.trialEndsAt
      },
      ...(supabaseAccessToken && { supabaseAccessToken }),
    });
  } catch (error) {
    console.error('Yeni giriş hatası:', error);
    res.status(500).json({ message: 'Giriş başarısız', error: error.message });
  }
});

// Özel giriş: sadece yetkili personel. Production'da (Railway vb.) ADMIN_SECRET env değişkeni mutlaka ayarlanmalı.
router.post('/ozel-giris', async (req, res) => {
  try {
    const sifre = (req.body.sifre && String(req.body.sifre).trim()) || '';
    const adminSecret = (process.env.ADMIN_SECRET || '').trim();
    if (!adminSecret || sifre !== adminSecret) {
      return res.status(401).json({ message: 'Geçersiz giriş kodu' });
    }
    let kullanici = null;
    const adminKullaniciIdRaw = process.env.ADMIN_KULLANICI_ID != null ? String(process.env.ADMIN_KULLANICI_ID).trim() : '';
    if (adminKullaniciIdRaw) {
      kullanici = await prisma.kullanici.findUnique({
        where: { id: adminKullaniciIdRaw },
        include: { tesis: true }
      });
    }
    if (!kullanici) {
      const adminTesis = await prisma.tesis.findFirst({ where: { tesisKodu: 'MYKBS-ADMIN' } });
      if (adminTesis) {
        kullanici = await prisma.kullanici.findFirst({
          where: { tesisId: adminTesis.id },
          include: { tesis: true }
        });
      }
    }
    if (!kullanici || !kullanici.tesis) {
      return res.status(503).json({ message: 'Giriş şu an kullanılamıyor.' });
    }
    const token = jwt.sign(
      { userId: kullanici.id, tesisId: kullanici.tesis.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    const isAdmin = adminKullaniciIdRaw && adminKullaniciIdRaw === String(kullanici.id);
    res.json({
      token,
      kullanici: {
        id: kullanici.id,
        adSoyad: kullanici.adSoyad,
        email: kullanici.email,
        telefon: kullanici.telefon,
        rol: kullanici.rol,
        biyometriAktif: kullanici.biyometriAktif,
        is_admin: isAdmin,
        role: isAdmin ? 'admin' : 'user',
        yetkiler: {
          checkIn: !!kullanici.checkInYetki,
          odaDegistirme: !!kullanici.odaDegistirmeYetki,
          bilgiDuzenleme: !!kullanici.bilgiDuzenlemeYetki
        }
      },
      tesis: {
        id: kullanici.tesis.id,
        tesisAdi: kullanici.tesis.tesisAdi,
        tesisKodu: kullanici.tesis.tesisKodu,
        paket: kullanici.tesis.paket,
        kota: kullanici.tesis.kota,
        kullanilanKota: kullanici.tesis.kullanilanKota ?? 0,
        trialEndsAt: kullanici.tesis.trialEndsAt
      }
    });
  } catch (error) {
    console.error('ozel-giris error:', error);
    res.status(500).json({ message: 'Giriş başarısız' });
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

    // Kullanıcı var mı — şifre girişiyle aynı mantık: phoneVariants ile bul (DB farklı formatta kayıtlı olabilir)
    const variants = phoneVariants(formattedPhone);
    let kullanici = await prisma.kullanici.findFirst({
      where: variants.length ? { OR: variants.map((t) => ({ telefon: t })) } : { telefon: formattedPhone },
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
      const emailFromSupabase = supabaseUser?.email || supabaseUser?.user_metadata?.email;

      let kullanici;
      try {
        if (phone) {
          let formattedPhone = String(phone).trim();
          if (!formattedPhone.startsWith('+')) {
            if (formattedPhone.startsWith('90')) formattedPhone = '+' + formattedPhone;
            else if (formattedPhone.startsWith('0')) formattedPhone = '+90' + formattedPhone.slice(1);
            else formattedPhone = '+90' + formattedPhone;
          }
          kullanici = await prisma.kullanici.findFirst({
            where: { telefon: formattedPhone },
            include: { tesis: true },
          });
        }
        if (!kullanici && emailFromSupabase) {
          const emailTrimmed = String(emailFromSupabase).trim().toLowerCase();
          kullanici = await prisma.kullanici.findFirst({
            where: { email: emailTrimmed },
            include: { tesis: true },
          });
        }
      } catch (e) {
        return handlePrismaAuthError(res, e);
      }
      if (!kullanici) {
        return res.status(404).json({
          message: phone
            ? 'Bu telefon numarası ile kayıtlı kullanıcı bulunamadı'
            : emailFromSupabase
              ? 'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı'
              : 'Telefon veya e-posta bilgisi bulunamadı',
        });
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

    // Üye onayı kaldırıldı: tesis kodu + PIN ile girişte onay beklemeden token verilir
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
    const emailFromSupabase = supabaseUser?.email || supabaseUser?.user_metadata?.email;

    let formattedPhone = '';
    let userEmail = (email && email.trim()) || emailFromSupabase || null;

    if (phone) {
      formattedPhone = String(phone).trim();
      if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.startsWith('90')) formattedPhone = '+' + formattedPhone;
        else if (formattedPhone.startsWith('0')) formattedPhone = '+90' + formattedPhone.slice(1);
        else formattedPhone = '+90' + formattedPhone;
      }
      const existingByPhone = await prisma.kullanici.findFirst({ where: { telefon: formattedPhone } });
      if (existingByPhone) {
        return res.status(400).json({ message: 'Bu telefon numarası zaten kayıtlı. Giriş yapın.' });
      }
    } else if (emailFromSupabase) {
      userEmail = emailFromSupabase.trim();
      const existingByEmail = await prisma.kullanici.findFirst({ where: { email: userEmail } });
      if (existingByEmail) {
        return res.status(400).json({ message: 'Bu e-posta adresi zaten kayıtlı. Giriş yapın.' });
      }
      formattedPhone = '-'; // E-posta ile kayıtta telefon zorunlu alan için placeholder
    } else {
      return res.status(400).json({ message: 'E-posta veya telefon bilgisi bulunamadı' });
    }

    let tesisKodu;
    let unique = false;
    while (!unique) {
      tesisKodu = `MYKBS-${Math.floor(100000 + Math.random() * 900000)}`;
      const ex = await prisma.tesis.findUnique({ where: { tesisKodu } });
      if (!ex) unique = true;
    }

    const tesisEmail = (email && email.trim()) || userEmail || (formattedPhone !== '-' ? `${formattedPhone.replace(/\D/g, '')}@mykbs.com` : 'kayit@mykbs.com');

    const tesis = await prisma.tesis.create({
      data: {
        ...setTrialDefaults(),
        tesisAdi: (tesisAdi && tesisAdi.trim()) || adSoyad.trim() + ' Tesis',
        yetkiliAdSoyad: adSoyad.trim(),
        telefon: formattedPhone,
        email: tesisEmail,
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
        email: userEmail || null,
        sifre: hashedSifre,
        rol: 'sahip',
        checkInYetki: true,
        odaDegistirmeYetki: true,
        bilgiDuzenlemeYetki: true,
        girisOnaylandi: true,
      },
    });

    await ensureSupabaseBranchAndProfile(supabaseUser.id, kullanici, tesis);
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(supabaseUser.id, { password: sifre });
    if (updateErr) console.warn('[auth/kayit/supabase-create] Supabase şifre güncellemesi atlandı:', updateErr?.message);

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
 * Misafir hesabı oluştur (cihaz başına bir kez; mobil bu bilgileri saklayıp aynı hesapla giriş yapar).
 * E-posta formatı: misafir01_abc12xyz@mykbs.guest — admin kaçıncı hesap olduğunu (01, 02, 03...) görür.
 * Auth gerekmez.
 */
const crypto = require('crypto');
const GUEST_EMAIL_DOMAIN = 'mykbs.guest';

function randomAlphanumeric(len) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

router.post('/guest/create', async (req, res) => {
  const { errorResponse: errRes } = require('../lib/errorResponse');
  if (!supabaseAdmin) {
    return errRes(req, res, 503, 'SERVICE_UNAVAILABLE', 'Supabase yapılandırılmamış.');
  }
  try {
    let nextN = 1;
    try {
      const { count, error: countErr } = await supabaseAdmin.from('guest_emails').select('*', { count: 'exact', head: true });
      if (!countErr && count != null) nextN = count + 1;
    } catch (_) {
      // Tablo yoksa veya hata varsa 1 kullan
    }
    const nStr = String(nextN).padStart(2, '0');
    const randomPart = randomAlphanumeric(8);
    const email = `misafir${nStr}_${randomPart}@${GUEST_EMAIL_DOMAIN}`;
    const password = crypto.randomBytes(16).toString('hex');

    const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !createdUser?.user?.id) {
      console.error('[auth/guest/create] createUser failed:', createErr?.message || createErr);
      return errRes(req, res, 500, 'UNHANDLED_ERROR', createErr?.message || 'Misafir hesabı oluşturulamadı.');
    }
    const userId = createdUser.user.id;

    let orgId = null;
    const { data: orgs } = await supabaseAdmin.from('organizations').select('id').ilike('name', 'Misafir%').limit(1);
    if (orgs && orgs[0]) orgId = orgs[0].id;
    if (!orgId) {
      const { data: newOrg, error: orgErr } = await supabaseAdmin.from('organizations').insert({ name: 'Misafir Organizasyonu' }).select('id').single();
      if (orgErr) throw orgErr;
      orgId = newOrg?.id;
    }
    if (!orgId) throw new Error('Org not created');
    const { data: newBranch, error: branchErr } = await supabaseAdmin.from('branches').insert({ organization_id: orgId, name: 'Misafir Hesap' }).select('id, name').single();
    if (branchErr || !newBranch) throw branchErr || new Error('Branch not created');
    const { error: profileErr } = await supabaseAdmin.from('user_profiles').insert({
      user_id: userId,
      branch_id: newBranch.id,
      role: 'staff',
      display_name: `Misafir ${nStr}`,
    });
    if (profileErr) {
      console.error('[auth/guest/create] user_profiles insert failed:', profileErr.message);
    }
    await supabaseAdmin.from('guest_emails').insert({ email }).then(() => {}).catch((e) => {
      if (e?.code !== '42P01') console.warn('[auth/guest/create] guest_emails insert failed (table may be missing):', e?.message);
    });

    return res.status(201).json({ email, password });
  } catch (e) {
    console.error('[auth/guest/create]', e?.message || e);
    return errRes(req, res, 500, 'UNHANDLED_ERROR', e?.message || 'Misafir hesabı oluşturulamadı.');
  }
});

/**
 * Mevcut kullanıcı bilgilerini getir (Supabase token veya backend JWT).
 * role: 'user' | 'admin' — mobil Admin sekmesi görünürlüğü için.
 */
router.get('/me', authenticateTesisOrSupabase, async (req, res) => {
  const { errorResponse: errRes } = require('../lib/errorResponse');
  try {
    if (!req.authSource || (req.authSource !== 'supabase' && req.authSource !== 'prisma' && req.authSource !== 'bypass')) {
      return errRes(req, res, 401, 'INVALID_TOKEN', 'Oturum bilgisi geçersiz. Lütfen tekrar giriş yapın.');
    }
    if (req.authSource === 'supabase') {
      if (!supabaseAdmin) {
        return errRes(req, res, 503, 'SERVICE_UNAVAILABLE', 'Supabase yapılandırılmamış. Lütfen yöneticiye bildirin.');
      }
      const u = req.user;
      const b = req.branch;
      if (!u || !u.id) {
        return errRes(req, res, 409, 'BRANCH_LOAD_FAILED', 'Kullanıcı veya şube bilgisi yüklenemedi. Lütfen tekrar giriş yapın.');
      }
      if (!b || typeof b !== 'object') {
        return errRes(req, res, 409, 'BRANCH_LOAD_FAILED', 'Şube bilgisi yüklenemedi. Lütfen tekrar giriş yapın.');
      }
      const bId = b.id != null ? b.id : null;
      const bName = b.name != null ? b.name : null;
      if (bId == null && bName == null) {
        return errRes(req, res, 409, 'BRANCH_LOAD_FAILED', 'Şube bilgisi yüklenemedi. Lütfen tekrar giriş yapın.');
      }
      const profileRole = req.profileRole || 'staff';
      let is_admin = false;
      let role = 'user';
      let privacyPolicyAcceptedAt = null;
      let termsOfServiceAcceptedAt = null;
      let deletionRequestedAt = null;
      let userProfileRow = null;
      if (supabaseAdmin) {
        let profileRow = null;
        try {
          const profileRes = await supabaseAdmin.from('profiles').select('is_admin, privacy_policy_accepted_at, terms_of_service_accepted_at, deletion_requested_at').eq('id', u.id).maybeSingle();
          profileRow = profileRes.data;
          if (profileRes.error && (profileRes.error.code === '42703' || String(profileRes.error.message || '').includes('42703'))) {
            const fallback = await supabaseAdmin.from('profiles').select('is_admin, privacy_policy_accepted_at, terms_of_service_accepted_at').eq('id', u.id).maybeSingle();
            profileRow = fallback.data;
          }
        } catch (profErr) {
          console.warn('[auth/me] profiles query failed:', profErr?.message || profErr);
        }
        is_admin = profileRow?.is_admin === true;
        privacyPolicyAcceptedAt = profileRow?.privacy_policy_accepted_at ?? null;
        termsOfServiceAcceptedAt = profileRow?.terms_of_service_accepted_at ?? null;
        deletionRequestedAt = profileRow?.deletion_requested_at ?? null;
        try {
          const { data: appRole } = await supabaseAdmin.from('app_roles').select('role').eq('user_id', u.id).maybeSingle();
          if (appRole?.role === 'admin') role = 'admin';
          else if (is_admin) role = 'admin';
        } catch (appRoleErr) {
          console.warn('[auth/me] app_roles query failed:', appRoleErr?.message || appRoleErr);
        }
        const branchId = req.branchId ?? bId;
        if (branchId) {
          try {
            const { data: upRow } = await supabaseAdmin.from('user_profiles').select('display_name, title, avatar_url').eq('user_id', u.id).eq('branch_id', branchId).maybeSingle();
            userProfileRow = upRow;
          } catch (upErr) {
            console.warn('[auth/me] user_profiles query failed:', upErr?.message || upErr);
          }
        }
      }
      const adSoyadFallback = (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.ad_soyad)) || u.email || u.phone || 'Kullanıcı';
      const tesisId = bId != null ? String(bId) : 'unknown';
      const tesisAdi = (bName != null ? String(bName) : null) || 'Tesis';
      return res.json({
        kullanici: {
          id: u.id,
          uid: u.id,
          adSoyad: (userProfileRow?.display_name && String(userProfileRow.display_name).trim()) || adSoyadFallback,
          display_name: (userProfileRow?.display_name && String(userProfileRow.display_name).trim()) || null,
          title: (userProfileRow?.title && String(userProfileRow.title).trim()) || null,
          avatar_url: (userProfileRow?.avatar_url && String(userProfileRow.avatar_url).trim()) || null,
          telefon: u.phone ?? null,
          email: u.email ?? null,
          rol: profileRole,
          biyometriAktif: false,
          is_admin,
          role,
          yetkiler: { checkIn: true, odaDegistirme: true, bilgiDuzenleme: true }
        },
        tesis: {
          id: tesisId,
          tesisAdi,
          tesisKodu: tesisId,
          paket: 'standart',
          kota: 1000,
          kullanilanKota: 0,
          kbsTuru: (b && b.kbs_turu != null ? b.kbs_turu : null) ?? null
        },
        privacyPolicyAcceptedAt: privacyPolicyAcceptedAt || undefined,
        termsOfServiceAcceptedAt: termsOfServiceAcceptedAt || undefined,
        accountPendingDeletion: deletionRequestedAt ? true : undefined,
        deletionRequestedAt: deletionRequestedAt || undefined,
        deletionAt: (() => {
          if (!deletionRequestedAt) return undefined;
          try {
            const ts = new Date(deletionRequestedAt).getTime();
            if (!Number.isFinite(ts)) return undefined;
            return new Date(ts + 7 * 24 * 60 * 60 * 1000).toISOString();
          } catch (_) { return undefined; }
        })(),
        isGuest: !!(u.is_anonymous === true && !(u.email_confirmed_at === true)) || !!(u.email && String(u.email).toLowerCase().endsWith('@mykbs.guest'))
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
    if (!kullanici) {
      return errRes(req, res, 404, 'NOT_FOUND', 'Kullanıcı bilgisi bulunamadı.');
    }

    let role = 'user';
    // Kullanici.id CUID (string); ADMIN_KULLANICI_ID .env'de bu CUID veya eski sayısal id olabilir
    const adminKullaniciIdRaw = process.env.ADMIN_KULLANICI_ID != null ? String(process.env.ADMIN_KULLANICI_ID).trim() : '';
    if (adminKullaniciIdRaw && adminKullaniciIdRaw === String(kullanici.id)) role = 'admin';
    else if (supabaseAdmin) {
      const { data: appRole } = await supabaseAdmin.from('app_roles').select('role').eq('backend_kullanici_id', kullanici.id).maybeSingle();
      if (appRole?.role === 'admin') role = 'admin';
    }

    const deletionRequestedAt = kullanici.deletion_requested_at ? kullanici.deletion_requested_at.toISOString() : null;
    const deletionAt = deletionRequestedAt ? new Date(new Date(deletionRequestedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;

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
        },
        display_name: kullanici.displayName ?? kullanici.adSoyad,
        title: kullanici.title ?? null,
        avatar_url: kullanici.avatarUrl ?? null
      },
      tesis: kullanici.tesis,
      privacyPolicyAcceptedAt: true,
      termsOfServiceAcceptedAt: true,
      accountPendingDeletion: deletionRequestedAt ? true : undefined,
      deletionRequestedAt: deletionRequestedAt || undefined,
      deletionAt: deletionAt || undefined
    });
  } catch (error) {
    const requestId = req.requestId || '-';
    const msg = error?.message || '';
    const code = error?.code || error?.meta?.code;
    const errName = error?.name || '';
    console.error(
      `[auth/me] GET /api/auth/me hatası:`,
      'message:', msg,
      'name:', errName,
      'code:', code,
      'authSource:', req.authSource,
      'stack:', error?.stack || ''
    );
    const { errorResponse: errRes } = require('../lib/errorResponse');
    const isP2025 = code === 'P2025' || (error?.meta?.code === 'P2025');
    const isDb = /prisma|ECONNREFUSED|08P01|connect|relation|column|42703|P1001|Can't reach database|connection refused|ENOTFOUND|ETIMEDOUT|getaddrinfo/i.test(msg) || code === 'P1001';
    const isRefError = /Cannot access .* before initialization|ReferenceError/i.test(msg);
    const isSupabaseAuth = /invalid jwt|jwt expired|getUser|session/i.test(msg);
    if (isP2025 || /Cannot read propert|kullanici\.|findUnique.*null/i.test(msg)) {
      return errRes(req, res, 404, 'NOT_FOUND', 'Kullanıcı bilgisi bulunamadı.');
    }
    if (isDb) {
      return errRes(req, res, 500, 'DB_CONNECT_ERROR', 'Veritabanı geçici olarak kullanılamıyor. Lütfen tekrar deneyin.');
    }
    if (isSupabaseAuth) {
      return errRes(req, res, 401, 'TOKEN_EXPIRED', 'Oturum süresi doldu veya geçersiz. Lütfen tekrar giriş yapın.');
    }
    if (isRefError) {
      return errRes(req, res, 500, 'SERVER_ERROR', 'Sunucu güncellemesi gerekli. Lütfen kısa süre sonra tekrar deneyin.');
    }
    // In development/staging surface the real message for debugging; production keeps generic message
    const safeMessage = process.env.NODE_ENV === 'production'
      ? 'Bilgi alınamadı.'
      : (msg || 'Bilgi alınamadı.');
    return errRes(req, res, 500, 'UNHANDLED_ERROR', safeMessage);
  }
});

/**
 * Gizlilik politikası onayı. Sadece Supabase kullanıcıları; onay sonrası lobide bir daha gösterilmez.
 */
router.post('/privacy-accept', authenticateTesisOrSupabase, async (req, res) => {
  const { errorResponse: errRes } = require('../lib/errorResponse');
  try {
    if (req.authSource !== 'supabase' || !req.user?.id) {
      return res.json({ ok: true, privacyPolicyAcceptedAt: new Date().toISOString() });
    }
    if (!supabaseAdmin) {
      return errRes(req, res, 503, 'SERVICE_UNAVAILABLE', 'Servis şu an kullanılamıyor.');
    }
    const userId = req.user.id;
    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ privacy_policy_accepted_at: now, updated_at: now })
      .eq('id', userId)
      .select('id');
    if (!updateErr && updated && updated.length > 0) {
      return res.json({ ok: true, privacyPolicyAcceptedAt: now });
    }
    const { error: insertErr } = await supabaseAdmin
      .from('profiles')
      .insert({ id: userId, is_admin: false, privacy_policy_accepted_at: now, updated_at: now });
    if (insertErr) {
      console.error('[auth] POST /privacy-accept profiles insert error:', insertErr);
      return errRes(req, res, 500, 'UPDATE_FAILED', 'Onay kaydedilemedi.');
    }
    return res.json({ ok: true, privacyPolicyAcceptedAt: now });
  } catch (e) {
    console.error('[auth] POST /privacy-accept error:', e);
    return errRes(req, res, 500, 'UNHANDLED_ERROR', e?.message || 'Bir hata oluştu.');
  }
});

/**
 * Kullanım şartları onayı. Sadece Supabase kullanıcıları; onay sonrası lobide bir daha gösterilmez.
 */
router.post('/terms-accept', authenticateTesisOrSupabase, async (req, res) => {
  const { errorResponse: errRes } = require('../lib/errorResponse');
  try {
    if (req.authSource !== 'supabase' || !req.user?.id) {
      return res.json({ ok: true, termsOfServiceAcceptedAt: new Date().toISOString() });
    }
    if (!supabaseAdmin) {
      return errRes(req, res, 503, 'SERVICE_UNAVAILABLE', 'Servis şu an kullanılamıyor.');
    }
    const userId = req.user.id;
    const now = new Date().toISOString();
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ terms_of_service_accepted_at: now, updated_at: now })
      .eq('id', userId)
      .select('id');
    if (!updateErr && updated && updated.length > 0) {
      return res.json({ ok: true, termsOfServiceAcceptedAt: now });
    }
    const { error: insertErr } = await supabaseAdmin
      .from('profiles')
      .insert({ id: userId, is_admin: false, terms_of_service_accepted_at: now, updated_at: now });
    if (insertErr) {
      console.error('[auth] POST /terms-accept profiles insert error:', insertErr);
      return errRes(req, res, 500, 'UPDATE_FAILED', 'Onay kaydedilemedi.');
    }
    return res.json({ ok: true, termsOfServiceAcceptedAt: now });
  } catch (e) {
    console.error('[auth] POST /terms-accept error:', e);
    return errRes(req, res, 500, 'UNHANDLED_ERROR', e?.message || 'Bir hata oluştu.');
  }
});

const DELETION_GRACE_DAYS = 7;

/**
 * Hesap silme talebi. E-posta/telefon/misafir/tesis farketmez; tüm hesaplar silme talebinde bulunabilir.
 * 7 gün içinde tüm veriler silinir; bu sürede kullanıcı giriş yapıp hesabı geri alabilir.
 */
router.post('/request-account-deletion', authenticateTesisOrSupabase, async (req, res) => {
  const { errorResponse: errRes } = require('../lib/errorResponse');
  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const deletionAt = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const successPayload = { ok: true, deletionRequestedAt: nowIso, deletionAt, message: `${DELETION_GRACE_DAYS} gün içinde hesabınız ve tüm verileriniz kalıcı olarak silinecektir. Bu sürede giriş yaparak hesabı geri alabilirsiniz.` };

    if (req.authSource === 'supabase' && req.user?.id) {
      if (!supabaseAdmin) return errRes(req, res, 503, 'SERVICE_UNAVAILABLE', 'Servis kullanılamıyor.');
      const userId = req.user.id;
      const { error } = await supabaseAdmin.from('profiles').update({ deletion_requested_at: nowIso, updated_at: nowIso }).eq('id', userId);
      if (error) {
        console.error('[auth] request-account-deletion error:', error);
        return errRes(req, res, 500, 'UPDATE_FAILED', 'İşlem yapılamadı.');
      }
      return res.json(successPayload);
    }

    if (req.authSource === 'prisma' && req.user?.id) {
      const userId = req.user.id;
      await prisma.kullanici.update({
        where: { id: userId },
        data: { deletion_requested_at: now, updatedAt: now }
      });
      return res.json(successPayload);
    }

    // Misafir / Supabase token ile gelen ama authSource farklı set edilmişse (eski deploy vb.) yine Supabase profiles dene
    if (req.user?.id && supabaseAdmin) {
      const userId = req.user.id;
      const { error } = await supabaseAdmin.from('profiles').update({ deletion_requested_at: nowIso, updated_at: nowIso }).eq('id', userId);
      if (!error) return res.json(successPayload);
    }

    return errRes(req, res, 400, 'NOT_AUTHENTICATED', 'Oturum bulunamadı. Lütfen tekrar giriş yapıp deneyin.');
  } catch (e) {
    console.error('[auth] request-account-deletion error:', e);
    return require('../lib/errorResponse').errorResponse(req, res, 500, 'UNHANDLED_ERROR', e?.message || 'Bir hata oluştu.');
  }
});

/**
 * Hesap silme talebini iptal et (7 gün içinde). Supabase ve Prisma hesapları için.
 */
router.post('/restore-account', authenticateTesisOrSupabase, async (req, res) => {
  const { errorResponse: errRes } = require('../lib/errorResponse');
  try {
    if (req.authSource === 'supabase' && req.user?.id) {
      if (!supabaseAdmin) return errRes(req, res, 503, 'SERVICE_UNAVAILABLE', 'Servis kullanılamıyor.');
      const userId = req.user.id;
      const { data: profile } = await supabaseAdmin.from('profiles').select('deletion_requested_at').eq('id', userId).maybeSingle();
      if (!profile?.deletion_requested_at) {
        return res.json({ ok: true, restored: false, message: 'Hesap zaten aktif.' });
      }
      const { error } = await supabaseAdmin.from('profiles').update({ deletion_requested_at: null, updated_at: new Date().toISOString() }).eq('id', userId);
      if (error) {
        console.error('[auth] restore-account error:', error);
        return errRes(req, res, 500, 'UPDATE_FAILED', 'İşlem yapılamadı.');
      }
      return res.json({ ok: true, restored: true, message: 'Hesabınız geri alındı.' });
    }

    if (req.authSource === 'prisma' && req.user?.id) {
      const k = await prisma.kullanici.findUnique({ where: { id: req.user.id }, select: { deletion_requested_at: true } });
      if (!k?.deletion_requested_at) {
        return res.json({ ok: true, restored: false, message: 'Hesap zaten aktif.' });
      }
      await prisma.kullanici.update({
        where: { id: req.user.id },
        data: { deletion_requested_at: null, updatedAt: new Date() }
      });
      return res.json({ ok: true, restored: true, message: 'Hesabınız geri alındı.' });
    }

    return errRes(req, res, 400, 'NOT_AUTHENTICATED', 'Oturum bulunamadı.');
  } catch (e) {
    console.error('[auth] restore-account error:', e);
    return require('../lib/errorResponse').errorResponse(req, res, 500, 'UNHANDLED_ERROR', e?.message || 'Bir hata oluştu.');
  }
});

/**
 * Profil güncelle (ad, ünvan, avatar). E-posta, telefon, tesis kodu farketmez; tüm giriş türleri kullanabilir.
 * Supabase token varsa Edge kullanılır; yoksa backend bu endpoint ile günceller.
 * PATCH ve PUT kabul edilir (mobil api.put kullanıyor).
 */
const updateProfile = async (req, res) => {
  const { errorResponse: errRes } = require('../lib/errorResponse');
  try {
    const body = req.body || {};
    const bodyKeys = Object.keys(body);
    console.log('[auth] PATCH/PUT /profile istek geldi:', {
      bodyKeys,
      hasOwnProperty_display_name: body.hasOwnProperty('display_name'),
      hasOwnProperty_title: body.hasOwnProperty('title'),
      authSource: req.authSource,
      userId: req.user?.id,
    });

    // Ad/soyad, ünvan, telefon: key gönderildiyse güncelle
    const display_name = body.hasOwnProperty('display_name')
      ? (typeof body.display_name === 'string' ? body.display_name.trim() || null : null)
      : undefined;
    const title = body.hasOwnProperty('title')
      ? (typeof body.title === 'string' ? body.title.trim() || null : null)
      : undefined;
    let telefon_value = undefined;
    if (body.hasOwnProperty('telefon')) {
      const raw = typeof body.telefon === 'string' ? body.telefon.trim() : '';
      telefon_value = raw.length >= 10 ? normalizePhone(raw) || '-' : (raw === '' ? '-' : undefined);
      if (telefon_value === undefined) telefon_value = '-';
    }
    const avatar_url = typeof body.avatar_url === 'string' ? body.avatar_url.trim() || null : undefined;
    const avatar_base64 = typeof body.avatar_base64 === 'string' ? body.avatar_base64.replace(/^data:image\/[^;]+;base64,/i, '').replace(/\s/g, '') : null;

    console.log('[auth] PATCH /profile ayrıştırılmış (avatar_base64 uzunluk):', {
      display_name_gelen: body.display_name != null ? String(body.display_name).slice(0, 80) : body.display_name,
      display_name_isleme: display_name != null ? String(display_name).slice(0, 80) : display_name,
      title_gelen: body.title != null ? String(body.title).slice(0, 80) : body.title,
      title_isleme: title != null ? String(title).slice(0, 80) : title,
      hasAvatarUrl: !!body.avatar_url,
      avatar_base64_length: avatar_base64 ? avatar_base64.length : 0,
      authSource: req.authSource,
    });

    if (req.authSource === 'supabase') {
      const userId = req.user.id;
      const branchId = req.branchId;
      if (!branchId) return errRes(req, res, 400, 'BRANCH_MISSING', 'Şube bilgisi yok.');
      let finalAvatarUrl = avatar_url;
      if (avatar_base64 && avatar_base64.length > 0) {
        if (!supabaseAdmin) {
          console.warn('[auth] PATCH /profile: Profil resmi kaydedilmedi. Neden: Supabase admin client yok (SUPABASE_SERVICE_ROLE_KEY kontrol edin).');
        } else {
          try {
            const buf = Buffer.from(avatar_base64, 'base64');
            if (buf.length === 0) {
              console.warn('[auth] PATCH /profile: Profil resmi kaydedilmedi. Neden: base64 decode sonrası buffer boş.');
            } else {
              const path = `supabase-${userId}.jpg`;
              const { error: upErr } = await supabaseAdmin.storage.from(BUCKET_AVATARS).upload(path, buf, { contentType: 'image/jpeg', upsert: true });
              if (!upErr) {
                const { data: urlData } = supabaseAdmin.storage.from(BUCKET_AVATARS).getPublicUrl(path);
                finalAvatarUrl = urlData.publicUrl;
              } else {
                console.warn('[auth] PATCH /profile: Profil resmi storage\'a yüklenemedi. Neden:', upErr?.message || upErr);
              }
            }
          } catch (e) {
            console.warn('[auth] PATCH /profile: Profil resmi yükleme hatası:', e?.message);
          }
        }
      }
      const updates = {};
      if (display_name !== undefined) updates.display_name = display_name;
      if (title !== undefined) updates.title = title;
      if (finalAvatarUrl !== undefined) updates.avatar_url = finalAvatarUrl;
      if (Object.keys(updates).length === 0) {
        console.log('[auth] PATCH /profile: güncellenecek alan yok (updates boş) — display_name/title/avatar_url hiçbiri gönderilmemiş veya aynı kaldı');
        return res.json({ success: true });
      }
      console.log('[auth] PATCH /profile supabase update (değerler):', {
        userId,
        branchId,
        updateKeys: Object.keys(updates),
        display_name: updates.display_name != null ? String(updates.display_name).slice(0, 60) : updates.display_name,
        title: updates.title != null ? String(updates.title).slice(0, 60) : updates.title,
        avatar_url: updates.avatar_url ? '(dolu)' : updates.avatar_url,
      });
      const { data: updateData, error } = await supabaseAdmin.from('user_profiles').update(updates).eq('user_id', userId).eq('branch_id', branchId).select('user_id, display_name, title, avatar_url');
      if (error) {
        console.error('[auth] PATCH /profile supabase update hatası:', { message: error.message, code: error.code, details: error.details });
        return errRes(req, res, 500, 'UPDATE_FAILED', 'Profil güncellenemedi.');
      }
      const row = Array.isArray(updateData) && updateData.length > 0 ? updateData[0] : null;
      console.log('[auth] PATCH /profile supabase update başarılı:', updateData != null ? { rows: updateData.length, first: updateData[0] } : 'no rows');
      return res.json({
        success: true,
        display_name: row?.display_name ?? null,
        title: row?.title ?? null,
        avatar_url: row?.avatar_url?.trim() || null,
      });
    }

    if (req.authSource === 'prisma') {
      const kullaniciId = req.user.id;
      let finalAvatarUrl = avatar_url;
      if (avatar_base64 && avatar_base64.length > 0) {
        if (!supabaseAdmin) {
          console.warn('[auth] PATCH /profile: Profil resmi kaydedilmedi (legacy). Neden: Supabase admin client yok.');
        } else {
          try {
            const buf = Buffer.from(avatar_base64, 'base64');
            if (buf.length === 0) {
              console.warn('[auth] PATCH /profile: Profil resmi kaydedilmedi (legacy). Neden: base64 decode sonrası buffer boş.');
            } else {
              const path = `legacy-${kullaniciId}.jpg`;
              const { error: upErr } = await supabaseAdmin.storage.from(BUCKET_AVATARS).upload(path, buf, { contentType: 'image/jpeg', upsert: true });
              if (!upErr) {
                const { data: urlData } = supabaseAdmin.storage.from(BUCKET_AVATARS).getPublicUrl(path);
                finalAvatarUrl = urlData.publicUrl;
              } else {
                console.warn('[auth] PATCH /profile: Profil resmi storage\'a yüklenemedi (legacy). Neden:', upErr?.message || upErr);
              }
            }
          } catch (e) {
            console.warn('[auth] PATCH /profile: Profil resmi yükleme hatası (legacy):', e?.message);
          }
        }
      }
      const updates = {};
      if (display_name !== undefined) updates.displayName = display_name;
      if (title !== undefined) updates.title = title;
      if (telefon_value !== undefined) updates.telefon = telefon_value;
      if (finalAvatarUrl !== undefined) updates.avatarUrl = finalAvatarUrl;
      if (Object.keys(updates).length === 0) {
        console.log('[auth] PATCH /profile (prisma): güncellenecek alan yok — display_name/title/telefon/avatarUrl hiçbiri gönderilmemiş veya aynı kaldı');
        return res.json({ success: true });
      }
      console.log('[auth] PATCH /profile prisma update (değerler):', {
        kullaniciId,
        updateKeys: Object.keys(updates),
        displayName: updates.displayName != null ? String(updates.displayName).slice(0, 60) : updates.displayName,
        title: updates.title != null ? String(updates.title).slice(0, 60) : updates.title,
        hasTelefon: updates.telefon != null,
        avatarUrl: updates.avatarUrl ? '(dolu)' : updates.avatarUrl,
      });
      const updated = await prisma.kullanici.update({ where: { id: kullaniciId }, data: updates, select: { id: true, displayName: true, title: true, avatarUrl: true, telefon: true } });
      console.log('[auth] PATCH /profile prisma update başarılı:', { id: updated.id, displayName: updated.displayName, title: updated.title, hasAvatarUrl: !!updated.avatarUrl });
      return res.json({
        success: true,
        display_name: updated.displayName ?? null,
        title: updated.title ?? null,
        avatar_url: updated.avatarUrl?.trim() || null,
      });
    }

    console.warn('[auth] PATCH /profile: authSource ne supabase ne prisma:', req.authSource);
    return errRes(req, res, 400, 'AUTH_SOURCE', 'Profil güncellemesi desteklenmiyor.');
  } catch (e) {
    console.error('[auth] PATCH /profile hata (detay):', {
      message: e?.message,
      code: e?.code,
      stack: e?.stack?.slice(0, 300),
    });
    return errRes(req, res, 500, 'UNHANDLED_ERROR', e?.message || 'Profil güncellenemedi.');
  }
};
router.patch('/profile', authenticateTesisOrSupabase, updateProfile);
router.put('/profile', authenticateTesisOrSupabase, updateProfile);

/**
 * Profil bilgisi getir (backend JWT ile; Supabase token yokken profil ekranı bunu kullanır).
 */
router.get('/profile', authenticateTesisOrSupabase, async (req, res) => {
  const { errorResponse: errRes } = require('../lib/errorResponse');
  try {
    if (req.authSource === 'supabase') {
      const userId = req.user.id;
      const branchId = req.branchId;
      if (!branchId || !supabaseAdmin) return errRes(req, res, 400, 'BRANCH_MISSING', 'Şube bilgisi yok.');
      const { data: row, error } = await supabaseAdmin.from('user_profiles').select('display_name, title, avatar_url').eq('user_id', userId).eq('branch_id', branchId).maybeSingle();
      if (error) {
        console.error('[auth] GET /profile supabase select hatası:', { userId, branchId, message: error.message });
        return errRes(req, res, 500, 'DB_ERROR', 'Profil okunamadı.');
      }
      const payload = { display_name: row?.display_name ?? null, title: row?.title ?? null, avatar_url: row?.avatar_url ?? null };
      console.log('[auth] GET /profile supabase yanıt:', { userId, ...payload });
      return res.json(payload);
    }
    if (req.authSource === 'prisma') {
      const k = await prisma.kullanici.findUnique({ where: { id: req.user.id }, select: { displayName: true, title: true, avatarUrl: true, adSoyad: true, telefon: true } });
      if (!k) return errRes(req, res, 404, 'NOT_FOUND', 'Kullanıcı bulunamadı.');
      const payload = {
        display_name: k.displayName ?? k.adSoyad,
        title: k.title ?? null,
        avatar_url: k.avatarUrl ?? null,
        telefon: (k.telefon && k.telefon !== '-') ? k.telefon : null
      };
      console.log('[auth] GET /profile prisma yanıt:', { kullaniciId: req.user.id, ...payload });
      return res.json(payload);
    }
    return errRes(req, res, 400, 'AUTH_SOURCE', 'Profil okunamıyor.');
  } catch (e) {
    console.error('[auth] GET /profile', e);
    return errRes(req, res, 500, 'UNHANDLED_ERROR', e?.message || 'Profil okunamadı.');
  }
});

module.exports = router;

