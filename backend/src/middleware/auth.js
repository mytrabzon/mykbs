const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/** Sadece local/dev: bypass'a izin verilir. Production'da asla devreye girmez. */
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

// JWT doğrulama middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Token bulunamadı' });
    }

    // Sadece local/dev: NODE_ENV !== 'production' + localhost veya x-dev-bypass header ile stub kullan
    if (isBypassAllowed(req)) {
      const stubUserId = parseInt(process.env.BYPASS_USER_ID || '1', 10);
      const stubTesisId = parseInt(process.env.BYPASS_TESIS_ID || '1', 10);
      req.user = { id: stubUserId, tesis: { id: stubTesisId }, rol: 'sahip' };
      req.tesis = { id: stubTesisId };
      console.warn('[auth] DISABLE_JWT_AUTH: stub user/tesis (localhost/dev only)');
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const kullanici = await prisma.kullanici.findUnique({
      where: { id: decoded.userId },
      include: { tesis: true }
    });

    if (!kullanici) {
      return res.status(401).json({ message: 'Kullanıcı bulunamadı' });
    }

    req.user = kullanici;
    req.tesis = kullanici.tesis;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Geçersiz token' });
  }
};

// Admin yetkisi kontrolü
const requireAdmin = async (req, res, next) => {
  if (!req.user || req.user.rol !== 'admin') {
    return res.status(403).json({ message: 'Admin yetkisi gerekli' });
  }
  next();
};

// Rol bazlı yetki kontrolü
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ message: 'Yetersiz yetki' });
    }
    next();
  };
};

module.exports = {
  authenticate,
  requireAdmin,
  requireRole
};

