import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  bulkSyncFromRows,
  detectColumns,
  parseRow,
  reconcileSalesSheet,
  upsertFromSheetSale,
} from "@/lib/integrations/salesSheet";

/**
 * Webhook wyzwalany przez Apps Script (trigger onEdit) w arkuszu "dane sprzedażowe".
 * Daje aktualizację "na żywo" (sekundy) w kierunku Sheet → aplikacja.
 *
 * Payload (JSON):
 *   { secret, rowNumber, header: string[], row: string[] }   // pojedyncza zmiana
 *   { secret, reconcile: true }                               // pełny pull (cron/ręcznie)
 *
 * Bezpieczeństwo: współdzielony sekret SHEETS_WEBHOOK_SECRET.
 * Anty-pętla: zapisy aplikacja→arkusz idą przez Sheets API, które NIE wyzwala
 * triggera onEdit, więc nie wracają tędy. Dodatkowo pomijamy wiersze świeżo
 * zapisane przez aplikację (lastSyncedFromApp).
 */

type Payload = {
  secret?: string;
  rowNumber?: number;
  header?: string[];
  row?: string[];
  reconcile?: boolean;
  // tryb zbiorczy (Apps Script "wyślij wszystko")
  bulk?: boolean;
  rows?: string[][];
  firstRow?: number;
  replaceImport?: boolean;
};

export async function POST(request: Request) {
  const secret = process.env.SHEETS_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Brak SHEETS_WEBHOOK_SECRET po stronie serwera." },
      { status: 500 },
    );
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Zły JSON." }, { status: 400 });
  }

  if (body.secret !== secret) {
    return NextResponse.json({ ok: false, error: "Zły sekret." }, { status: 401 });
  }

  // Tryb zbiorczy: pełna synchronizacja wszystkich wierszy z Apps Script
  if (body.bulk) {
    if (!Array.isArray(body.header) || !Array.isArray(body.rows) || !body.firstRow) {
      return NextResponse.json(
        { ok: false, error: "Bulk wymaga: header[], rows[][], firstRow." },
        { status: 400 },
      );
    }
    const r = await bulkSyncFromRows(
      body.header,
      body.rows,
      body.firstRow,
      body.replaceImport === true,
    );
    revalidatePath("/");
    revalidatePath("/sprzedaz");
    revalidatePath("/klienci");
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  }

  // Tryb pełnej synchronizacji przez konto serwisowe (cron; wymaga Google API)
  if (body.reconcile) {
    const r = await reconcileSalesSheet();
    revalidatePath("/");
    revalidatePath("/sprzedaz");
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  }

  const { rowNumber, header, row } = body;
  if (!rowNumber || !Array.isArray(header) || !Array.isArray(row)) {
    return NextResponse.json(
      { ok: false, error: "Wymagane: rowNumber, header[], row[]." },
      { status: 400 },
    );
  }

  // Wiersz wyczyszczony w arkuszu → usuń sprzedaż o tym numerze wiersza
  const isEmpty = row.every((c) => String(c ?? "").trim() === "");
  if (isEmpty) {
    await prisma.sale.deleteMany({ where: { sheetRow: rowNumber } });
    revalidatePath("/");
    revalidatePath("/sprzedaz");
    return NextResponse.json({ ok: true, action: "deleted", rowNumber });
  }

  // Anty-pętla: jeśli aplikacja właśnie zapisała ten wiersz — pomiń odbicie
  const existing = await prisma.sale.findUnique({
    where: { sheetRow: rowNumber },
    select: { lastSyncedFromApp: true },
  });
  if (existing?.lastSyncedFromApp) {
    const ageMs = Date.now() - existing.lastSyncedFromApp.getTime();
    if (ageMs < 15_000) {
      return NextResponse.json({ ok: true, action: "skipped-own-write", rowNumber });
    }
  }

  const cols = detectColumns([header, row]);
  if (!cols) {
    return NextResponse.json(
      { ok: false, error: "Nagłówek bez kolumn MEBEL / Marketplace." },
      { status: 422 },
    );
  }

  const parsed = parseRow(cols, row, rowNumber);
  const clients = await prisma.client.findMany({
    select: { id: true, name: true, slug: true },
  });
  const result = await upsertFromSheetSale(parsed, clients);

  revalidatePath("/");
  revalidatePath("/sprzedaz");
  return NextResponse.json(
    { ok: result.ok, action: result.ok ? "upserted" : "skipped", reason: result.skipped, rowNumber },
    { status: result.ok ? 200 : 422 },
  );
}
