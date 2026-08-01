/**
 * Integracje sprzedażowe. Na start: status konfiguracji + import CSV (działa od ręki).
 * Allegro / Erli: struktura gotowa, realne wywołania API do podłączenia po podaniu kluczy.
 */

export type IntegrationStatus = {
  key: string;
  name: string;
  description: string;
  configured: boolean;
  envVars: string[];
  docsUrl?: string;
};

export function getIntegrationStatuses(): IntegrationStatus[] {
  return [
    {
      key: "sheets",
      name: "Google Sheets",
      description:
        "Automatyczny sync sald i sprzedaży z arkuszy Moniki. Udostępnij arkusze kontu serwisowemu (Przeglądający).",
      configured:
        !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
        !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      envVars: ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_KEY"],
      docsUrl: "https://developers.google.com/sheets/api",
    },
    {
      key: "allegro",
      name: "Allegro",
      description:
        "Automatyczne pobieranie zamówień (REST API + webhooki), zapis sprzedaży i alert SMS przy nowym zamówieniu.",
      configured:
        !!process.env.ALLEGRO_CLIENT_ID && !!process.env.ALLEGRO_CLIENT_SECRET,
      envVars: ["ALLEGRO_CLIENT_ID", "ALLEGRO_CLIENT_SECRET", "ALLEGRO_REFRESH_TOKEN"],
      docsUrl: "https://developer.allegro.pl/",
    },
    {
      key: "erli",
      name: "Erli",
      description:
        "Pobieranie zamówień z marketplace Erli. Wymaga klucza API konta sprzedawcy.",
      configured: !!process.env.ERLI_API_KEY,
      envVars: ["ERLI_API_KEY"],
      docsUrl: "https://developer.erli.pl/",
    },
    {
      key: "smsapi",
      name: "SMSAPI.pl",
      description: "Wysyłka powiadomień SMS na wybrane numery.",
      configured: !!process.env.SMSAPI_TOKEN,
      envVars: ["SMSAPI_TOKEN", "SMSAPI_FROM"],
      docsUrl: "https://www.smsapi.pl/docs",
    },
    {
      key: "email",
      name: "E-mail",
      description: "Raporty tygodniowe i alerty na wybrane adresy (SMTP lub Resend).",
      configured: !!process.env.SMTP_HOST || !!process.env.RESEND_API_KEY,
      envVars: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "RESEND_API_KEY"],
    },
  ];
}

export type ParsedSaleRow = {
  clientHint: string;
  productName: string;
  variant?: string;
  buyer?: string;
  amount: number;
  quantity: number;
  marketplace: "ALLEGRO" | "ERLI" | "MANUAL" | "OTHER";
  ok: boolean;
  error?: string;
};

const MARKET: Record<string, ParsedSaleRow["marketplace"]> = {
  allegro: "ALLEGRO",
  erli: "ERLI",
  early: "ERLI",
  reczne: "MANUAL",
  ręczne: "MANUAL",
  manual: "MANUAL",
};

/**
 * Parser CSV sprzedaży. Nagłówki (elastycznie): klient, produkt, wariant,
 * kupujacy, kwota, ilosc, kanal. Separator , lub ;.
 */
export function parseSalesCsv(text: string): ParsedSaleRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const delim = lines[0].includes(";") ? ";" : ",";
  const norm = (s: string) =>
    s.trim().toLowerCase().replace(/"/g, "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const headers = lines[0].split(delim).map(norm);

  const idx = (names: string[]) =>
    headers.findIndex((h) => names.some((n) => h.includes(n)));
  const iClient = idx(["klient"]);
  const iProduct = idx(["produkt", "model", "nazwa"]);
  const iVariant = idx(["wariant", "kolor", "tkanina"]);
  const iBuyer = idx(["kupujacy", "nabywca", "klient koncowy"]);
  const iAmount = idx(["kwota", "cena", "wartosc"]);
  const iQty = idx(["ilosc", "szt"]);
  const iChannel = idx(["kanal", "marketplace", "platforma"]);

  return lines.slice(1).map((line): ParsedSaleRow => {
    const cols = line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
    const clientHint = iClient >= 0 ? cols[iClient] ?? "" : "";
    const productName = iProduct >= 0 ? cols[iProduct] ?? "" : "";
    const rawAmount = iAmount >= 0 ? cols[iAmount] ?? "" : "";
    const amount = Number(
      rawAmount.replace(/\s/g, "").replace(/zł/gi, "").replace(",", "."),
    );
    const quantity = iQty >= 0 ? Number(cols[iQty]) || 1 : 1;
    const channelRaw = iChannel >= 0 ? norm(cols[iChannel] ?? "") : "manual";

    const row: ParsedSaleRow = {
      clientHint,
      productName,
      variant: iVariant >= 0 ? cols[iVariant] || undefined : undefined,
      buyer: iBuyer >= 0 ? cols[iBuyer] || undefined : undefined,
      amount,
      quantity,
      marketplace: MARKET[channelRaw] ?? "MANUAL",
      ok: true,
    };
    if (!clientHint) {
      row.ok = false;
      row.error = "brak klienta";
    } else if (!productName) {
      row.ok = false;
      row.error = "brak produktu";
    } else if (!Number.isFinite(amount) || amount <= 0) {
      row.ok = false;
      row.error = "błędna kwota";
    }
    return row;
  });
}
