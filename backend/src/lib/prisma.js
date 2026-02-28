/**
 * Tek paylaşılan PrismaClient instance.
 * Her route'ta ayrı new PrismaClient() açmak Session mode'da "max clients reached" hatasına yol açar.
 * Tüm route'lar bu modülü kullanmalı.
 */
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = globalThis;

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = new PrismaClient();
}

const prisma = globalForPrisma.prisma;

module.exports = { prisma };
