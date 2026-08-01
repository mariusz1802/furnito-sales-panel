import { prisma } from "@/lib/prisma";
import type { Marketplace, SaleStatus } from "@/generated/prisma/enums";
import {
  getAccessToken,
  isGoogleConfigured,
  normHeader,
  toNumber,
} from "@/lib/integrations/google";

/**
 * Dwukierunkowa synchronizacja z arkuszem "dane sprzedażowe" (układ tabelaryczny).
 *
 * Nagłówek (wiersz 2 arkusza):
 *   MEBEL | kwota z barteru | producent | Marketplace | STATUS | kwota sprzedaży |
 *   kwota transportu | status kasy | data sprzedaży | data wysyłki | data otrzymania |
 *   Status kasy | Inne | Nazwisko Klienta
 *
 * Kierunki:
 *  - Sheet → aplikacja: reconcileSalesSheet() (pełny pull) oraz upsertFromSheetRow()
 *    (pojedynczy wiersz z webhooka Apps Script onEdit).
 *  - Aplikacja → Sheet: appendSaleRow() / updateSaleRow() (Sheets API values.*).
 *
 * Kolumny są STAŁE — dlatego tylko ten arkusz synchronizujemy w obie strony.
 * Arkusze barterowe per klient pozostają tylko do odczytu (patrz sheets.ts).
 */

export function getSalesSheetId(): string | null {
  return process.env.SALES_SHEET_ID?.trim() || null;
}

export function isSalesSheetConfigured(): boolean {
  return isGoogleConfigured() && !!getSalesSheetId();
}

const API = "https://sheets.googleapis.com/v4/spreadsheets";

// ---- mapowanie wartości arkusza → enumy ---------------------------------

function toMarketplace(channel: string | null): Marketplace {
  const c = (channel ?? "").toLowerCase();
  if (/allegro/.test(c)) return "ALLEGRO";
  if (/erli/.test(c)) return "ERLI";
  if (!c) return "MANUAL";
  return "OTHER"; // Facebook, Inna Płatność, itp.
}

function toStatus(raw: string | null): SaleStatus {
  const s = (raw ?? "").toLowerCase();
  if (/anul/.test(s)) return "CANCELLED";
  if (/rezygn/.test(s)) return "RESIGNED";
  if (/zrealizow/.test(s)) return "COMPLETED";
  return "NEW";
}

function toDate(raw: string): Date | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function numOrNull(raw: string): number | null {
  const n = toNumber(raw);
  return Number.isFinite(n) ? n : null;
}

// ---- rozpoznanie kolumn --------------------------------------------------

export type ColumnMap = {
  headerRowIndex: number; // 0-based indeks wiersza nagłówka w gridzie
  headers: string[]; // oryginalne nagłówki (do zapisu w tej samej kolejności)
  idx: {
    product: number;
    barter: number;
    producer: number;
    channel: number;
    status: number;
    amount: number;
    transport: number;
    soldAt: number;
    shippedAt: number;
    receivedAt: number;
    cashStatus: number;
    buyer: number;
  };
};

/** Znajdź wiersz nagłówka (zawiera "mebel" i "marketplace") i zmapuj kolumny. */
export function detectColumns(grid: string[][]): ColumnMap | null {
  const headerRowIndex = grid.findIndex((row) => {
    const norm = row.map(normHeader);
    return norm.includes("mebel") && norm.some((h) => h.includes("marketplace"));
  });
  if (headerRowIndex < 0) return null;

  const headers = grid[headerRowIndex];
  const norm = headers.map(normHeader);

  const first = (pred: (h: string) => boolean) => norm.findIndex(pred);
  const last = (pred: (h: string) => boolean) => {
    for (let i = norm.length - 1; i >= 0; i--) if (pred(norm[i])) return i;
    return -1;
  };

  return {
    headerRowIndex,
    headers,
    idx: {
      product: first((h) => h === "mebel"),
      barter: first((h) => h.includes("barter")),
      producer: first((h) => h.includes("producent")),
      channel: first((h) => h.includes("marketplace")),
      status: first((h) => h === "status"),
      amount: first((h) => h.includes("kwota sprzedazy")),
      transport: first((h) => h.includes("transport")),
      soldAt: first((h) => h.includes("data sprzedazy")),
      shippedAt: first((h) => h.includes("data wysylki")),
      receivedAt: first((h) => h.includes("data otrzymania")),
      // "status kasy" występuje 2x — bierzemy bogatszą (ostatnią) kolumnę
      cashStatus: last((h) => h.includes("status kasy")),
      buyer: first((h) => h.includes("nazwisko")),
    },
  };
}

