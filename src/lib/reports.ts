import { prisma } from "@/lib/prisma";
import { SaleStatus } from "@/generated/prisma/client";
import { formatPLN } from "@/lib/format";

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
