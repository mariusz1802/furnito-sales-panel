import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDashboardSummary, getBestsellers, getClientsWithBalances } from "@/lib/data";
import { sendSms, sendEmail } from "@/lib/notify";
import { formatPLN } from "@/lib/format";

/**
 * Tygodniowy raport sprzedaży. Podłącz pod cron (np. Vercel Cron / harmonogram)
 * na poniedziałek rano. Wysyła podsumowanie do odbiorców z opcją "raport tygodniowy".
 */
export async function GET() {
  const [summary, bestsellers, clients] = await Promise.all([
    getDashboardSummary(),
    getBestsellers(7),
    getClientsWithBalances(),
  ]);

  const top = bestsellers
    .slice(0, 3)
    .map((b) => `${b.name} (${b.units} szt.)`)
    .join(", ");
  const overdrawn = clients.filter((c) => c.balance.isOverdrawn).map((c) => c.name);

  const lines = [
    `Furnito — raport tygodniowy`,
    `Sprzedaż: ${formatPLN(summary.salesThisWeek.amount)} (${summary.salesThisWeek.count} zam.)`,
    top ? `Hity: ${top}` : `Brak sprzedaży w tym tygodniu`,
    overdrawn.length ? `Ponad stan: ${overdrawn.join(", ")}` : `Wszystkie salda OK`,
  ];
  const message = lines.join(" · ");
  const emailBody = lines.join("\n");

  const recipients = await prisma.recipient.findMany({
    where: { active: true, weeklyReport: true },
  });

  const results = [];
  for (const r of recipients) {
    if (r.phone) results.push(await sendSms(r.phone, message, "WEEKLY_REPORT"));
    if (r.email)
      results.push(
        await sendEmail(r.email, "Furnito — raport tygodniowy", emailBody, "WEEKLY_REPORT"),
      );
  }

  return NextResponse.json({
    ok: true,
    sent: results.length,
    preview: message,
    results,
  });
}
