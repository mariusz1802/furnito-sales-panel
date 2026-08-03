import { detectColor } from "@/lib/reports";
import type { StoreProductReport, StoreTopProduct, StoreColorStat } from "@/lib/integrations/woocommerce";

/**
 * Pobieranie "co się sprzedaje" ze sklepu Shoper (np. K2) przez webapi REST.
 * Auth: Authorization: Bearer <token>. Endpointy:
 *   GET /webapi/rest/orders          — zamówienia (order_id, date, ...)
 *   GET /webapi/rest/order-products  — pozycje zamówień (name, quantity, price, order_id)
 *
 * Filtr daty po stronie Shopera bywa zawodny, więc zakres [from, to] filtrujemy
 * po naszej stronie (na podstawie orders.date). Zwracamy agregaty produktowe.
 */

export type ShoperConn = { baseUrl: string; secret: string };

const RATE_MS = 400; // WAF Shopera blokuje serie szybkich żądań (~2 RPS)
const PAGE = 50;
const MAX_PAGES = 30; // zabezpieczenie (30×50 = 1500 rekordów / typ)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function shoperGet(
  base: string,
  token: string,
  path: string,
  page: number,
): Promise<{ count: number; pages: number; list: Record<string, unknown>[] }> {
  const url = `${base.replace(/\/+$/, "")}/webapi/rest/${path}?limit=${PAGE}&page=${page}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Shoper ${path} ${res.status}: ${(await res.text()).slice(0, 100)}`);
  const d = (await res.json()) as {
    count?: number;
    pages?: number;
    list?: Record<string, unknown>[];
  };
  return { count: d.count ?? 0, pages: d.pages ?? 1, list: d.list ?? [] };
}

export async function shoperProductReport(
  conn: ShoperConn,
  from: Date,
  to: Date,
): Promise<StoreProductReport> {
  const base = conn.baseUrl;
  const token = conn.secret;

  // 1) zamówienia → mapa order_id → czy w zakresie dat
  const inRange = new Set<string>();
  const first = await shoperGet(base, token, "orders", 1);
  const totalPages = Math.min(first.pages, MAX_PAGES);
  const collectOrders = (list: Record<string, unknown>[]) => {
    for (const o of list) {
      const id = String(o.order_id ?? "");
      const d = new Date(String(o.date ?? ""));
      if (id && !Number.isNaN(d.getTime()) && d >= from && d <= to) inRange.add(id);
    }
  };
  collectOrders(first.list);
  for (let p = 2; p <= totalPages; p++) {
    await sleep(RATE_MS);
    const r = await shoperGet(base, token, "orders", p);
    collectOrders(r.list);
  }

  // 2) pozycje zamówień → agregacja tylko dla zamówień w zakresie
  const products = new Map<string, StoreTopProduct>();
  const colors = new Map<string, StoreColorStat>();
  let totalUnits = 0;
  let totalRevenue = 0;

  const collectItems = (list: Record<string, unknown>[]) => {
    for (const it of list) {
      const oid = String(it.order_id ?? "");
      if (!inRange.has(oid)) continue;
      const name = String(it.name ?? "—");
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      const revenue = price * qty;
      const p = products.get(name) ?? { name, units: 0, revenue: 0 };
      p.units += qty;
      p.revenue += revenue;
      products.set(name, p);
      totalUnits += qty;
      totalRevenue += revenue;
      const color = detectColor(name);
      if (color) {
        const c = colors.get(color) ?? { name: color, units: 0 };
        c.units += qty;
        colors.set(color, c);
      }
    }
  };

  await sleep(RATE_MS);
  const firstItems = await shoperGet(base, token, "order-products", 1);
  const itemPages = Math.min(firstItems.pages, MAX_PAGES);
  collectItems(firstItems.list);
  for (let p = 2; p <= itemPages; p++) {
    await sleep(RATE_MS);
    const r = await shoperGet(base, token, "order-products", p);
    collectItems(r.list);
  }

  return {
    top: [...products.values()].sort((a, b) => b.units - a.units).slice(0, 20),
    colors: [...colors.values()].sort((a, b) => b.units - a.units),
    totalUnits,
    totalRevenue,
  };
}