// ---- parsowanie pojedynczego wiersza ------------------------------------

export type SheetSale = {
  sheetRow: number; // numer wiersza w arkuszu (1-based)
  productName: string;
  producer: string | null;
  barterAmount: number | null;
  channel: string | null;
  marketplace: Marketplace;
  status: SaleStatus;
  amount: number;
  transportAmount: number | null;
  cashStatus: string | null;
  soldAt: Date | null;
  shippedAt: Date | null;
  receivedAt: Date | null;
  buyer: string | null;
  ok: boolean; // czy wiersz nadaje się do zapisu (ma produkt)
};

// Apps Script może przysłać liczby/daty jako liczby lub ISO — koercja do stringa.
const cell = (cells: unknown[], i: number) =>
  i >= 0 ? String(cells[i] ?? "").trim() : "";

export function parseRow(
  cols: ColumnMap,
  cells: unknown[],
  sheetRow: number,
): SheetSale {
  const productName = cell(cells, cols.idx.product);
  const channel = cell(cells, cols.idx.channel) || null;
  return {
    sheetRow,
    productName,
    producer: cell(cells, cols.idx.producer) || null,
    barterAmount: numOrNull(cell(cells, cols.idx.barter)),
    channel,
    marketplace: toMarketplace(channel),
    status: toStatus(cell(cells, cols.idx.status)),
    amount: toNumber(cell(cells, cols.idx.amount)) || 0,
    transportAmount: numOrNull(cell(cells, cols.idx.transport)),
    cashStatus: cell(cells, cols.idx.cashStatus) || null,
    soldAt: toDate(cell(cells, cols.idx.soldAt)),
    shippedAt: toDate(cell(cells, cols.idx.shippedAt)),
    receivedAt: toDate(cell(cells, cols.idx.receivedAt)),
    buyer: cell(cells, cols.idx.buyer) || null,
    ok: productName.length > 0,
  };
}

// ---- dopasowanie klienta (producent → Client) ---------------------------

type ClientLite = { id: string; name: string; slug: string };

function matchClient(
  clients: ClientLite[],
  producer: string | null,
  buyer: string | null,
): ClientLite | null {
  const hay = `${producer ?? ""} ${buyer ?? ""}`.toLowerCase();
  if (!hay.trim()) return null;
  // najdłuższa nazwa klienta zawarta w "producent" wygrywa (KMK vs KMK Meble)
  let best: ClientLite | null = null;
  for (const c of clients) {
    const name = c.name.toLowerCase();
    const key = c.slug.replace(/-/g, " ");
    const token = name.split(/\s+/)[0]; // "cezar", "kmk", "roberto"...
    if (hay.includes(name) || hay.includes(key) || (token.length >= 3 && hay.includes(token))) {
      if (!best || c.name.length > best.name.length) best = c;
    }
  }
  return best;
}

// ---- Sheet → aplikacja ---------------------------------------------------

