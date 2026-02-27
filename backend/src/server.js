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
app.use('/api/bildirim', require('./routes/bildirim'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/ocr', require('./routes/ocr'));
app.use('/api/nfc', require('./routes/nfc'));
app.use('/api/supabase', require('./routes/supabase'));
app.use('/api/kyc', require('./routes/kyc'));
app.use('/api/app-admin', require('./routes/appAdmin'));
app.use('/api/push', require('./routes/push'));
app.use('/api/kbs/credentials', require('./routes/kbsCredentials'));

// KBS backend API (Supabase + outbox) — checkin, checkout, room-change
app.use('/api', require('./routes/api/checkin'));

// Mock KBS (POLIS_KBS_URL boşken otomatik mock; manuel test: POST /mock/kbs)
app.use('/mock', require('./routes/mockKbs'));

// Internal: KBS worker (Railway cron: POST /internal/kbs/worker, header x-worker-secret)
app.use('/internal', require('./routes/internal/kbsWorker'));

// Health check — mobil "Bağlantıyı Test Et" burayı çağıracak
const pkg = require('../package.json');
app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'ok', version: pkg.version || '1.0.0', time: new Date().toISOString() });
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

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Health: GET http://localhost:${PORT}/health`);
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

