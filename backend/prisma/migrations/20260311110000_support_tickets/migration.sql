-- CreateTable: Destek talepleri (mobil menüden gönderilir, admin panelde listelenir)
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "tesisId" TEXT,
    "author_name" TEXT NOT NULL,
    "author_email" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'acik',
    "admin_note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_tickets_tesisId_idx" ON "support_tickets"("tesisId");
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");
CREATE INDEX "support_tickets_createdAt_idx" ON "support_tickets"("createdAt");

ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
