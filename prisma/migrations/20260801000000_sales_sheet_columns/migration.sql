-- AlterTable: kolumny arkusza "dane sprzedażowe" (sync dwukierunkowy)
ALTER TABLE "Sale" ADD COLUMN "producer" TEXT;
ALTER TABLE "Sale" ADD COLUMN "barterAmount" REAL;
ALTER TABLE "Sale" ADD COLUMN "transportAmount" REAL;
ALTER TABLE "Sale" ADD COLUMN "cashStatus" TEXT;
ALTER TABLE "Sale" ADD COLUMN "channel" TEXT;
ALTER TABLE "Sale" ADD COLUMN "shippedAt" DATETIME;
ALTER TABLE "Sale" ADD COLUMN "receivedAt" DATETIME;
ALTER TABLE "Sale" ADD COLUMN "sheetRow" INTEGER;
ALTER TABLE "Sale" ADD COLUMN "lastSyncedFromApp" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_sheetRow_key" ON "Sale"("sheetRow");
