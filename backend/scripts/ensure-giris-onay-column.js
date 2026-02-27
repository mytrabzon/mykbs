/**
 * Production DB'de girisOnaylandi / girisTalepAt sütunları yoksa ekler.
 * Kullanım (backend klasöründeyken):
 *   node scripts/ensure-giris-onay-column.js
 * Production DB ile (PowerShell):
 *   $env:DATABASE_URL="postgresql://user:pass@host:5432/db"; node scripts/ensure-giris-onay-column.js
 * Production DB ile (cmd):
 *   set DATABASE_URL=postgresql://user:pass@host:5432/db && node scripts/ensure-giris-onay-column.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function ignoreExists(e) {
  const msg = (e && e.message) || String(e);
  return msg.includes('duplicate column') || msg.includes('already exists') || msg.includes('SQLITE_ERROR');
}

async function main() {
  const url = process.env.DATABASE_URL || '';
  const isSqlite = url.includes('file:') || url === '';
  try {
    if (isSqlite) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE Kullanici ADD COLUMN girisOnaylandi BOOLEAN NOT NULL DEFAULT 0;`);
      } catch (e) {
        if (!ignoreExists(e)) throw e;
      }
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE Kullanici ADD COLUMN girisTalepAt DATETIME;`);
      } catch (e) {
        if (!ignoreExists(e)) throw e;
      }
      console.log('SQLite: girisOnaylandi ve girisTalepAt kontrol edildi.');
    } else {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "girisOnaylandi" BOOLEAN NOT NULL DEFAULT false;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "girisTalepAt" TIMESTAMP(3);`);
      try {
        await prisma.$executeRawUnsafe(`UPDATE "Kullanici" SET "girisOnaylandi" = true WHERE "girisOnaylandi" = false;`);
      } catch (_) {}
      console.log('PostgreSQL: girisOnaylandi ve girisTalepAt kontrol edildi.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
