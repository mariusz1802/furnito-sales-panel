import { prisma } from "@/lib/prisma";
import { SaleStatus } from "@/generated/prisma/client";
import { FURNITO_REPORT_SLUG } from "@/lib/reportShared";
import { formatPLN } from "@/lib/format";
import { resolveFabric } from "@/lib/fabrics";
import { wooProductReport, type StoreProductReport } from "@/lib/integrations/woocommerce";
import { shoperProductReport } from "@/lib/integrations/shoper";
import { prestashopProductReport } from "@/lib/integrations/prestashop";

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
export type PartnerStat = {
  name: string;
  slug: string | null;
  units: number;
  amount: number;
};

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
  // tylko w raporcie zbiorczym Furnito: podział sprzedaży na partnerów
  byPartner?: PartnerStat[];
};

type SaleLite = {
  productName: string;
  quantity: number;
  amount: number;
  marketplace: string;
};

/** Wspólna agregacja sprzedaży: bestsellery + kanały + kolory (kod tkaniny → kolor). */
function aggregateSales(sales: SaleLite[]) {
  const products = new Map<string, TopProduct>();
  const channels = new Map<string, ChannelStat>();
  const colors = new Map<string, ColorStat>();
  let totalAmount = 0;
  let totalUnits = 0;

  for (const s of sales) {
    totalAmount += s.amount;
    totalUnits += s.quantity;

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
    totalAmount,
    totalUnits,
    orderCount: sales.length,
    bestsellers: [...products.values()].sort((a, b) => b.units - a.units).slice(0, 15),
    channels: [...channels.values()].sort((a, b) => b.amount - a.amount),
    colors: [...colors.values()].sort((a, b) => b.units - a.units),
  };
}

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
    select: { productName: true, quantity: true, amount: true, marketplace: true },
  });

  return { client, from, to, ...aggregateSales(sales) };
}

export { FURNITO_REPORT_SLUG };

/**
 * Raport ZBIORCZY Furnito — cała sprzedaż barterowa (wszyscy partnerzy razem)
 * w zakresie [from, to]: bestsellery, najpopularniejsze kolory, kanały oraz
 * podział na partnerów (kto ile sprzedał). Uwzględnia też sprzedaż nieprzypisaną.
 */
export async function getFurnitoReport(from: Date, to: Date): Promise<ClientReport> {
  const sales = await prisma.sale.findMany({
    where: { soldAt: { gte: from, lte: to }, ...activeSale },
    select: {
      productName: true,
      quantity: true,
      amount: true,
      marketplace: true,
      client: { select: { name: true, slug: true } },
    },
  });

  const partners = new Map<string, PartnerStat>();
  for (const s of sales) {
    const key = s.client?.slug ?? "__nieprzypisane__";
    const name = s.client?.name ?? "Nieprzypisane";
    const p = partners.get(key) ?? { name, slug: s.client?.slug ?? null, units: 0, amount: 0 };
    p.units += s.quantity;
    p.amount += s.amount;
    partners.set(key, p);
  }

  return {
    client: { name: "Furnito — wszyscy partnerzy", slug: FURNITO_REPORT_SLUG },
    from,
    to,
    ...aggregateSales(sales),
    byPartner: [...partners.values()].sort((a, b) => b.amount - a.amount),
  };
}

const stripPl = (s: string) =>
  s
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Krótkie podsumowanie sprzedaży do SMS: hity + trend tygodniowy.
 * Opcjonalnie dla jednego klienta (clientSlug). Bez polskich znaków (tańszy SMS).
 */
