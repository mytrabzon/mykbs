/**
 * Supabase JWT ile doğrulama: Authorization: Bearer <access_token>
 * req.user = auth user, req.branchId = branch_id, req.branch = branch row (KBS ayarları dahil)
 */
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { errorResponse } = require('../lib/errorResponse');

async function authenticateSupabase(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return errorResponse(req, res, 401, 'INVALID_TOKEN', 'Token bulunamadı');
    }

    if (!supabaseAdmin) {
      return errorResponse(req, res, 503, 'UNHANDLED_ERROR', 'Supabase yapılandırılmamış');
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return errorResponse(req, res, 401, 'INVALID_TOKEN', 'Yetkisiz');
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('branch_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (profileError || !profile || !profile.branch_id) {
      return errorResponse(req, res, 409, 'BRANCH_NOT_ASSIGNED', 'Hesabınıza şube atanmamış. Yöneticinize başvurun.');
    }

    let branch = null;
    let branchError = null;
    const branchRes = await supabaseAdmin
      .from('branches')
      .select('id, name, kbs_turu, kbs_tesis_kodu, kbs_web_servis_sifre, kbs_configured, kbs_approved, kbs_approved_at')
      .eq('id', profile.branch_id)
      .single();
    branch = branchRes.data;
    branchError = branchRes.error;
    if (branchError && (branchError.code === '42703' || String(branchError.message || '').includes('42703'))) {
      const fallback = await supabaseAdmin.from('branches').select('id, name, kbs_turu, kbs_tesis_kodu, kbs_web_servis_sifre, kbs_configured').eq('id', profile.branch_id).single();
      if (fallback.data) {
        branch = { ...fallback.data, kbs_approved: false, kbs_approved_at: null };
        branchError = null;
      }
    }
    if (branchError || !branch) {
      return errorResponse(req, res, 409, 'BRANCH_LOAD_FAILED', 'Tesis bilgisi yüklenemedi. Yöneticinize başvurun.');
    }

    req.user = user;
    req.branchId = profile.branch_id;
    req.branch = branch;
    next();
  } catch (err) {
    console.error('[authSupabase]', err);
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Yetkilendirme hatası');
  }
}

module.exports = { authenticateSupabase };