async function fetchGrid(sheetId: string, token: string): Promise<string[][]> {
  const res = await fetch(
    `${API}/${sheetId}/values/A1:Z1000?majorDimension=ROWS`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Sheets ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

/** Zapisz/aktualizuj pojedynczą sprzedaż z arkusza do bazy. Zwraca id lub null. */
export async function upsertFromSheetSale(
  s: SheetSale,
  clients: ClientLite[],
): Promise<{ ok: boolean; skipped?: string }> {
  if (!s.ok) return { ok: false, skipped: "brak nazwy mebla" };
  const client = matchClient(clients, s.producer, s.buyer);
  if (!client) return { ok: false, skipped: `nie dopasowano klienta (producent: ${s.producer ?? "—"})` };

  const data = {
    clientId: client.id,
    productName: s.productName,
    buyer: s.buyer,
    amount: s.amount,
    marketplace: s.marketplace,
    status: s.status,
    producer: s.producer,
    barterAmount: s.barterAmount,
    transportAmount: s.transportAmount,
    cashStatus: s.cashStatus,
    channel: s.channel,
    soldAt: s.soldAt ?? undefined,
    shippedAt: s.shippedAt,
    receivedAt: s.receivedAt,
    sheetRow: s.sheetRow,
  };

  await prisma.sale.upsert({
    where: { sheetRow: s.sheetRow },
    create: data,
    update: {
      // nie nadpisujemy sheetRow; reszta pól z arkusza jest autorytatywna
      clientId: data.clientId,
      productName: data.productName,
      buyer: data.buyer,
      amount: data.amount,
      marketplace: data.marketplace,
      status: data.status,
      producer: data.producer,
      barterAmount: data.barterAmount,
      transportAmount: data.transportAmount,
      cashStatus: data.cashStatus,
      channel: data.channel,
      soldAt: data.soldAt,
      shippedAt: data.shippedAt,
      receivedAt: data.receivedAt,
    },
  });
  return { ok: true };
}

/** Pełny pull arkusza sprzedażowego → reconcile bazy (dodaj/aktualizuj/usuń). */
export async function reconcileSalesSheet(): Promise<{
  ok: boolean;
  upserted: number;
  removed: number;
  skipped: string[];
  error?: string;
}> {
  if (!isSalesSheetConfigured()) {
    return {
      ok: false,
      upserted: 0,
      removed: 0,
      skipped: [],
      error: "Arkusz sprzedażowy niepodłączony (SALES_SHEET_ID / konto serwisowe).",
    };
  }
  const sheetId = getSalesSheetId()!;
  try {
    const token = await getAccessToken();
    const grid = await fetchGrid(sheetId, token);
    const cols = detectColumns(grid);
    if (!cols) throw new Error("Nie znaleziono nagłówka (MEBEL / Marketplace) w arkuszu.");

    const clients = await prisma.client.findMany({
      select: { id: true, name: true, slug: true },
    });

    const dataStart = cols.headerRowIndex + 1;
    const present = new Set<number>();
    const skipped: string[] = [];
    let upserted = 0;

    for (let i = dataStart; i < grid.length; i++) {
      const sheetRow = i + 1; // 1-based numer wiersza w arkuszu
      const parsed = parseRow(cols, grid[i], sheetRow);
      if (!parsed.ok) continue; // pusty wiersz
      const r = await upsertFromSheetSale(parsed, clients);
      if (r.ok) {
        present.add(sheetRow);
        upserted++;
      } else if (r.skipped) {
        skipped.push(`Wiersz ${sheetRow}: ${r.skipped}`);
      }
    }

    // usuń sprzedaże, które zniknęły z arkusza (miały sheetRow, już ich nie ma)
    const orphans = await prisma.sale.findMany({
      where: { sheetRow: { not: null } },
      select: { id: true, sheetRow: true },
    });
    const toDelete = orphans.filter((o) => o.sheetRow != null && !present.has(o.sheetRow));
    if (toDelete.length) {
      await prisma.sale.deleteMany({ where: { id: { in: toDelete.map((o) => o.id) } } });
    }

    return { ok: true, upserted, removed: toDelete.length, skipped: skipped.slice(0, 10) };
  } catch (e) {
    return {
      ok: false,
      upserted: 0,
      removed: 0,
      skipped: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ---- Aplikacja → Sheet ---------------------------------------------------

type SaleForSheet = {
  productName: string;
  producer?: string | null;
  barterAmount?: number | null;
  channel?: string | null;
  marketplace?: Marketplace;
  status?: SaleStatus;
  amount: number;
  transportAmount?: number | null;
  cashStatus?: string | null;
  soldAt?: Date | null;
  shippedAt?: Date | null;
  receivedAt?: Date | null;
  buyer?: string | null;
};

const STATUS_LABEL: Record<SaleStatus, string> = {
  NEW: "W realizacji",
  COMPLETED: "Zrealizowano",
  CANCELLED: "Anulowano",
  RESIGNED: "Rezygnacja",
};

const fmtDate = (d?: Date | null) =>
  d ? d.toISOString().slice(0, 10) : "";

/** Zbuduj wiersz wartości w kolejności kolumn arkusza (te same kolumny). */
function buildRowValues(cols: ColumnMap, s: SaleForSheet): (string | number)[] {
  const row: (string | number)[] = new Array(cols.headers.length).fill("");
  const put = (i: number, v: string | number) => {
    if (i >= 0 && i < row.length) row[i] = v;
  };
  put(cols.idx.product, s.productName);
  put(cols.idx.producer, s.producer ?? "");
  put(cols.idx.barter, s.barterAmount ?? "");
  put(cols.idx.channel, s.channel ?? (s.marketplace ? s.marketplace : ""));
  put(cols.idx.status, s.status ? STATUS_LABEL[s.status] : "");
  put(cols.idx.amount, s.amount);
  put(cols.idx.transport, s.transportAmount ?? "");
  put(cols.idx.cashStatus, s.cashStatus ?? "");
  put(cols.idx.soldAt, fmtDate(s.soldAt));
  put(cols.idx.shippedAt, fmtDate(s.shippedAt));
  put(cols.idx.receivedAt, fmtDate(s.receivedAt));
  put(cols.idx.buyer, s.buyer ?? "");
  return row;
}

async function loadColumns(sheetId: string, token: string): Promise<ColumnMap> {
  const grid = await fetchGrid(sheetId, token);
  const cols = detectColumns(grid);
  if (!cols) throw new Error("Nie znaleziono nagłówka arkusza sprzedażowego.");
  return cols;
}

/** Pierwsza (widoczna) nazwa zakładki arkusza — potrzebna do zakresów A1. */
async function sheetTitle(sheetId: string, token: string): Promise<string> {
  const res = await fetch(
    `${API}/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Sheets meta ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as {
    sheets?: { properties?: { title?: string } }[];
  };
  return data.sheets?.[0]?.properties?.title ?? "Arkusz1";
}

/**
 * Dopisz nowy wiersz sprzedaży do arkusza. Zwraca numer wstawionego wiersza
 * (do zapisania jako Sale.sheetRow) — anty-pętla: własnych zapisów API arkusz
 * nie zgłasza triggerem onEdit, więc nie wrócą webhookiem.
 */
export async function appendSaleRow(
  s: SaleForSheet,
): Promise<{ ok: boolean; sheetRow?: number; error?: string }> {
  if (!isSalesSheetConfigured()) return { ok: false, error: "Arkusz niepodłączony." };
  const sheetId = getSalesSheetId()!;
  try {
    const token = await getAccessToken();
    const [cols, title] = await Promise.all([
      loadColumns(sheetId, token),
      sheetTitle(sheetId, token),
    ]);
    const values = buildRowValues(cols, s);
    const range = `${title}!A:${colLetter(cols.headers.length)}`;
    const res = await fetch(
      `${API}/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [values] }),
      },
    );
    if (!res.ok) throw new Error(`Sheets append ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { updates?: { updatedRange?: string } };
    const sheetRow = parseRowFromRange(data.updates?.updatedRange);
    return { ok: true, sheetRow };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Zaktualizuj istniejący wiersz arkusza (sprzedaż edytowana w aplikacji). */
export async function updateSaleRow(
  sheetRow: number,
  s: SaleForSheet,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSalesSheetConfigured()) return { ok: false, error: "Arkusz niepodłączony." };
  const sheetId = getSalesSheetId()!;
  try {
    const token = await getAccessToken();
    const [cols, title] = await Promise.all([
      loadColumns(sheetId, token),
      sheetTitle(sheetId, token),
    ]);
    const values = buildRowValues(cols, s);
    const range = `${title}!A${sheetRow}:${colLetter(cols.headers.length)}${sheetRow}`;
    const res = await fetch(
      `${API}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [values] }),
      },
    );
    if (!res.ok) throw new Error(`Sheets update ${res.status}: ${await res.text()}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---- pomocnicze ----------------------------------------------------------

/** 1 → A, 14 → N (liczba kolumn → litera ostatniej kolumny). */
function colLetter(count: number): string {
  let n = Math.max(1, count);
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** "Arkusz1!A34:N34" → 34 */
function parseRowFromRange(range?: string): number | undefined {
  if (!range) return undefined;
  const m = range.match(/![A-Z]+(\d+):/);
  return m ? Number(m[1]) : undefined;
}
