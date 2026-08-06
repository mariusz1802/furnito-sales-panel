-- clientId może być NULL (sprzedaż "nieprzypisana" — producent bez dopasowania do klienta)
ALTER TABLE "Sale" ALTER COLUMN "clientId" DROP NOT NULL;
