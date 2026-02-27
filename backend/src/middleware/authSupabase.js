/**
 * Supabase JWT ile doğrulama: Authorization: Bearer <access_token>
 * req.user = auth user, req.branchId = branch_id, req.branch = branch row (KBS ayarları dahil)
 */
const { supabaseAdmin } = require('../lib/supabaseAdmin');

async function authenticateSupabase(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Token bulunamadı' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ message: 'Yetkisiz' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('branch_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (profileError || !profile || !profile.branch_id) {
      return res.status(403).json({ message: 'Branch atanmamış' });
    }

    const { data: branch, error: branchError } = await supabaseAdmin
      .from('branches')
      .select('id, name, kbs_turu, kbs_tesis_kodu, kbs_web_servis_sifre, kbs_configured')
      .eq('id', profile.branch_id)
      .single();

    if (branchError || !branch) {
      return res.status(403).json({ message: 'Tesis bulunamadı' });
    }

    req.user = user;
    req.branchId = profile.branch_id;
    req.branch = branch;
    next();
  } catch (err) {
    console.error('[authSupabase]', err);
    return res.status(500).json({ message: 'Yetkilendirme hatası' });
  }
}

module.exports = { authenticateSupabase };
