import { detectColor } from "@/lib/reports";

/**
 * Pobieranie "co się sprzedaje" ze sklepu WooCommerce klienta przez Analytics API
 * (wc-analytics/reports/products). Zwraca AGREGATY produktowe (nazwa, sztuki,
 * przychód) — bez danych osobowych klientów.
 *
 * Autoryzacja: Basic Auth (login + hasło aplikacji / klucz read-only) po HTTPS.
 */

export type StoreConn = {
  baseUrl: string;
  username: string | null;
  secret: string;
};

export type StoreTopProduct = { name: string; units: number; revenue: number };
export type StoreColorStat = { name: string; units: number };

export type StoreProductReport = {
  top: StoreTopProduct[];
  colors: StoreColorStat[];
  totalUnits: number;
  totalRevenue: number;
};

const wcDate = (d: Date) => d.toISOString().slice(0, 19); // "YYYY-MM-DDTHH:MM:SS"

type WcRow = {
  items_sold?: number;
  net_revenue?: number | string;
  extended_info?: { name?: string };
};

/** TOP produkty ze sklepu WooCommerce klienta w zakresie [from, to]. */
export async function wooProductReport(
  conn: StoreConn,
  from: Date,
  to: Date,
  limit = 20,
): Promise<StoreProductReport> {
  const base = conn.baseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/wp-json/wc-analytics/reports/products`);
  url.searchParams.set("after", wcDate(from));
  url.searchParams.set("before", wcDate(to));
  url.searchParams.set("orderby", "items_sold");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(limit));
  url.searchParams.set("extended_info", "true");

  const auth = Buffer.from(`${conn.username ?? ""}:${conn.secret}`).toString("base64");
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    // dane sklepu bywają wolne — nie cache'ujemy, raport ma być na żywo
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`WooCommerce ${res.status}: ${(await res.text()).slice(0, 120)}`);
  }
  const rows = (await res.json()) as WcRow[];
  if (!Array.isArray(rows)) return { top: [], colors: [], totalUnits: 0, totalRevenue: 0 };

  const top: StoreTopProduct[] = [];
  const colors = new Map<string, StoreColorStat>();
  let totalUnits = 0;
  let totalRevenue = 0;

  for (const r of rows) {
    const name = r.extended_info?.name ?? "—";
    const units = Number(r.items_sold) || 0;
    const revenue = Number(r.net_revenue) || 0;
    top.push({ name, units, revenue });
    totalUnits += units;
    totalRevenue += revenue;

    const color = detectColor(name);
    if (color) {
      const c = colors.get(color) ?? { name: color, units: 0 };
      c.units += units;
      colors.set(color, c);
    }
  }

  return {
    top,
    colors: [...colors.values()].sort((a, b) => b.units - a.units),
    totalUnits,
    totalRevenue,
  };
}
