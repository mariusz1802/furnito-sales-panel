import { ingestOrder, type OrderPayload } from "@/lib/ingest";

/**
 * Klient Allegro REST API — https://developer.allegro.pl/
 *
 * Autoryzacja: OAuth2 refresh_token (dostęp do zamówień = zakres do konta sprzedawcy).
 * Ustaw w .env: ALLEGRO_CLIENT_ID, ALLEGRO_CLIENT_SECRET, ALLEGRO_REFRESH_TOKEN.
 * Bez kluczy funkcje rzucają czytelny błąd (integracja "do konfiguracji").
 */

const API = "https://api.allegro.pl";
const AUTH = "https://allegro.pl/auth/oauth/token";
const ACCEPT = "application/vnd.allegro.public.v1+json";

export function isAllegroConfigured(): boolean {
  return (
    !!process.env.ALLEGRO_CLIENT_ID &&
    !!process.env.ALLEGRO_CLIENT_SECRET &&
    !!process.env.ALLEGRO_REFRESH_TOKEN
  );
}

async function getAccessToken(): Promise<string> {
  const id = process.env.ALLEGRO_CLIENT_ID!;
  const secret = process.env.ALLEGRO_CLIENT_SECRET!;
  const refresh = process.env.ALLEGRO_REFRESH_TOKEN!;
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");

  const res = await fetch(AUTH, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
  });
  if (!res.ok) throw new Error(`Allegro auth ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

type CheckoutForm = {
  id: string;
  status: string; // np. READY_FOR_PROCESSING, PROCESSING
  fulfillment?: { status?: string }; // np. SENT, CANCELLED
  buyer?: { login?: string; firstName?: string; lastName?: string };
  lineItems?: {
    offer?: { name?: string };
    quantity?: number;
    price?: { amount?: string };
  }[];
};

function mapStatus(f: CheckoutForm): OrderPayload["status"] {
  const ff = f.fulfillment?.status;
  if (ff === "CANCELLED" || f.status === "CANCELLED") return "CANCELLED";
  if (ff === "SENT" || ff === "PICKED_UP") return "COMPLETED";
  return "NEW";
}

/**
 * Pobiera ostatnie zamówienia (checkout-forms) i zapisuje/aktualizuje sprzedaż.
 * `clientHint` mapuje zamówienie na producenta — na start po nazwie oferty/sprzedawcy;
 * docelowo warto trzymać mapowanie oferta→klient w bazie.
 */
export async function syncAllegroOrders(limit = 50): Promise<{
  ok: boolean;
  fetched: number;
  imported: number;
  updated: number;
  error?: string;
}> {
  if (!isAllegroConfigured()) {
    return { ok: false, fetched: 0, imported: 0, updated: 0, error: "Allegro niepodłączone (brak kluczy)." };
  }
  try {
    const token = await getAccessToken();
    const res = await fetch(`${API}/order/checkout-forms?limit=${limit}&sort=-lineItems.boughtAt`, {
      headers: { Authorization: `Bearer ${token}`, Accept: ACCEPT },
    });
    if (!res.ok) throw new Error(`Allegro orders ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { checkoutForms?: CheckoutForm[] };
    const forms = data.checkoutForms ?? [];

    let imported = 0;
    let updated = 0;
    for (const f of forms) {
      const buyer =
        [f.buyer?.firstName, f.buyer?.lastName].filter(Boolean).join(" ") ||
        f.buyer?.login ||
        null;
      for (const [i, li] of (f.lineItems ?? []).entries()) {
        const name = li.offer?.name ?? "Zamówienie Allegro";
        const payload: OrderPayload = {
          clientHint: name, // TODO: mapowanie oferty na producenta w bazie
          productName: name,
          buyer: buyer ?? undefined,
          amount: Number(li.price?.amount ?? 0),
          quantity: li.quantity ?? 1,
          externalId: `${f.id}-${i}`,
          status: mapStatus(f),
        };
        const r = await ingestOrder(payload, "ALLEGRO");
        if (r.ok && r.updated) updated++;
        else if (r.ok && !r.duplicate) imported++;
      }
    }
    return { ok: true, fetched: forms.length, imported, updated };
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
