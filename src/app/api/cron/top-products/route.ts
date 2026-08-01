import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSms, sendEmail } from "@/lib/notify";
import {
  getTopProductsByShop,
  buildTopProductsSms,
  buildTopProductsEmail,
} from "@/lib/reports";

/**
 * Raport TOP produktów do szefów (Darek, Arek) — co się dobrze sprzedaje na którym sklepie.
 * `?range=month` (30 dni, domyślnie) lub `?range=half` (180 dni). Podłącz pod cron.
 */
export async function GET(req: Request) {
  const range = new URL(req.url).searchParams.get("range") ?? "month";
  const days = range === "half" ? 180 : 30;
  const label = range === "half" ? "pół roku" : "30 dni";

  const shops = await getTopProductsByShop(days);
  const sms = buildTopProductsSms(shops, label);
  const email = buildTopProductsEmail(shops, label);

  const recipients = await prisma.recipient.findMany({
    where: { active: true, weeklyReport: true },
  });

  const results = [];
  for (const r of recipients) {
    if (r.phone) results.push(await sendSms(r.phone, sms, "TOP_PRODUCTS"));
    if (r.email)
      results.push(
        await sendEmail(r.email, `Furnito — TOP produkty (${label})`, email, "TOP_PRODUCTS"),
      );
  }

  return NextResponse.json({ ok: true, range: label, sent: results.length, preview: sms });
}
