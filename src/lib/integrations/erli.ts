import { ingestOrder, type OrderPayload } from "@/lib/ingest";

/**
 * Klient Erli API — https://developer.erli.pl/
 *
 * Autoryzacja: klucz API konta sprzedawcy (ERLI_API_KEY).
 * UWAGA: dokładne ścieżki/format odpowiedzi Erli trzeba potwierdzić na koncie
 * sprzedawcy — poniższa struktura jest gotowa do podpięcia (mapowanie w mapOrder).
 */

const API = process.env.ERLI_API_BASE ?? "https://api.erli.pl";

export function isErliConfigured(): boolean {
  return !!process.env.ERLI_API_KEY;
}

type ErliOrder = {
  id: string;
  status?: string; // np. NEW, SENT, CANCELLED
  buyer?: { name?: string };
  items?: { name?: string; quantity?: number; price?: number }[];
};

function mapStatus(o: ErliOrder): OrderPayload["status"] {
  const s = (o.status ?? "").toUpperCase();
  if (s.includes("CANCEL")) return "CANCELLED";
  if (s.includes("SENT") || s.includes("DELIVER") || s.includes("DONE"))
    return "COMPLETED";
  return "NEW";
}

export async function syncErliOrders(limit = 50): Promise<{
  ok: boolean;
  fetched: number;
  imported: number;
  updated: number;
  error?: string;
}> {
  if (!isErliConfigured()) {
    return { ok: false, fetched: 0, imported: 0, updated: 0, error: "Erli niepodłączone (brak klucza)." };
  }
  try {
    const res = await fetch(`${API}/orders?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${process.env.ERLI_API_KEY}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`Erli orders ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { orders?: ErliOrder[] };
    const orders = data.orders ?? [];

    let imported = 0;
    let updated = 0;
    for (const o of orders) {
      for (const [i, it] of (o.items ?? []).entries()) {
        const payload: OrderPayload = {
          clientHint: it.name ?? "Zamówienie Erli",
          productName: it.name ?? "Zamówienie Erli",
          buyer: o.buyer?.name ?? undefined,
          amount: Number(it.price ?? 0),
          quantity: it.quantity ?? 1,
          externalId: `${o.id}-${i}`,
          status: mapStatus(o),
        };
        const r = await ingestOrder(payload, "ERLI");
        if (r.ok && r.updated) updated++;
        else if (r.ok && !r.duplicate) imported++;
      }
    }
    return { ok: true, fetched: orders.length, imported, updated };
  } catch (e) {
    return {
      ok: false,
      fetched: 0,
      imported: 0,
      updated: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
