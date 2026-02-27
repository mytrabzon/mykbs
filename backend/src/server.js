require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Environment variables (fallbacks for development)
process.env.JWT_SECRET = process.env.JWT_SECRET || "mykbs-super-secret-jwt-key-2024-change-this";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "365d";
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: '*', allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving - Upload edilen resimler için
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
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
app.use('/api/nfc', require('./routes/nfc'));
app.use('/api/supabase', require('./routes/supabase'));
app.use('/api/kyc', require('./routes/kyc'));
app.use('/api/app-admin', require('./routes/appAdmin'));
app.use('/api/siparis', require('./routes/siparis'));
app.use('/api/push', require('./routes/push'));
app.use('/api/kbs/credentials', require('./routes/kbsCredentials'));

// KBS backend API (Supabase + outbox) — checkin, checkout, room-change
app.use('/api', require('./routes/api/checkin'));

// Mock KBS (POLIS_KBS_URL boşken otomatik mock; manuel test: POST /mock/kbs)
app.use('/mock', require('./routes/mockKbs'));

// Internal: KBS worker (Railway cron: POST /internal/kbs/worker, header x-worker-secret)
app.use('/internal', require('./routes/internal/kbsWorker'));

// Health check (DB'siz) — mobil önce bunu çağırır
const pkg = require('../package.json');
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'mykbs-backend', ts: new Date().toISOString(), version: pkg.version || '1.0.0' });
});

// DB ping — DATABASE_URL ve bağlantı teşhisi (mobil: /health ok ama /health/db fail → "Veritabanına bağlanamıyor")
app.get('/health/db', async (req, res) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl === 'file:./dev.db') {
    return res.status(500).json({ ok: false, error: { code: 'MISSING_DATABASE_URL', message: 'DATABASE_URL missing' } });
  }
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    return res.json({ ok: true, db: true });
  } catch (err) {
    const code = err.code || err.meta?.code || 'UNKNOWN';
    const message = err.message || String(err);
    return res.status(500).json({ ok: false, error: { code, message } });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
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

app.listen(PORT, HOST, () => {
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

module.exports = app;

