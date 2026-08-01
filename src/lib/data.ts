import { prisma } from "@/lib/prisma";
import { SaleStatus } from "@/generated/prisma/client";
import { computeBalance, type BarterBalance } from "@/lib/barter";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const activeSale = {
  status: { notIn: [SaleStatus.CANCELLED, SaleStatus.RESIGNED] },
};

export type ClientWithBalance = {
  id: string;
  name: string;
  slug: string;
  status: string;
  barterLimit: number | null;
  marketplaces: string[];
  handledBy: string | null;
  sheetUrl: string | null;
  notes: string | null;
  balance: BarterBalance;
  salesCount: number;
  lastSaleAt: Date | null;
};

export async function getClientsWithBalances(): Promise<ClientWithBalance[]> {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      services: { select: { amount: true, status: true } },
      sales: {
        select: { amount: true, quantity: true, status: true, soldAt: true },
      },
    },
  });

  return clients.map((c) => {
    const balance = computeBalance(c.services, c.sales, c.barterLimit, {
      ordersTotalSheet: c.ordersTotalSheet,
      servicesRealizedSheet: c.servicesRealizedSheet,
    });
    const activeSales = c.sales.filter(
      (s) => s.status !== "CANCELLED" && s.status !== "RESIGNED",
    );
    const lastSaleAt = activeSales.reduce<Date | null>(
      (acc, s) => (!acc || s.soldAt > acc ? s.soldAt : acc),
      null,
    );
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      barterLimit: c.barterLimit,
      marketplaces: c.marketplaces ? c.marketplaces.split(",").filter(Boolean) : [],
      handledBy: c.handledBy,
      sheetUrl: c.sheetUrl,
      notes: c.notes,
      balance,
      salesCount: activeSales.length,
      lastSaleAt,
    };
  });
}

export async function getDashboardSummary() {
  const clients = await getClientsWithBalances();
  const now = Date.now();

  const deliveredServicesTotal = clients.reduce(
    (a, c) => a + c.balance.deliveredServices,
    0,
  );
  const soldFurnitureTotal = clients.reduce(
    (a, c) => a + c.balance.soldFurniture,
    0,
  );
  const overdrawn = clients.filter((c) => c.balance.isOverdrawn);
  const activeClients = clients.filter((c) => c.status === "ACTIVE").length;

  const [salesThisWeek, salesLastWeek] = await Promise.all([
    aggregateSalesBetween(new Date(now - WEEK), new Date(now)),
    aggregateSalesBetween(new Date(now - 2 * WEEK), new Date(now - WEEK)),
  ]);

  return {
    totalClients: clients.length,
    activeClients,
    deliveredServicesTotal,
    soldFurnitureTotal,
    availableTotal: deliveredServicesTotal - soldFurnitureTotal,
    overdrawnCount: overdrawn.length,
    overdrawnClients: overdrawn.map((c) => c.name),
    salesThisWeek,
    salesLastWeek,
  };
}

async function aggregateSalesBetween(from: Date, to: Date) {
  const sales = await prisma.sale.findMany({
    where: { soldAt: { gte: from, lt: to }, ...activeSale },
    select: { amount: true, quantity: true },
  });
  return {
    count: sales.length,
    amount: sales.reduce((a, s) => a + s.amount, 0),
    units: sales.reduce((a, s) => a + s.quantity, 0),
  };
}

export type RecentSale = {
  id: string;
  productName: string;
  variant: string | null;
  buyer: string | null;
  amount: number;
  quantity: number;
  marketplace: string;
  status: string;
  soldAt: Date;
  clientName: string;
  clientSlug: string;
};

export async function getRecentSales(limit = 12): Promise<RecentSale[]> {
  const sales = await prisma.sale.findMany({
    orderBy: { soldAt: "desc" },
    take: limit,
    include: { client: { select: { name: true, slug: true } } },
  });
  return sales.map((s) => ({
    id: s.id,
    productName: s.productName,
    variant: s.variant,
    buyer: s.buyer,
    amount: s.amount,
    quantity: s.quantity,
    marketplace: s.marketplace,
    status: s.status,
    soldAt: s.soldAt,
    clientName: s.client.name,
    clientSlug: s.client.slug,
  }));
}

/** Oś czasu sprzedaży: ostatnie N tygodni (kwota + liczba) */
export async function getWeeklyTimeline(weeks = 8) {
  const now = Date.now();
  const from = new Date(now - weeks * WEEK);
  const sales = await prisma.sale.findMany({
    where: { soldAt: { gte: from }, ...activeSale },
    select: { amount: true, quantity: true, soldAt: true },
  });

  const buckets: { label: string; amount: number; count: number; units: number }[] =
    [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = now - (i + 1) * WEEK;
    const end = now - i * WEEK;
    const inWeek = sales.filter(
      (s) => s.soldAt.getTime() >= start && s.soldAt.getTime() < end,
    );
    buckets.push({
      label: `${weeks - i} tydz.`,
      amount: inWeek.reduce((a, s) => a + s.amount, 0),
      count: inWeek.length,
      units: inWeek.reduce((a, s) => a + s.quantity, 0),
    });
  }
  return buckets;
}

/** Co się sprzedaje: ranking modeli (po liczbie i kwocie) w oknie N dni */
export async function getBestsellers(days = 30) {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sales = await prisma.sale.findMany({
    where: { soldAt: { gte: from }, ...activeSale },
    select: { productName: true, amount: true, quantity: true },
  });
  const map = new Map<string, { name: string; units: number; amount: number }>();
  for (const s of sales) {
    const cur = map.get(s.productName) ?? {
      name: s.productName,
      units: 0,
      amount: 0,
    };
    cur.units += s.quantity;
    cur.amount += s.amount;
    map.set(s.productName, cur);
  }
  return [...map.values()].sort((a, b) => b.units - a.units);
}

/** Podział sprzedaży wg koloru / wariantu (uwzględnia zmienne kolorów/tkanin) */
export async function getVariantBreakdown(days = 60) {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sales = await prisma.sale.findMany({
    where: { soldAt: { gte: from }, ...activeSale },
    select: { variant: true, quantity: true, amount: true },
  });
  const map = new Map<string, { name: string; units: number; amount: number }>();
  for (const s of sales) {
    const key = s.variant?.trim() || "Bez wariantu";
    const cur = map.get(key) ?? { name: key, units: 0, amount: 0 };
    cur.units += s.quantity;
    cur.amount += s.amount;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.units - a.units);
}

export async function getMarketplaceSplit(days = 60) {
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sales = await prisma.sale.findMany({
    where: { soldAt: { gte: from }, ...activeSale },
    select: { marketplace: true, quantity: true, amount: true },
  });
  const map = new Map<string, { name: string; units: number; amount: number }>();
  for (const s of sales) {
    const cur = map.get(s.marketplace) ?? {
      name: s.marketplace,
      units: 0,
      amount: 0,
    };
    cur.units += s.quantity;
    cur.amount += s.amount;
    map.set(s.marketplace, cur);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export async function getClientBySlug(slug: string) {
  const client = await prisma.client.findUnique({
    where: { slug },
    include: {
      services: { orderBy: { date: "desc" } },
      sales: { orderBy: { soldAt: "desc" } },
    },
  });
  if (!client) return null;
  const balance = computeBalance(client.services, client.sales, client.barterLimit, {
    ordersTotalSheet: client.ordersTotalSheet,
    servicesRealizedSheet: client.servicesRealizedSheet,
  });
  return { ...client, balance };
}
