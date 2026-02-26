const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// JWT doğrulama middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Token bulunamadı' });
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

