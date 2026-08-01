import { NextResponse } from "next/server";
import { syncAllSheets } from "@/lib/integrations/sheets";
import { reconcileSalesSheet } from "@/lib/integrations/salesSheet";

/**
 * Pełny sync arkuszy Google. Zapasowo dla synchronizacji "na żywo" (webhook):
 *  - arkusze barterowe per klient (tylko odczyt),
 *  - arkusz "dane sprzedażowe" (reconcile dwukierunkowy).
 *
 * Podpięte pod Vercel Cron (patrz vercel.json). Jeśli ustawiono CRON_SECRET,
 * żądanie musi mieć nagłówek Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const [barter, sales] = await Promise.all([
    syncAllSheets(),
    reconcileSalesSheet(),
  ]);

  const ok = barter.ok || sales.ok;
  return NextResponse.json({ ok, barter, sales }, { status: ok ? 200 : 422 });
}
