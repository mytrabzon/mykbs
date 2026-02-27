/**
 * Deploy to Railway (marvelous-generosity / mykbs-production).
 * Requires: backend/.env içinde RAILWAY_TOKEN (Railway → Proje → Settings → Tokens).
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Önce proje kökü .env, sonra backend/.env (backend öncelikli)
const rootEnv = path.join(__dirname, '..', '..', '.env');
const backendEnv = path.join(__dirname, '..', '.env');
require('dotenv').config({ path: rootEnv });
require('dotenv').config({ path: backendEnv });

const configPath = path.join(__dirname, '..', 'marvelous-generosity.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const serviceId = config.railway?.serviceId;

if (!serviceId) {
  console.error('marvelous-generosity.json içinde railway.serviceId eksik.');
  process.exit(1);
}

const token = process.env.RAILWAY_TOKEN;
if (!token) {
  console.error('');
  console.error('RAILWAY_TOKEN gerekli. Tek seferlik:');
  console.error('  1. Railway Dashboard → mykbs-production projesini aç');
  console.error('  2. Settings → Tokens → Generate Project Token');
  console.error('  3. backend/.env veya proje kökü .env dosyasına ekle: RAILWAY_TOKEN=<token>');
  console.error('');
  process.exit(1);
}

const env = { ...process.env, RAILWAY_TOKEN: token };
const child = spawn('railway', ['up', '--service', serviceId], {
  stdio: 'inherit',
  shell: true,
  env,
  cwd: path.join(__dirname, '..'),
});

child.on('close', (code) => process.exit(code || 0));
child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
