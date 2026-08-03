import { prisma } from "@/lib/prisma";
import { SaleStatus } from "@/generated/prisma/client";
import { formatPLN } from "@/lib/format";
import { resolveFabric } from "@/lib/fabrics";

const DAY = 24 * 60 * 60 * 1000;
const activeSale = {
  status: { notIn: [SaleStatus.CANCELLED, SaleStatus.RESIGNED] },
};

export type TopProduct = { name: string; units: number; amount: number };
export type ShopTop = { clientName: string; clientSlug: string; top: TopProduct[] };

/** TOP produkty per sklep (klient) w oknie N dni. */
export async function getTopProductsByShop(
  days: number,
  perShop = 3,
): Promise<ShopTop[]> {
  const from = new Date(Date.now() - days * DAY);
  const clients = await prisma.client.findMany({
    include: {
      sales: {
        where: { soldAt: { gte: from }, ...activeSale },
        select: { productName: true, quantity: true, amount: true },
      },
    },
  });

  return clients
    .map((c) => {
      const map = new Map<string, TopProduct>();
      for (const s of c.sales) {
        const cur = map.get(s.productName) ?? {
          name: s.productName,
          units: 0,
          amount: 0,
        };
        cur.units += s.quantity;
        cur.amount += s.amount;
        map.set(s.productName, cur);
      }
      const top = [...map.values()]
        .sort((a, b) => b.units - a.units)
        .slice(0, perShop);
      return { clientName: c.name, clientSlug: c.slug, top };
    })
    .filter((s) => s.top.length > 0)
    .sort(
      (a, b) =>
        b.top.reduce((x, t) => x + t.amount, 0) -
        a.top.reduce((x, t) => x + t.amount, 0),
    );
}

// --- Raport pojedynczego klienta w zakresie dat -------------------------

export type ChannelStat = { name: string; units: number; amount: number };
export type ColorStat = { name: string; units: number };

export type ClientReport = {
  client: { name: string; slug: string };
  from: Date;
  to: Date;
  totalAmount: number;
  totalUnits: number;
  orderCount: number;
  bestsellers: TopProduct[];
  channels: ChannelStat[];
  colors: ColorStat[];
};

/** Raport sprzedaży jednego klienta w zakresie [from, to]. */
export async function getClientReport(
  clientSlug: string,
  from: Date,
  to: Date,
): Promise<ClientReport | null> {
  const client = await prisma.client.findUnique({
    where: { slug: clientSlug },
    select: { name: true, slug: true },
  });
  if (!client) return null;

  const sales = await prisma.sale.findMany({
    where: {
      client: { slug: clientSlug },
      soldAt: { gte: from, lte: to },
      ...activeSale,
    },
    select: {
      productName: true,
      variant: true,
      fabric: true,
      quantity: true,
      amount: true,
      marketplace: true,
    },
  });

  const products = new Map<string, TopProduct>();
  const channels = new Map<string, ChannelStat>();
  const colors = new Map<string, ColorStat>();
  let totalAmount = 0;
  let totalUnits = 0;

  for (const s of sales) {
    totalAmount += s.amount;
    totalUnits += s.quantity;

    // kod tkaniny → czytelna nazwa + kolor
    const { display, color } = resolveFabric(s.productName);

    const p = products.get(display) ?? { name: display, units: 0, amount: 0 };
    p.units += s.quantity;
    p.amount += s.amount;
    products.set(display, p);

    const ch = channels.get(s.marketplace) ?? { name: s.marketplace, units: 0, amount: 0 };
    ch.units += s.quantity;
    ch.amount += s.amount;
    channels.set(s.marketplace, ch);

    if (color) {
      const c = colors.get(color) ?? { name: color, units: 0 };
      c.units += s.quantity;
      colors.set(color, c);
    }
  }

  return {
    client,
    from,
    to,
    totalAmount,
    totalUnits,
    orderCount: sales.length,
    bestsellers: [...products.values()].sort((a, b) => b.units - a.units).slice(0, 15),
    channels: [...channels.values()].sort((a, b) => b.amount - a.amount),
    colors: [...colors.values()].sort((a, b) => b.units - a.units),
  };
}

const stripPl = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Krótkie podsumowanie sprzedaży do SMS: hity + trend tygodniowy.
 * Bez polskich znaków (żeby SMS był krótszy/tańszy).
 */
export async function buildSalesSummarySms(days = 30): Promise<string> {
  const now = Date.now();
  const from = new Date(now - days * DAY);
  const sales = await prisma.sale.findMany({
    where: { soldAt: { gte: from }, ...activeSale },
    select: { productName: true, quantity: true, amount: true },
  });

  let total = 0;
  let units = 0;
  const map = new Map<string, { name: string; units: number }>();
  for (const s of sales) {
    total += s.amount;
    units += s.quantity;
    const name = resolveFabric(s.productName).display;
    const e = map.get(name) ?? { name, units: 0 };
    e.units += s.quantity;
    map.set(name, e);
  }
  const top = [...map.values()].sort((a, b) => b.units - a.units).slice(0, 3);

  // trend: ostatni tydzień vs poprzedni
  const [tw, lw] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { amount: true },
      where: { soldAt: { gte: new Date(now - 7 * DAY) }, ...activeSale },
    }),
    prisma.sale.aggregate({
      _sum: { amount: true },
      where: {
        soldAt: { gte: new Date(now - 14 * DAY), lt: new Date(now - 7 * DAY) },
        ...activeSale,
      },
    }),
  ]);
  const twAmt = tw._sum.amount ?? 0;
  const lwAmt = lw._sum.amount ?? 0;
  const delta =
    lwAmt > 0 ? Math.round(((twAmt - lwAmt) / lwAmt) * 100) : twAmt > 0 ? 100 : 0;
  const trend = `Tydzien: ${Math.round(twAmt)} zl (${delta >= 0 ? "+" : ""}${delta}% vs poprz.)`;

  const hits =
    top.map((t) => `${t.name} ${t.units}szt`).join(", ") || "brak sprzedazy";
  const text = `Furnito ${days} dni: ${Math.round(total)} zl, ${units} szt. Hity: ${hits}. ${trend}`;
  return stripPl(text);
}

/** Krótka treść SMS: co się najlepiej sprzedaje na których sklepach. */
export function buildTopProductsSms(shops: ShopTop[], label: string): string {
  if (shops.length === 0) return `Furnito (${label}): brak sprzedaży w tym okresie.`;
  const parts = shops.slice(0, 5).map((s) => {
    const best = s.top[0];
    return `${s.clientName}: ${best.name} (${best.units} szt.)`;
  });
  return `Furnito TOP ${label}: ${parts.join(" · ")}`;
}

/** Rozbudowana treść e-mail. */
export function buildTopProductsEmail(shops: ShopTop[], label: string): string {
  if (shops.length === 0) return `Brak sprzedaży w okresie: ${label}.`;
  const lines = [`TOP produkty — ${label}`, ""];
  for (const s of shops) {
    lines.push(`■ ${s.clientName}`);
    for (const t of s.top) {
      lines.push(`   • ${t.name}: ${t.units} szt. (${formatPLN(t.amount)})`);
    }
  }
  return lines.join("\n");
}
