import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Dodanie/aktualizacja połączenia ze sklepem klienta (WooCommerce / PrestaShop).
 * Chronione sekretem (SHEETS_WEBHOOK_SECRET). Poświadczenia trafiają do bazy
 * (prywatna Prisma Postgres), nie do repo.
 *
 * Body: { secret, clientSlug, platform, baseUrl, username?, credential, active? }
 */
type Body = {
  secret?: string;
  clientSlug?: string;
  platform?: string;
  baseUrl?: string;
  username?: string | null;
  credential?: string;
  active?: boolean;
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
  if (!b.clientSlug || !b.platform || !b.baseUrl || !b.credential) {
    return NextResponse.json(
      { ok: false, error: "Wymagane: clientSlug, platform, baseUrl, credential." },
      { status: 400 },
    );
  }

  const client = await prisma.client.findUnique({ where: { slug: b.clientSlug } });
  if (!client) {
    return NextResponse.json(
      { ok: false, error: `Nie znaleziono klienta o slug "${b.clientSlug}".` },
      { status: 404 },
    );
  }

  const data = {
    platform: b.platform,
    baseUrl: b.baseUrl,
    username: b.username ?? null,
    secret: b.credential,
    active: b.active ?? true,
  };

  await prisma.storeConnection.upsert({
    where: { clientId: client.id },
    create: { clientId: client.id, ...data },
    update: data,
  });

  revalidatePath("/raporty");
  return NextResponse.json({ ok: true, client: client.name, platform: b.platform });
}
