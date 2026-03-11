-- CreateTable
CREATE TABLE "deleted_accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deleted_accounts_email_idx" ON "deleted_accounts"("email");

-- CreateIndex
CREATE INDEX "deleted_accounts_phone_idx" ON "deleted_accounts"("phone");
