/**
 * B2B Multi-Tenant: req.tenantId ve req.tenant ayarlar.
 * authenticateTesisOrSupabase sonrasında çağrılmalı (zaten tesis/branch bilgisi var).
 * - Header X-Tenant-ID varsa doğrula ve tenant'ı yükle.
 * - JWT'de tenantId varsa kullan (ileride eklenebilir).
 * - Yoksa mevcut tesis/branch id'yi tenant id olarak kullan (geriye dönük uyumluluk).
 */
const { prisma } = require('../lib/prisma');
const { errorResponse } = require('../lib/errorResponse');

async function tenantMiddleware(req, res, next) {
  try {
    const headerTenantId = req.headers['x-tenant-id'];
    const token = req.headers.authorization?.split(' ')[1];
    let tenantId = null;
    let tenant = null;

    if (token && typeof token === 'string') {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        if (decoded?.tenantId) tenantId = decoded.tenantId;
      } catch (_) {}
    }
    if (headerTenantId) tenantId = headerTenantId.trim();

    if (tenantId) {
      try {
        tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
        });
      } catch (e) {
        // Tenant tablosu henüz yoksa veya Prisma hatası: tenantId'yi header değeri ile bırak
        req.tenantId = tenantId;
        return next();
      }
      if (!tenant) {
        return errorResponse(req, res, 404, 'TENANT_NOT_FOUND', 'Tenant bulunamadı.');
      }
      if (tenant.durum !== 'aktif') {
        return errorResponse(req, res, 403, 'TENANT_INACTIVE', 'Bu müşteri hesabı aktif değil.');
      }
      req.tenantId = tenant.id;
      req.tenant = tenant;
      return next();
    }

    // Geriye dönük uyumluluk: tesis veya branch id'yi tenant id gibi kullan (mevcut auth)
    if (req.tesis?.id) {
      req.tenantId = req.tesis.tenantId || req.tesis.id;
      if (req.tesis.tenantId) {
        try {
          tenant = await prisma.tenant.findUnique({ where: { id: req.tesis.tenantId } });
          if (tenant && tenant.durum === 'aktif') req.tenant = tenant;
        } catch (_) {}
      }
    } else if (req.branchId) {
      req.tenantId = req.branchId;
    }

    next();
  } catch (error) {
    next(error);
  }
}

/** Okutulan belge / OCR gibi route'larda kullanılacak: tenantId döndür (kayıt için). */
function getTenantIdForRecord(req) {
  return req.tenantId || req.tesis?.id || req.branchId || null;
}

module.exports = { tenantMiddleware, getTenantIdForRecord };
