/**
 * Tek paylaşılan PrismaClient instance.
 * Her route'ta ayrı new PrismaClient() açmak Session mode'da "max clients reached" hatasına yol açar.
 * Tüm route'lar bu modülü kullanmalı.
 */
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;
const isProduction = process.env.NODE_ENV === 'production';

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient({
    log: isProduction ? [{ level: 'error', emit: 'stdout' }] : undefined,
  });
}

const prisma = globalForPrisma.prisma;

module.exports = { prisma };
