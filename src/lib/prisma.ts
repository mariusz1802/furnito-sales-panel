import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Adapter dobierany po schemacie DATABASE_URL:
 *  - postgres://…  → Postgres (produkcja / Vercel),
 *  - file:… (domyślnie) → SQLite (lokalny development).
 */
function createAdapter() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (/^postgres(ql)?:\/\//i.test(url)) {
    return new PrismaPg({ connectionString: url });
  }
  return new PrismaBetterSqlite3({ url });
}

function createClient() {
  return new PrismaClient({
    adapter: createAdapter(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
