import { resolveFabric } from "@/lib/fabrics";
import type { StoreProductReport, StoreTopProduct, StoreColorStat } from "@/lib/integrations/woocommerce";

/**
 * Pobieranie "co się sprzedaje" ze sklepu PrestaShop (np. KMK, kmk-meble.eu)
 * przez Webservice API.
 *
 * Auth: HTTP Basic — login = klucz Webservice, hasło puste.
 * Klucz: PrestaShop → Zaawansowane → Webservice → włącz + dodaj klucz z
 * uprawnieniami GET na: orders, order_details (ew. products).
 *
 * Zamówienia z display=full zawierają associations.order_rows (nazwa + ilość +
 * cena pozycji), więc agregujemy "co się sprzedaje" jednym przelotem.
 */

export type PrestaConn = { baseUrl: string; secret: string };

const PAGE = 100;
const MAX_PAGES = 20;

const psDate = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");

type OrderRow = {
  product_name?: string;
  product_quantity?: number | string;
  unit_price_tax_incl?: number | string;
};
type Order = {
  associations?: { order_rows?: OrderRow[] };
};

async function fetchOrders(
  base: string,
  key: string,
  from: Date,
  to: Date,
  offset: number,
): Promise<Order[]> {
  const auth = Buffer.from(`${key}:`).toString("base64");
  const filter = encodeURIComponent(`[${psDate(from)},${psDate(to)}]`);
  const url =
    `${base.replace(/\/+$/, "")}/api/orders` +
    `?output_format=JSON&display=full&date=1` +
    `&filter[date_add]=${filter}&limit=${offset},${PAGE}`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PrestaShop ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const data = (await res.json()) as { orders?: Order[] };
  return data.orders ?? [];
}

export async function prestashopProductReport(
  conn: PrestaConn,
  from: Date,
  to: Date,
): Promise<StoreProductReport> {
  const products = new Map<string, StoreTopProduct>();
  const colors = new Map<string, StoreColorStat>();
  let totalUnits = 0;
  let totalRevenue = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const orders = await fetchOrders(conn.baseUrl, conn.secret, from, to, page * PAGE);
    if (orders.length === 0) break;
    for (const o of orders) {
      const rows = o.associations?.order_rows ?? [];
      for (const r of rows) {
        const { display, color } = resolveFabric(String(r.product_name ?? "—"));
        const qty = Number(r.product_quantity) || 0;
        const price = Number(r.unit_price_tax_incl) || 0;
        const revenue = price * qty;
        const p = products.get(display) ?? { name: display, units: 0, revenue: 0 };
        p.units += qty;
        p.revenue += revenue;
        products.set(display, p);
        totalUnits += qty;
        totalRevenue += revenue;
        if (color) {
          const c = colors.get(color) ?? { name: color, units: 0 };
          c.units += qty;
          colors.set(color, c);
        }
      }
    }
    if (orders.length < PAGE) break;
  }

  return {
    top: [...products.values()].sort((a, b) => b.units - a.units).slice(0, 20),
    colors: [...colors.values()].sort((a, b) => b.units - a.units),
    totalUnits,
    totalRevenue,
  };
}
