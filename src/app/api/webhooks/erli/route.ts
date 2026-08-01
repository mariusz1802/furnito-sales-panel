import { NextResponse } from "next/server";
import { ingestOrder } from "@/lib/ingest";

/**
 * Webhook Erli — nowe zamówienia.
 * TODO (realne API): weryfikacja klucza Erli + mapowanie payloadu na sprzedaż.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const result = await ingestOrder(body, "ERLI");
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}

export function GET() {
  return NextResponse.json({ ok: true, endpoint: "erli", ready: true });
}
