import { prisma } from "@/lib/prisma";
import { notifyNewSale } from "@/lib/notify";

/**
 * Znormalizowany payload zamówienia z marketplace. Realne mapowanie z API
 * Allegro/Erli podłączymy tu — kształt docelowy pozostaje ten sam.
 */
export type OrderPayload = {
  clientHint?: string;
  clientId?: string;
  productName?: string;
  variant?: string;
  buyer?: string;
  amount?: number;
  quantity?: number;
  externalId?: string;
  status?: "NEW" | "COMPLETED" | "CANCELLED" | "RESIGNED";
};

export type IngestResult =
  | { ok: true; saleId: string; duplicate?: boolean; updated?: boolean }
  | { ok: false; error: string };

export async function ingestOrder(
  raw: unknown,
  marketplace: "ALLEGRO" | "ERLI",
): Promise<IngestResult> {
  const p = (raw ?? {}) as OrderPayload;
  const amount = Number(p.amount);
  if (!p.productName || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Brak productName lub poprawnej amount." };
  }

  // dopasuj klienta po id lub nazwie
  let client = p.clientId
    ? await prisma.client.findUnique({ where: { id: p.clientId } })
    : null;
  if (!client && p.clientHint) {
    const hint = p.clientHint.toLowerCase();
    const all = await prisma.client.findMany();
    client = all.find((c) => c.name.toLowerCase().includes(hint)) ?? null;
  }
  if (!client) return { ok: false, error: "Nie dopasowano klienta." };

  const status = p.status ?? "NEW";

  // istniejące zamówienie (po externalId) → aktualizuj status/kwotę zamiast duplikować
  if (p.externalId) {
    const existing = await prisma.sale.findUnique({
      where: {
        marketplace_externalId: { marketplace, externalId: p.externalId },
      },
    });
    if (existing) {
      const statusChanged = existing.status !== status;
      await prisma.sale.update({
        where: { id: existing.id },
        data: { status, amount, quantity: Number(p.quantity) || existing.quantity },
      });
      return { ok: true, saleId: existing.id, duplicate: true, updated: statusChanged };
    }
  }

  const sale = await prisma.sale.create({
    data: {
      clientId: client.id,
      productName: p.productName,
      variant: p.variant ?? null,
      buyer: p.buyer ?? null,
      amount,
      quantity: Number(p.quantity) || 1,
      marketplace,
      externalId: p.externalId ?? null,
      status,
    },
  });

  // powiadamiamy tylko o nowej, aktywnej sprzedaży
  if (status === "NEW" || status === "COMPLETED") {
    await notifyNewSale({
      clientName: client.name,
      productName: p.productName,
      variant: p.variant,
      amount,
      marketplace,
    });
  }

  return { ok: true, saleId: sale.id };
}
