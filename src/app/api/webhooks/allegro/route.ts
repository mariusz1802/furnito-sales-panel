import { NextResponse } from "next/server";
import { ingestOrder } from "@/lib/ingest";

/**
 * Webhook Allegro — nowe zamówienia.
 *
 * TODO (realne API): zweryfikuj podpis/nagłówki Allegro, pobierz szczegóły
 * zamówienia przez REST (checkout-forms) i zmapuj pozycje na sprzedaż.
 * Na teraz akceptujemy znormalizowany payload (patrz ingestOrder), aby można
 * było przetestować przepływ end-to-end (zapis + powiadomienie).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const result = await ingestOrder(body, "ALLEGRO");
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}

export function GET() {
  return NextResponse.json({ ok: true, endpoint: "allegro", ready: true });
}
