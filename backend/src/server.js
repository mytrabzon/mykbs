require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');

// Environment variables (fallbacks only in development; production requires env vars from platform)
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.JWT_SECRET) {
  console.error('[server] Production ortamında JWT_SECRET zorunludur.');
  console.error('[server] Deploy platformunda ortam değişkeni olarak ekleyin: Railway → Service → Variables → JWT_SECRET (en az 32 karakter). Örnek: openssl rand -base64 32');
  process.exit(1);
}
process.env.JWT_SECRET = process.env.JWT_SECRET || "mykbs-super-secret-jwt-key-2024-change-this";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "365d";
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";

// Supabase pooler (PgBouncer/Supavisor): 08P01 önlemek için pgbouncer=true.
// connection_limit: Session mode sınırına takılmamak için 5–10 arası; tek bağlantı eşzamanlı istekte timeout verir.
// connect_timeout / pool_timeout: Bağlantı ve havuz bekleme süreleri (çökmeyi önler).
// Session mode: pooler.supabase.com:6543
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && dbUrl.startsWith('postgres')) {
  const isPooler = dbUrl.includes('pooler') || /:6543[/?]/.test(dbUrl);
  if (isPooler) {
    let u = dbUrl;
    if (!u.includes('pgbouncer=true')) {
      u = u.includes('?') ? u + '&pgbouncer=true' : u + '?pgbouncer=true';
    }
    if (!/connection_limit=\d+/.test(u)) {
      const raw = process.env.DATABASE_POOL_SIZE;
      const num = raw ? parseInt(String(raw), 10) : (process.env.NODE_ENV === 'production' ? 5 : 3);
      const limit = Math.min(Math.max(Number.isNaN(num) ? 5 : num, 1), 10);
      u = u.includes('?') ? u + '&connection_limit=' + limit : u + '?connection_limit=' + limit;
    }
    if (!/connect_timeout=\d+/.test(u)) {
      u = u.includes('?') ? u + '&connect_timeout=15' : u + '?connect_timeout=15';
    }
    if (!/pool_timeout=\d+/.test(u)) {
      u = u.includes('?') ? u + '&pool_timeout=20' : u + '&pool_timeout=20';
    }
    process.env.DATABASE_URL = u;
  }
}

const app = express();

// Reverse proxy (Railway, Nginx vb.) arkasında rate-limit doğru IP alsın
app.set('trust proxy', 1);

// Request ID middleware (observability)
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// Middleware
app.use(helmet());
const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions = {
  origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()).filter(Boolean) : '*',
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Correlation-Id'],
};
app.use(cors(corsOptions));
// Body parser: OCR / evrensel MRZ base64 için 20mb, diğer API için 2mb
app.use((req, res, next) => {
  const limit =
    req.path.startsWith('/api/ocr') ||
    req.path.startsWith('/api/universal-mrz') ||
    req.path.startsWith('/api/universal-ocr')
      ? '20mb'
      : '2mb';
  express.json({ limit })(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

// Static file serving - Upload edilen resimler için
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting — mobil: odalar/tesis/me/KBS/okutulan-belgeler batch yüklensin diye client tarafı düzeltildi.
// Railway/NAT ile aynı IP’ten çok istek gelirse 429 oluşabilir; RATE_LIMIT_MAX ile artırılabilir.
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 min
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 2000; // IP başına 2000 istek / 15 dk (production için daha yüksek)
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  message: { message: 'Too many requests, please try again later.', rateLimit: true },
  standardHeaders: true, // Retry-After gönderir
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tesis', require('./routes/tesis'));
app.use('/api/oda', require('./routes/oda'));
app.use('/api/misafir', require('./routes/misafir'));
app.use('/api/rapor', require('./routes/rapor'));
app.use('/api/bildirim', require('./routes/bildirim'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/ocr', require('./routes/ocr'));
app.use('/api/scan', require('./routes/scan'));
app.use('/api/nfc', require('./routes/nfc'));
app.use('/api/supabase', require('./routes/supabase'));
app.use('/api/kyc', require('./routes/kyc'));
app.use('/api/universal-mrz', require('./routes/universalMrz'));
app.use('/api/universal-ocr', require('./routes/universalOcr'));
app.use('/api/okutulan-belgeler', require('./routes/okutulanBelgeler'));
app.use('/api/app-admin', require('./routes/appAdmin'));
app.use('/api/siparis', require('./routes/siparis'));
app.use('/api/support', require('./routes/support'));
app.use('/api/push', require('./routes/push'));
app.use('/api/kbs/credentials', require('./routes/kbsCredentials'));

// KBS backend API (Supabase + outbox) — checkin, checkout, room-change
app.use('/api', require('./routes/api/checkin'));

// Mock KBS (POLIS_KBS_URL boşken otomatik mock; manuel test: POST /mock/kbs)
app.use('/mock', require('./routes/mockKbs'));

// Internal: KBS worker + hesap silme purge (cron: x-worker-secret)
app.use('/internal', require('./routes/internal/kbsWorker'));
app.use('/internal', require('./routes/internal/purgeDeletedAccounts'));

// Debug: egress IP (KBS whitelist doğrulama — VPS sabit IP)
app.use('/debug', require('./routes/debug'));

// Health check (DB'siz) — mobil önce bunu çağırır
const pkg = require('../package.json');
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'mykbs-backend', ts: new Date().toISOString(), version: pkg.version || '1.0.0' });
});

// DB ping — DATABASE_URL ve bağlantı teşhisi (mobil: /health ok ama /health/db fail → "Veritabanına bağlanamıyor")
app.get('/health/db', async (req, res) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl === 'file:./dev.db') {
    return res.status(500).json({
      ok: false,
      code: 'MISSING_DATABASE_URL',
      message: 'DATABASE_URL missing or not configured for production',
      ...(req.requestId && { requestId: req.requestId }),
    });
  }
  try {
    const { prisma } = require('./lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ ok: true, db: true });
  } catch (err) {
    const pgCode = err.code || err.meta?.code;
    const requestId = req.requestId || '-';
    return res.status(500).json({
      ok: false,
      code: 'DB_CONNECT_ERROR',
      message: err.message || String(err),
      ...(requestId !== '-' && { requestId }),
      ...(pgCode && { pgCode: String(pgCode) }),
    });
  }
});

