import { prisma } from "@/lib/prisma";
import {
  extractSheetId,
  getAccessToken,
  isGoogleConfigured,
  toNumber,
} from "@/lib/integrations/google";

/**
 * Auto-sync z Google Sheets (arkusze barterowe per klient) — Google Sheets API v4.
 * TYLKO DO ODCZYTU: te arkusze mają nieregularny układ, więc panel ich nie zapisuje.
 * Dwukierunkowa synchronizacja dotyczy osobnego arkusza tabelarycznego — patrz
 * salesSheet.ts.
 *
 * Autoryzacja: konto serwisowe (patrz google.ts). Udostępnij każdy arkusz na
 * adres konta serwisowego (uprawnienie: Przeglądający).
 *
 * Parser jest best-effort dla układu arkusza barterowego (kolumny zamówień po
 * lewej + suma usług).
 */

export { extractSheetId };

export function isSheetsConfigured(): boolean {
  return isGoogleConfigured();
}

type Grid = string[][];

/** Best-effort parser układu barterowego → { salesTotal, servicesTotal, sales[] } */
export function parseBarterGrid(rows: Grid) {
  const sales: {
    productName: string;
    variant: string | null;
    buyer: string | null;
    amount: number;
    quantity: number;
    status: "NEW" | "CANCELLED" | "RESIGNED";
  }[] = [];

  // sprzedaż: para (kwota w kol. A) + (opis w kol. B)
  for (const row of rows) {
    const amount = toNumber(row[0] ?? "");
    const desc = (row[1] ?? "").trim();
    if (!Number.isFinite(amount) || amount <= 0 || !desc) continue;
    if (/kwota|zamówie|suma|różnic/i.test(desc)) continue;

    const upper = desc.toUpperCase();
    const status = /ANUL/.test(upper)
      ? "CANCELLED"
      : /REZYGN/.test(upper)
        ? "RESIGNED"
        : "NEW";
    const qtyMatch = desc.match(/(\d+)\s*x/i);
    const quantity = qtyMatch ? Number(qtyMatch[1]) : 1;
    const buyer = desc.includes(" - ") ? desc.split(" - ").pop()!.trim() : null;
    const productName = desc.split(" - ")[0].replace(/[",]/g, "").trim();

    sales.push({ productName, variant: null, buyer, amount, quantity, status });
  }

  const salesTotal = sales
    .filter((s) => s.status === "NEW")
    .reduce((a, s) => a + s.amount * (s.quantity || 1), 0);

  // suma usług: szukamy najniższej "różnicy" / największej liczby po prawej jako fallback
  let servicesTotal = 0;
  for (const row of rows) {
    for (const cell of row.slice(3)) {
      const n = toNumber(cell ?? "");
      if (Number.isFinite(n) && n > servicesTotal) servicesTotal = n;
    }
  }

  return { sales, salesTotal, servicesTotal };
}

async function fetchGrid(sheetId: string, token: string): Promise<Grid> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z500?majorDimension=ROWS`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Sheets ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

/** Sync jednego klienta z jego arkusza. */
export async function syncClientSheet(clientId: string): Promise<{
  ok: boolean;
  sales: number;
  error?: string;
}> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client?.sheetUrl) return { ok: false, sales: 0, error: "Brak linku do arkusza." };
  const sheetId = extractSheetId(client.sheetUrl);
  if (!sheetId) return { ok: false, sales: 0, error: "Nieprawidłowy link arkusza." };

  try {
    const token = await getAccessToken();
    const grid = await fetchGrid(sheetId, token);
    const parsed = parseBarterGrid(grid);

    await prisma.sale.deleteMany({ where: { clientId, marketplace: "OTHER" } });
    await prisma.service.deleteMany({ where: { clientId } });
    await prisma.service.create({
      data: { clientId, name: "Barter (z arkusza)", amount: parsed.servicesTotal },
    });
    for (const [i, s] of parsed.sales.entries()) {
      await prisma.sale.create({
        data: {
          clientId,
          productName: s.productName,
          variant: s.variant,
          buyer: s.buyer,
          amount: s.amount,
          quantity: s.quantity,
          marketplace: "OTHER",
          status: s.status,
          externalId: `SHEET-${client.slug}-${i}`,
        },
      });
    }
    return { ok: true, sales: parsed.sales.length };
  } catch (e) {
    return { ok: false, sales: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Sync wszystkich klientów, którzy mają podpięty arkusz. */
export async function syncAllSheets(): Promise<{
  ok: boolean;
  clients: number;
  sales: number;
  errors: string[];
}> {
  if (!isSheetsConfigured()) {
    return { ok: false, clients: 0, sales: 0, errors: ["Google Sheets niepodłączone (brak konta serwisowego)."] };
  }
  const clients = await prisma.client.findMany({
    where: { sheetUrl: { not: null } },
    select: { id: true, name: true },
  });
  let sales = 0;
  const errors: string[] = [];
  for (const c of clients) {
    const r = await syncClientSheet(c.id);
    if (r.ok) sales += r.sales;
    else errors.push(`${c.name}: ${r.error}`);
  }
  return { ok: errors.length === 0, clients: clients.length, sales, errors };
}
