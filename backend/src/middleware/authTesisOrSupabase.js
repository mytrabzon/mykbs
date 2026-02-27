/**
 * Tesis/KBS route'ları için çift auth: önce Supabase JWT, olmazsa legacy JWT (Prisma).
 * Mobil (Supabase token) ve eski istemciler (JWT_SECRET token) aynı endpoint'leri kullanabilir.
 * Supabase: req.authSource='supabase', req.user, req.branchId, req.branch.
 * Legacy: req.authSource='prisma', req.user (Prisma kullanici), req.tesis.
 */
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { supabaseAdmin } = require('../lib/supabaseAdmin');

const prisma = new PrismaClient();

/** Sadece local/dev: bypass'a izin verilir. NODE_ENV=production veya Railway'de yanlışlıkla true olsa bile devreye girmez. */
function isBypassAllowed(req) {
  if (process.env.DISABLE_JWT_AUTH !== 'true' || process.env.NODE_ENV === 'production') {
    return false;
  }
  const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
  const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const clientIp = (forwarded || ip).toLowerCase();
  const isLocalhost = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1';
  const secret = process.env.DEV_BYPASS_SECRET;
  const hasValidHeader = typeof secret === 'string' && secret.length > 0 && req.get('x-dev-bypass') === secret;
  return isLocalhost || hasValidHeader;
}

async function authenticateTesisOrSupabase(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Token bulunamadı' });
  }

  const isStubToken = typeof token === 'string' && token.startsWith('stub_token');
  if (isStubToken) {
    // Mobil placeholder; Supabase'e gönderme (403 bad_jwt alınır). Direkt legacy JWT dene.
  } else if (supabaseAdmin) {
    try {
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (!userError && user) {
        const { data: profileRows, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .select('branch_id, role')
          .eq('user_id', user.id)
          .limit(1);
        const profile = Array.isArray(profileRows) && profileRows.length > 0 ? profileRows[0] : null;
        if (!profileError && profile && profile.branch_id) {
          let branch = null;
          let branchError = null;
          const fullSelect = 'id, name, kbs_turu, kbs_tesis_kodu, kbs_web_servis_sifre, kbs_configured, kbs_endpoint_url';
          const res = await supabaseAdmin
            .from('branches')
            .select(fullSelect)
            .eq('id', profile.branch_id)
            .limit(1);
          branch = Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;
          branchError = res.error;
          if (branchError && (branchError.code === '42703' || branchError.code === 'PGRST116' || String(branchError.message || '').includes('42703'))) {
            const fallback = await supabaseAdmin
              .from('branches')
              .select('id, name')
              .eq('id', profile.branch_id)
              .limit(1);
            const row = Array.isArray(fallback.data) && fallback.data.length > 0 ? fallback.data[0] : null;
            if (row) {
              branch = { ...row, kbs_turu: null, kbs_tesis_kodu: null, kbs_web_servis_sifre: null, kbs_configured: false, kbs_endpoint_url: null };
              branchError = null;
            }
          }
          if (!branchError && branch) {
            req.authSource = 'supabase';
            req.user = user;
            req.branchId = profile.branch_id;
            req.branch = branch;
            req.profileRole = profile.role || 'staff';
            req.tesis = null;
            return next();
          }
        }
        if (!profile && !profileError) {
          console.warn('[authTesisOrSupabase] Supabase user geçerli ama user_profiles kaydı yok:', user.id);
        }
      }
    } catch (e) {
      console.warn('[authTesisOrSupabase] Supabase auth hatası:', e?.message || e);
    }
  }

  // 2) Legacy JWT (Prisma) — stub_token veya Supabase eşleşmezse
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const kullanici = await prisma.kullanici.findUnique({
      where: { id: decoded.userId },
      include: { tesis: true }
    });
    if (kullanici && kullanici.tesis) {
      req.authSource = 'prisma';
      req.user = kullanici;
      req.tesis = kullanici.tesis;
      req.branch = null;
      req.branchId = null;
      return next();
    }
  } catch (e) {
    const msg = e?.message || '';
    if (msg.includes('girisOnaylandi') && (msg.includes('does not exist') || msg.includes('no such column'))) {
      console.error('[authTesisOrSupabase] Veritabanı migration eksik. npx prisma migrate deploy çalıştırın.');
      return res.status(503).json({
        message: 'Veritabanı güncellemesi gerekli. Lütfen yöneticiye bildirin.',
        code: 'DB_MIGRATION_REQUIRED',
      });
    }
    /* legacy auth failed */
  }

  // Sadece local/dev: NODE_ENV !== 'production' + localhost veya x-dev-bypass header
  if (isBypassAllowed(req) && supabaseAdmin) {
    try {
      const branchId = process.env.BYPASS_BRANCH_ID || null;
      const { data: branchRows } = branchId
        ? await supabaseAdmin.from('branches').select('id, name, kbs_turu, kbs_tesis_kodu, kbs_configured, kbs_endpoint_url').eq('id', branchId).limit(1)
        : await supabaseAdmin.from('branches').select('id, name, kbs_turu, kbs_tesis_kodu, kbs_configured, kbs_endpoint_url').limit(1);
      const branch = Array.isArray(branchRows) && branchRows.length > 0 ? branchRows[0] : null;
      if (branch) {
        const { data: profileRows } = await supabaseAdmin.from('user_profiles').select('user_id, role').eq('branch_id', branch.id).limit(1);
        const profile = Array.isArray(profileRows) && profileRows.length > 0 ? profileRows[0] : null;
        req.authSource = 'bypass';
        req.branchId = branch.id;
        req.branch = branch;
        req.profileRole = (profile && profile.role) || 'staff';
        req.user = profile ? { id: profile.user_id } : { id: 'bypass-user' };
        req.tesis = null;
        console.warn('[authTesisOrSupabase] DISABLE_JWT_AUTH: stub auth (localhost/dev only), branch_id=', branch.id);
        return next();
      }
    } catch (bypassErr) {
      console.warn('[authTesisOrSupabase] Bypass stub yüklenemedi:', bypassErr?.message || bypassErr);
    }
  }

  return res.status(401).json({ message: 'Geçersiz token' });
}

module.exports = { authenticateTesisOrSupabase };
