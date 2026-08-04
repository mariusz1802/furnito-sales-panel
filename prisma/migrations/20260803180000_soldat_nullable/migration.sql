-- soldAt może być NULL (sprzedaż bez daty w arkuszu "dane sprzedażowe")
ALTER TABLE "Sale" ALTER COLUMN "soldAt" DROP NOT NULL;
