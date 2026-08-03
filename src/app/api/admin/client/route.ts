import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Administracja klientami (chronione sekretem = SHEETS_WEBHOOK_SECRET).
 * Body: { secret, action: "delete", slug }
 */
type Body = { secret?: string; action?: string; slug?: string };

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

  return NextResponse.json({ ok: false, error: "Nieznana akcja." }, { status: 400 });
}
