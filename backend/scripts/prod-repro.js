#!/usr/bin/env node
/**
 * Prod repro script: Backend'e karşı health, auth, tesis, rooms çağrıları.
 * Kullanım:
 *   node scripts/prod-repro.js
 *   BASE_URL=https://mykbs-production.up.railway.app node scripts/prod-repro.js
 *   BASE_URL=http://localhost:8080 node scripts/prod-repro.js
 *
 * Her adımda status + body özeti yazılır. Hata durumunda body tam gösterilir.
 */

const BASE = process.env.BASE_URL || 'https://mykbs-production.up.railway.app';

function log(step, status, bodySummary) {
  const ok = status >= 200 && status < 300 ? '✓' : '✗';
  console.log(`${ok} ${step}: ${status} ${bodySummary}`);
}

async function run() {
  console.log('Base URL:', BASE);
  console.log('---');

  // 1) GET /health
  try {
    const r = await fetch(`${BASE}/health`);
    const data = await r.json().catch(() => ({}));
    log('GET /health', r.status, data.ok === true ? 'ok' : JSON.stringify(data).slice(0, 80));
    if (!r.ok) console.log('  body:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('✗ GET /health: fetch failed', e.message);
  }

  // 2) GET /health/db
  try {
    const r = await fetch(`${BASE}/health/db`);
    const data = await r.json().catch(() => ({}));
    const summary = data.ok === true && data.db === true ? 'ok, db=true' : (data.error?.code || JSON.stringify(data).slice(0, 80));
    log('GET /health/db', r.status, summary);
    if (!r.ok) console.log('  body:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('✗ GET /health/db: fetch failed', e.message);
  }

  // 3) POST signup (test user) — skip if no env; optional
  const signupPhone = process.env.TEST_SIGNUP_PHONE;
  if (signupPhone) {
    try {
      const r = await fetch(`${BASE}/api/auth/kayit/otp-iste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefon: signupPhone }),
      });
      const data = await r.json().catch(() => ({}));
      log('POST /api/auth/kayit/otp-iste', r.status, data.message || (data.error || '').slice(0, 60));
      if (!r.ok) console.log('  body:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('✗ POST kayit/otp-iste: fetch failed', e.message);
    }
  } else {
    console.log('- POST /api/auth/kayit/otp-iste: skip (TEST_SIGNUP_PHONE not set)');
  }

  // 4) POST login — optional, needs TEST_TESIS_KODU + TEST_PIN or Supabase
  const tesisKodu = process.env.TEST_TESIS_KODU;
  const pin = process.env.TEST_PIN;
  let token = null;
  if (tesisKodu && pin) {
    try {
      const r = await fetch(`${BASE}/api/auth/giris`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tesisKodu, pin }),
      });
      const data = await r.json().catch(() => ({}));
      if (data.token) token = data.token;
      log('POST /api/auth/giris', r.status, data.pendingApproval ? 'pendingApproval' : (data.token ? 'token received' : (data.message || '').slice(0, 60)));
      if (!r.ok) console.log('  body:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('✗ POST /api/auth/giris: fetch failed', e.message);
    }
  } else {
    console.log('- POST /api/auth/giris: skip (TEST_TESIS_KODU / TEST_PIN not set)');
  }

  // 5) GET tenant/tesis info (requires auth)
  if (token) {
    try {
      const r = await fetch(`${BASE}/api/tesis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json().catch(() => ({}));
      const summary = data.tesis ? `tesis=${data.tesis.tesisAdi || data.tesis.id}` : (data.code || data.message || '').slice(0, 60);
      log('GET /api/tesis', r.status, summary);
      if (!r.ok) console.log('  body:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('✗ GET /api/tesis: fetch failed', e.message);
    }
  } else {
    try {
      const r = await fetch(`${BASE}/api/tesis`, {});
      const data = await r.json().catch(() => ({}));
      log('GET /api/tesis (no auth)', r.status, (data.code || data.message || '').slice(0, 60));
    } catch (e) {
      console.log('✗ GET /api/tesis: fetch failed', e.message);
    }
  }

  // 6) GET rooms list (requires auth)
  if (token) {
    try {
      const r = await fetch(`${BASE}/api/oda?filtre=tumu`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json().catch(() => ({}));
      const count = data.odalar ? data.odalar.length : 0;
      log('GET /api/oda', r.status, data.odalar ? `odalar.length=${count}` : (data.code || data.message || '').slice(0, 60));
      if (!r.ok) console.log('  body:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('✗ GET /api/oda: fetch failed', e.message);
    }
  } else {
    try {
      const r = await fetch(`${BASE}/api/oda?filtre=tumu`, {});
      const data = await r.json().catch(() => ({}));
      log('GET /api/oda (no auth)', r.status, (data.code || data.message || '').slice(0, 60));
    } catch (e) {
      console.log('✗ GET /api/oda: fetch failed', e.message);
    }
  }

  console.log('---');
  console.log('Done. Set BASE_URL, TEST_TESIS_KODU, TEST_PIN for full auth flow.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
