/**
 * Tesis/KBS route'ları için çift auth: önce Supabase JWT, olmazsa legacy JWT (Prisma).
 * Mobil (Supabase token) ve eski istemciler (JWT_SECRET token) aynı endpoint'leri kullanabilir.
 * Supabase: req.authSource='supabase', req.user, req.branchId, req.branch.
 * Legacy: req.authSource='prisma', req.user (Prisma kullanici), req.tesis.
 */
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { errorResponse } = require('../lib/errorResponse');

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
    return errorResponse(req, res, 401, 'INVALID_TOKEN', 'Token bulunamadı');
  }

  const isStubToken = typeof token === 'string' && token.startsWith('stub_token');
  if (isStubToken) {
    // Mobil placeholder; Supabase'e gönderme (403 bad_jwt alınır). Direkt legacy JWT dene.
  } else if (supabaseAdmin) {
    try {
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError) {
        const msg = userError.message || '';
        const isExpired = msg.includes('expired') || msg.includes('invalid') || msg.includes('jwt');
        console.warn('[authTesisOrSupabase] Supabase getUser failed:', msg);
        if (isExpired) {
          return errorResponse(req, res, 401, 'TOKEN_EXPIRED', 'Oturum süresi doldu. Lütfen tekrar giriş yapın.');
        }
        // Supabase dışı token (örn. backend JWT) olabilir; legacy JWT denenir
      }
      if (!userError && user) {
        let profileRows, profileError;
        const profileSelect = 'branch_id, role, is_disabled, approval_status';
        const resProfile = await supabaseAdmin
          .from('user_profiles')
          .select(profileSelect)
          .eq('user_id', user.id)
          .limit(1);
        profileRows = resProfile.data;
        profileError = resProfile.error;
        if (profileError && (profileError.code === '42703' || String(profileError.message || '').includes('42703'))) {
          const fallback = await supabaseAdmin.from('user_profiles').select('branch_id, role, is_disabled').eq('user_id', user.id).limit(1);
          profileRows = fallback.data;
          profileError = fallback.error;
          if (Array.isArray(profileRows) && profileRows.length > 0) profileRows[0].approval_status = 'approved';
        }
        const profile = Array.isArray(profileRows) && profileRows.length > 0 ? profileRows[0] : null;
        if (!profileError && profile && profile.branch_id) {
          if (profile.is_disabled) {
            return errorResponse(req, res, 403, 'DISABLED', 'Hesabınız devre dışı bırakıldı.');
          }
          const approvalStatus = profile.approval_status;
          if (approvalStatus && approvalStatus !== 'approved') {
            return errorResponse(req, res, 403, 'APPROVAL_REQUIRED', approvalStatus === 'rejected' ? 'Hesabınız onaylanmadı. Yöneticinize başvurun.' : 'Hesabınız henüz onaylanmadı. Yönetici onayından sonra devam edebilirsiniz.');
          }
          let branch = null;
          let branchError = null;
          const fullSelect = 'id, name, kbs_turu, kbs_tesis_kodu, kbs_web_servis_sifre, kbs_configured, kbs_endpoint_url, kbs_approved, kbs_approved_at';
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
              branch = { ...row, kbs_turu: null, kbs_tesis_kodu: null, kbs_web_servis_sifre: null, kbs_configured: false, kbs_endpoint_url: null, kbs_approved: false, kbs_approved_at: null };
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
        if (profile && (profile.is_disabled || (profile.approval_status && profile.approval_status !== 'approved'))) {
          if (profile.is_disabled) {
            return errorResponse(req, res, 403, 'DISABLED', 'Hesabınız devre dışı bırakıldı.');
          }
          return errorResponse(req, res, 403, 'APPROVAL_REQUIRED', profile.approval_status === 'rejected' ? 'Hesabınız onaylanmadı. Yöneticinize başvurun.' : 'Hesabınız henüz onaylanmadı. Yönetici onayından sonra devam edebilirsiniz.');
        }
        // Şube atanmamış kullanıcı: admin ise ilk şubeyi kullan (anasayfa/tesis/oda çalışsın)
        const noBranch = !profile || !profile?.branch_id;
        if (noBranch) {
          let isAdmin = false;
          const { data: profileRow } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
          if (profileRow?.is_admin === true) isAdmin = true;
          if (!isAdmin) {
            const { data: appRole } = await supabaseAdmin.from('app_roles').select('role').eq('user_id', user.id).maybeSingle();
            if (appRole?.role === 'admin') isAdmin = true;
          }
          if (isAdmin) {
            const fullSelect = 'id, name, kbs_turu, kbs_tesis_kodu, kbs_web_servis_sifre, kbs_configured, kbs_endpoint_url, kbs_approved, kbs_approved_at';
            const branchRes = await supabaseAdmin.from('branches').select(fullSelect).limit(1);
            const firstBranch = Array.isArray(branchRes.data) && branchRes.data.length > 0 ? branchRes.data[0] : null;
            if (firstBranch) {
              req.authSource = 'supabase';
              req.user = user;
              req.branchId = firstBranch.id;
              req.branch = firstBranch;
              req.profileRole = profile?.role || 'admin';
              req.tesis = null;
              console.warn('[authTesisOrSupabase] Admin kullanıcı şube atanmamış; ilk şube kullanılıyor:', user.id, firstBranch.id);
              return next();
            }
          }
        }
        if (!profile && !profileError) {
          console.warn('[authTesisOrSupabase] Supabase user geçerli ama user_profiles kaydı yok:', user.id);
          return errorResponse(req, res, 409, 'BRANCH_NOT_ASSIGNED', 'Hesabınız henüz bir şubeye bağlı değil. Yöneticinize başvurun.');
        }
        if (profile && !profile.branch_id) {
          console.warn('[authTesisOrSupabase] Supabase profile var ama branch_id yok:', user.id);
          return errorResponse(req, res, 409, 'BRANCH_NOT_ASSIGNED', 'Hesabınıza şube atanmamış. Yöneticinize başvurun.');
        }
        if (profile && profile.branch_id && (branchError || !branch)) {
          console.warn('[authTesisOrSupabase] Supabase branch yüklenemedi:', profile.branch_id, branchError?.message);
          return errorResponse(req, res, 409, 'BRANCH_LOAD_FAILED', 'Şube bilgisi yüklenemedi. Yöneticinize başvurun.');
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
    if (kullanici && !kullanici.tesis) {
      console.warn('[authTesisOrSupabase] Legacy JWT: kullanici var ama tesis yok, userId=', kullanici.id);
      return errorResponse(req, res, 409, 'BRANCH_NOT_ASSIGNED', 'Tesis bilgisi bulunamadı. Yöneticinize başvurun.');
    }
  } catch (e) {
    const msg = e?.message || '';
    if (msg.includes('girisOnaylandi') && (msg.includes('does not exist') || msg.includes('no such column'))) {
      console.error('[authTesisOrSupabase] Veritabanı migration eksik. npx prisma migrate deploy çalıştırın.');
      return errorResponse(req, res, 503, 'SCHEMA_ERROR', 'Veritabanı güncellemesi gerekli. Lütfen yöneticiye bildirin.');
    }
    /* legacy auth failed */
  }

  // Sadece local/dev: NODE_ENV !== 'production' + localhost veya x-dev-bypass header
  if (isBypassAllowed(req) && supabaseAdmin) {
    try {
      const branchId = process.env.BYPASS_BRANCH_ID || null;
      const { data: branchRows } = branchId
        ? await supabaseAdmin.from('branches').select('id, name, kbs_turu, kbs_tesis_kodu, kbs_configured, kbs_endpoint_url, kbs_approved, kbs_approved_at').eq('id', branchId).limit(1)
        : await supabaseAdmin.from('branches').select('id, name, kbs_turu, kbs_tesis_kodu, kbs_configured, kbs_endpoint_url, kbs_approved, kbs_approved_at').limit(1);
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

  return errorResponse(req, res, 401, 'INVALID_TOKEN', 'Geçersiz token');
}

module.exports = { authenticateTesisOrSupabase };