// Error handling (requestId + error code logging, standart body)
const { errorResponse: errRes } = require('./lib/errorResponse');
app.use((err, req, res, next) => {
  const requestId = req.requestId || '-';
  const endpoint = req.method && req.path ? `${req.method} ${req.path}` : req.url || '-';
  const userId = req.user?.id ?? req.user?.sub ?? '-';
  const tenantId = req.branchId ?? req.tesis?.id ?? '-';
  const errCode = err.code || err.status || (err.meta?.code ?? 'UNKNOWN');
  console.error(
    `[REQ ${requestId}] ${endpoint} user=${userId} branch=${tenantId} -> code=${errCode} status=${err.status || 500} ${err.message || err}`,
    err.stack
  );
  const status = err.status || 500;
  const code = err.code || (status === 503 ? 'SCHEMA_ERROR' : 'UNHANDLED_ERROR');
  return errRes(req, res, status, code, err.message || 'Internal Server Error', process.env.NODE_ENV === 'development' ? { stack: err.stack } : {});
});

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// KBS outbox worker (Supabase + POLIS/JANDARMA veya mock)
const kbsWorker = require('./worker/kbsOutboxWorker');

// Startup: DATABASE_URL var mı / host+db (şifre loglanmaz)
function logDatabaseUrlStatus() {
  const u = process.env.DATABASE_URL;
  if (!u || u === 'file:./dev.db') {
    console.warn('[Startup] DATABASE_URL: (missing or file) — /health/db 500 döner');
    return;
  }
  try {
    const match = u.match(/@([^/]+)\/([^?]+)/);
    const host = match ? match[1] : '(unknown)';
    const db = match ? match[2] : 'postgres';
    console.log('[Startup] DATABASE_URL: host=' + host + ' db=' + db + ' (set)');
  } catch (_) {
    console.log('[Startup] DATABASE_URL: (set, parse skip)');
  }
}
logDatabaseUrlStatus();

// Graceful shutdown: Railway/PM2 SIGTERM/SIGINT'te bağlantıları temiz kapat (çökme önleme)
const server = app.listen(PORT, HOST, () => {
  // OCR /document-base64 uzun sürebilir; 502 önlemek için istek timeout'unu artır (Railway proxy ile uyumlu)
  const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS) || 120000; // 2 dakika
  server.requestTimeout = requestTimeoutMs;
  server.headersTimeout = Math.max(server.headersTimeout || 0, requestTimeoutMs + 1000);
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Health: GET http://localhost:${PORT}/health  |  DB: GET http://localhost:${PORT}/health/db`);
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (process.env.WORKER_SECRET) {
      console.log('KBS worker: Railway cron kullan (POST /internal/kbs/worker + x-worker-secret)');
    } else {
      kbsWorker.start();
    }
  } else {
    console.warn('SUPABASE_* eksik: KBS worker başlatılmadı.');
  }
});

function shutdown(signal) {
  console.log(`[shutdown] ${signal} alındı, kapatılıyor...`);
  server.close(() => {
    const { prisma } = require('./lib/prisma');
    prisma
      .$disconnect()
      .then(() => {
        console.log('[shutdown] Prisma bağlantısı kapatıldı.');
        process.exit(0);
      })
      .catch((err) => {
        console.error('[shutdown] Prisma disconnect hatası:', err);
        process.exit(1);
      });
  });
  // İstekler 30s içinde bitmezse zorla çık (Railway timeout)
  setTimeout(() => {
    console.error('[shutdown] Zaman aşımı, zorla çıkılıyor.');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;

