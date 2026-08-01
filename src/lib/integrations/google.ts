import { createSign } from "node:crypto";

/**
 * Wspólne helpery Google API (konto serwisowe).
 *
 * Autoryzacja: konto serwisowe. Udostępnij arkusze na adres e-mail konta
 * serwisowego i ustaw w .env:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY (PEM, z \n)
 *
 * Scope obejmuje odczyt i ZAPIS (spreadsheets), bo panel synchronizuje w obie
 * strony. Do zapisu konto serwisowe musi mieć na arkuszu rolę "Edytor".
 */

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export function isGoogleConfigured(): boolean {
  return (
    !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  );
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** Access token konta serwisowego (scope: spreadsheets read+write). */
export async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Brak konta serwisowego Google (GOOGLE_SERVICE_ACCOUNT_EMAIL / KEY).",
    );
  }
  const key = rawKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: email,
      scope: SHEETS_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  );
  const signature = b64url(
    createSign("RSA-SHA256").update(`${header}.${claim}`).sign(key),
  );
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Google auth ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

/** "1 234,50 zł" → 1234.5 ; puste / "x" / "Osobiście" → NaN */
export function toNumber(raw: string): number {
  return Number(
    String(raw ?? "")
      .replace(/\s/g, "")
      .replace(/zł/gi, "")
      .replace(/,/g, "."),
  );
}

/** Normalizacja nagłówka do dopasowania kolumn (bez ogonków, lower, trim). */
export function normHeader(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/"/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