export async function buildSalesSummarySms(
  days = 30,
  clientSlug?: string,
): Promise<string> {
  const now = Date.now();
  const from = new Date(now - days * DAY);
  const clientFilter = clientSlug ? { client: { slug: clientSlug } } : {};

  let label = "Furnito";
  if (clientSlug) {
    const c = await prisma.client.findUnique({
      where: { slug: clientSlug },
      select: { name: true },
    });
    if (c) label = c.name;
  }

  const sales = await prisma.sale.findMany({
    where: { soldAt: { gte: from }, ...activeSale, ...clientFilter },
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

  // trend: ostatni tydzień vs poprzedni (ten sam filtr klienta)
  const [tw, lw] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { amount: true },
      where: { soldAt: { gte: new Date(now - 7 * DAY) }, ...activeSale, ...clientFilter },
    }),
    prisma.sale.aggregate({
      _sum: { amount: true },
      where: {
        soldAt: { gte: new Date(now - 14 * DAY), lt: new Date(now - 7 * DAY) },
        ...activeSale,
        ...clientFilter,
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
  const text = `${label} ${days} dni: ${Math.round(total)} zl, ${units} szt. Hity: ${hits}. ${trend}`;
  return stripPl(text);
}

/** Kwota zwięźle do SMS: 12345 → "12.3k zl", 999 → "999 zl". */
const kzl = (n: number): string =>
  n >= 1000
    ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k zl`
    : `${Math.round(n)} zl`;

async function fetchStore(
  conn: { platform: string; baseUrl: string; username: string | null; secret: string },
  from: Date,
  to: Date,
): Promise<StoreProductReport | null> {
  if (conn.platform === "woocommerce")
    return wooProductReport({ baseUrl: conn.baseUrl, username: conn.username, secret: conn.secret }, from, to);
  if (conn.platform === "shoper")
    return shoperProductReport({ baseUrl: conn.baseUrl, secret: conn.secret }, from, to);
  if (conn.platform === "prestashop")
    return prestashopProductReport({ baseUrl: conn.baseUrl, secret: conn.secret }, from, to);
  return null;
}

/**
 * Podsumowanie SMS dla JEDNEGO klienta — schemat 2 ujęć:
 *   SKLEP:   jak sprzedaje sklep klienta (WooCommerce/Shoper/PrestaShop)
 *   FURNITO: co z niego poszło do nas (barter, nasze pozycje sprzedaży)
 */
export async function buildClientSmsSummary(
  clientSlug: string,
  days = 7,
): Promise<string> {
  const now = Date.now();
  const from = new Date(now - days * DAY);
  const to = new Date(now);

  const client = await prisma.client.findUnique({
    where: { slug: clientSlug },
    select: { id: true, name: true },
  });
  if (!client) return "Nie znaleziono klienta.";

  // 1) SKLEP klienta
  const conn = await prisma.storeConnection.findFirst({
    where: { clientId: client.id, active: true },
  });
  let storeBlock = "SKLEP:\n(brak podpiecia)";
  if (conn) {
    try {
      const rep = await fetchStore(conn, from, to);
      if (rep) {
        const top =
          rep.top
            .slice(0, 3)
            .map((p) => `- ${p.name}: ${p.units} szt`)
            .join("\n") || "-";
        storeBlock = `SKLEP: ${kzl(rep.totalRevenue)}, ${rep.totalUnits} szt\n${top}`;
      } else {
        storeBlock = "SKLEP:\n(brak sprzedazy)";
      }
    } catch {
      storeBlock = "SKLEP:\n(blad pobrania)";
    }
  }

  // 2) FURNITO — co wzieliśmy z niego (barter, nasze pozycje)
  const sales = await prisma.sale.findMany({
    where: { clientId: client.id, soldAt: { gte: from }, ...activeSale },
    select: { productName: true, quantity: true, amount: true },
  });
  let bTotal = 0;
  let bUnits = 0;
  const map = new Map<string, { name: string; units: number }>();
  for (const s of sales) {
    bTotal += s.amount;
    bUnits += s.quantity;
    const n = resolveFabric(s.productName).display;
    const e = map.get(n) ?? { name: n, units: 0 };
    e.units += s.quantity;
    map.set(n, e);
  }
  const bTop = [...map.values()].sort((a, b) => b.units - a.units).slice(0, 2);
  const bHits = bTop.map((t) => `- ${t.name}: ${t.units} szt`).join("\n") || "-";
  const barterBlock = `FURNITO (wzielismy): ${kzl(bTotal)}, ${bUnits} szt\n${bHits}`;

  const header = `FURNITO - Raport Meblowy\n${client.name} (${days} dni)`;
  return stripPl(`${header}\n\n${storeBlock}\n\n${barterBlock}`);
}

// per-store timeout, żeby jeden wolny sklep nie zawiesił całej strony
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), ms)),
  ]);
}

export type ClientOverviewRow = {
  name: string;
  slug: string;
  hasStore: boolean;
  storeOk: boolean;
  storeRevenue: number;
  storeUnits: number;
  barterRevenue: number;
  barterUnits: number;
};

/**
 * Przegląd sprzedaży WSZYSTKICH klientów (do wyświetlenia w panelu):
 * per klient — sprzedaż jego sklepu + co z niego wzięliśmy (barter).
 */
export async function getClientsSalesOverview(
  days = 7,
): Promise<ClientOverviewRow[]> {
  const now = Date.now();
  const from = new Date(now - days * DAY);
  const to = new Date(now);

  const clients = await prisma.client.findMany({
    select: { id: true, name: true, slug: true, store: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    clients.map(async (c) => {
      let storeRevenue = 0;
      let storeUnits = 0;
      let storeOk = false;
      const hasStore = !!c.store?.active;
      if (c.store?.active) {
        const rep = await withTimeout(fetchStore(c.store, from, to), 9000);
        if (rep) {
          storeOk = true;
          storeRevenue = rep.totalRevenue;
          storeUnits = rep.totalUnits;
        }
      }
      const b = await prisma.sale.aggregate({
        _sum: { amount: true, quantity: true },
        where: { clientId: c.id, soldAt: { gte: from }, ...activeSale },
      });
      return {
        name: c.name,
        slug: c.slug,
        hasStore,
        storeOk,
        storeRevenue,
        storeUnits,
        barterRevenue: b._sum.amount ?? 0,
        barterUnits: b._sum.quantity ?? 0,
      };
    }),
  );

  return rows.sort(
    (a, b) => b.storeRevenue + b.barterRevenue - (a.storeRevenue + a.barterRevenue),
  );
}

/** Kwota kompaktowo bez "zl": 34400 → "34k", 3600 → "3.6k", 900 → "900". */
const kc = (n: number): string =>
  n >= 1000
    ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`
    : `${Math.round(n)}`;

/** Krótka etykieta klienta (najbardziej wyróżniające słowo). */
const shortClient = (name: string): string => {
  const w = stripPl(name)
    .replace(/[()/]/g, " ")
    .split(/\s+/)
    .filter((x) => x && !/^(meble|mebel|materace|materac|sofa|comfy|szydlowski)$/i.test(x));
  return (w[0] || stripPl(name)).slice(0, 11);
};

/**
 * Podsumowanie SMS O KAŻDYM KLIENCIE — ranking wg sprzedaży sklepu:
 *   "Furnito 7d sklep/barter: Cezar 34k/3.6k, KMK 20k/2k, ..."
 * (sklep = sprzedaż sklepu klienta, barter = co z niego wzięliśmy)
 */
export async function buildAllStoresSmsSummary(days = 7): Promise<string> {
  const now = Date.now();
  const from = new Date(now - days * DAY);
  const to = new Date(now);

  const conns = await prisma.storeConnection.findMany({
    where: { active: true },
    include: { client: { select: { id: true, name: true } } },
  });
  if (conns.length === 0)
    return stripPl(`Furnito ${days}d: brak podpietych sklepow.`);

  const rows = await Promise.all(
    conns.map(async (c) => {
      const [rep, bAgg] = await Promise.all([
        fetchStore(c, from, to).catch(() => null),
        prisma.sale.aggregate({
          _sum: { amount: true },
          where: { clientId: c.clientId, soldAt: { gte: from }, ...activeSale },
        }),
      ]);
      return {
        name: shortClient(c.client.name),
        store: rep ? rep.totalRevenue : 0,
        barter: bAgg._sum.amount ?? 0,
      };
    }),
  );
  rows.sort((a, b) => b.store - a.store);

  const list = rows
    .slice(0, 8)
    .map((r) => `${r.name} ${kc(r.store)}/${kc(r.barter)}`)
    .join(", ");
  const more = rows.length > 8 ? ` +${rows.length - 8} innych` : "";

  return stripPl(
    `FURNITO - Raport Meblowy\nWszyscy (${days} dni), sklep/barter:\n${list}${more}`,
  );
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
