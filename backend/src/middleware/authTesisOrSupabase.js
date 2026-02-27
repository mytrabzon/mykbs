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

async function authenticateTesisOrSupabase(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Token bulunamadı' });
  }

  // 1) Önce Supabase ile dene (mobil OTP/email)
  if (supabaseAdmin) {
    try {
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (!userError && user) {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .select('branch_id, role')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        if (!profileError && profile && profile.branch_id) {
          const { data: branch, error: branchError } = await supabaseAdmin
            .from('branches')
            .select('id, name, kbs_turu, kbs_tesis_kodu, kbs_web_servis_sifre, kbs_configured, kbs_endpoint_url')
            .eq('id', profile.branch_id)
            .single();
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
      }
    } catch (_) { /* Supabase auth failed, try legacy */ }
  }

  // 2) Legacy JWT (Prisma)
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
  } catch (_) { /* legacy auth failed */ }

  return res.status(401).json({ message: 'Geçersiz token' });
}

module.exports = { authenticateTesisOrSupabase };
