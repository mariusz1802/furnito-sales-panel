import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Administracja klientami (chronione sekretem = SHEETS_WEBHOOK_SECRET).
 * Body: { secret, action: "delete", slug }
 */
type Body = {
  secret?: string;
  action?: string;
  slug?: string;
  productName?: string;
  variant?: string;
  // addRecipient
  name?: string;
  phone?: string;
  email?: string;
  saleAlerts?: boolean;
  weeklyReport?: boolean;
  // testSms
  text?: string;
};

export async function POST(request: Request) {
  const secret = process.env.SHEETS_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Brak sekretu serwera." }, { status: 500 });
  }
  let b: Body;
  try {
    b = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Zły JSON." }, { status: 400 });
  }
  if (b.secret !== secret) {
    return NextResponse.json({ ok: false, error: "Zły sekret." }, { status: 401 });
  }

  if (b.action === "delete" && b.slug) {
    const client = await prisma.client.findUnique({ where: { slug: b.slug } });
    if (!client) {
      return NextResponse.json({ ok: false, error: "Nie znaleziono." }, { status: 404 });
    }
    await prisma.client.delete({ where: { id: client.id } });
    revalidatePath("/");
    revalidatePath("/klienci");
    return NextResponse.json({ ok: true, deleted: client.name });
  }

  if (b.action === "deleteSales" && b.productName) {
    const res = await prisma.sale.deleteMany({
      where: {
        productName: b.productName,
        ...(b.variant ? { variant: b.variant } : {}),
      },
    });
    revalidatePath("/");
    revalidatePath("/sprzedaz");
    revalidatePath("/klienci");
    return NextResponse.json({ ok: true, deleted: res.count });
  }

  if (b.action === "addRecipient" && b.name) {
    await prisma.recipient.create({
      data: {
        name: b.name,
        phone: b.phone?.trim() || null,
        email: b.email?.trim() || null,
        saleAlerts: b.saleAlerts ?? true,
        weeklyReport: b.weeklyReport ?? true,
      },
    });
    revalidatePath("/powiadomienia");
    return NextResponse.json({ ok: true, added: b.name });
  }

  // Realny test SMS na jeden numer (omija globalny przełącznik symulacji).
  if (b.action === "testSms" && b.phone) {
    const token = process.env.SMSAPI_TOKEN;
    if (!token) {
      return NextResponse.json({ ok: false, error: "Brak SMSAPI_TOKEN" }, { status: 400 });
    }
    const body = new URLSearchParams({
      to: b.phone,
      message: b.text || "Furnito: testowy SMS z panelu.",
      format: "json",
    });
    if (process.env.SMSAPI_FROM) body.set("from", process.env.SMSAPI_FROM);
    const res = await fetch("https://api.smsapi.pl/sms.do", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = (await res.json()) as { error?: number; message?: string };
    return NextResponse.json({ ok: res.ok && !data.error, response: data });
  }

  return NextResponse.json({ ok: false, error: "Nieznana akcja." }, { status: 400 });
}
