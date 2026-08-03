import { prisma } from "@/lib/prisma";
import { matchClientByProducer } from "@/lib/integrations/salesSheet";
import { toNumber } from "@/lib/integrations/google";

/**
 * Synchronizacja autorytatywnych sum z arkusza barterowego Moniki
 * (jeden arkusz "Barter — klienci", po jednej karcie na klienta).
 *
 * Uniwersalne: skrypt w arkuszu wysyła { client: <nazwa karty>, ordersTotal,
 * servicesRealized }. Tu dopasowujemy kartę do klienta (lub zakładamy nowego)
 * i zapisujemy sumy jako ŹRÓDŁO PRAWDY salda (Client.ordersTotalSheet /
 * servicesRealizedSheet). Dodanie/usunięcie karty nie wymaga zmian w kodzie.
 */

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "klient";
  let slug = root;
  let n = 1;
  while (await prisma.client.findUnique({ where: { slug } })) {
    slug = `${root}-${++n}`;
  }
  return slug;
}

// przyjmij liczbę lub tekst ("136 117,00 zł") → number | null
function coerce(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : toNumber(String(v));
  return Number.isFinite(n) ? n : null;
}

export async function upsertMonikaTotals(input: {
  client: string;
  ordersTotal?: number | string | null;
  servicesRealized?: number | string | null;
}): Promise<{ ok: boolean; action: "updated" | "created"; client: string; error?: string }> {
  const name = (input.client ?? "").trim();
  if (!name) return { ok: false, action: "updated", client: "", error: "Brak nazwy karty/klienta." };

  const orders = coerce(input.ordersTotal);
  const services = coerce(input.servicesRealized);

  const clients = await prisma.client.findMany({
    select: { id: true, name: true, slug: true },
  });
  const match = matchClientByProducer(clients, name);

  const data = {
    ...(orders != null ? { ordersTotalSheet: orders } : {}),
    ...(services != null ? { servicesRealizedSheet: services } : {}),
  };

  if (match) {
    await prisma.client.update({ where: { id: match.id }, data });
    return { ok: true, action: "updated", client: match.name };
  }

  // nowa karta = nowy klient
  await prisma.client.create({
    data: { name, slug: await uniqueSlug(name), ...data },
  });
  return { ok: true, action: "created", client: name };
}
