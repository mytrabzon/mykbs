-- AlterTable: IAP ile alınan siparişlerde çift tanımlamayı önlemek için tekil transaction id
ALTER TABLE "Siparis" ADD COLUMN "iap_transaction_id" TEXT;

CREATE UNIQUE INDEX "Siparis_iap_transaction_id_key" ON "Siparis"("iap_transaction_id") WHERE "iap_transaction_id" IS NOT NULL;
