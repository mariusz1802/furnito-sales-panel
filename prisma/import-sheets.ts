import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = /^postgres(ql)?:\/\//i.test(url)
  ? new PrismaPg({ connectionString: url })
  : new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

const DAY = 24 * 60 * 60 * 1000;

type Row = {
  client: string;
  ordersTotal: number | null;
  servicesTotal: number | null;
  difference: number | null;
  services: { name: string; amount: number | null; status?: string; period?: string | null }[];
  sales: {
    productName: string;
    variant?: string | null;
    buyer?: string | null;
    amount: number | null;
    quantity?: number;
    status?: string;
  }[];
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function main() {
  const dir = join(process.cwd(), "prisma", "imported");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  console.log(`📥 Import z arkuszy Google (${files.length} plików)…`);

  for (const file of files) {
    const data = JSON.parse(readFileSync(join(dir, file), "utf8")) as Row;
    let client = await prisma.client.findFirst({ where: { name: data.client } });
    if (!client) {
      client = await prisma.client.create({
        data: { name: data.client, slug: slugify(data.client) },
      });
    }

    // autorytatywne sumy z arkusza (żółte komórki). Cezar: realizowane = 91 394,80
    // (pole servicesTotal w JSON było kontraktowe 265 394,80 — korekta).
    const servicesRealized =
      data.client === "Meble Cezar" ? 91394.8 : data.servicesTotal;
    await prisma.client.update({
      where: { id: client.id },
      data: {
        ordersTotalSheet: data.ordersTotal ?? null,
        servicesRealizedSheet: servicesRealized ?? null,
      },
    });

    // wymiana danych klienta na realne z arkusza
    await prisma.sale.deleteMany({ where: { clientId: client.id } });
    await prisma.service.deleteMany({ where: { clientId: client.id } });

    for (const s of data.services ?? []) {
      await prisma.service.create({
        data: {
          clientId: client.id,
          name: s.name,
          amount: Number(s.amount) || 0,
          status: s.status === "PLANNED" ? "PLANNED" : "DELIVERED",
          period: s.period ?? null,
        },
      });
    }

    // rozłożenie dat sprzedaży w czasie (arkusze nie mają dat) — ~ostatnie pół roku
    const sales = data.sales ?? [];
    const gap = sales.length > 1 ? 170 / sales.length : 0;
    for (const [i, s] of sales.entries()) {
      const status =
        s.status === "CANCELLED"
          ? "CANCELLED"
          : s.status === "RESIGNED"
            ? "RESIGNED"
            : "NEW";
      await prisma.sale.create({
        data: {
          clientId: client.id,
          productName: s.productName,
          variant: s.variant ?? null,
          buyer: s.buyer ?? null,
          amount: Number(s.amount) || 0,
          quantity: Number(s.quantity) || 1,
          marketplace: "OTHER", // z arkusza; realny kanał uzupełni integracja
          status,
          externalId: `SHEET-${client.slug}-${i}`,
          soldAt: new Date(Date.now() - Math.round(i * gap) * DAY),
        },
      });
    }

    console.log(
      `  ✓ ${data.client.padEnd(32)} usługi:${data.services?.length ?? 0} sprzedaż:${sales.length}`,
    );
  }
  console.log("✅ Import zakończony.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
