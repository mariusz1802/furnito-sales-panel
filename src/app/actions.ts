"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { notifyNewSale, sendSms, sendEmail } from "@/lib/notify";
import { parseSalesCsv } from "@/lib/integrations";
import { buildClientSmsSummary, buildAllStoresSmsSummary } from "@/lib/reports";
import {
  appendSaleRow,
  updateSaleRow,
  isSalesSheetConfigured,
} from "@/lib/integrations/salesSheet";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "klient";
  let slug = root;
  let n = 1;
  while (await prisma.client.findUnique({ where: { slug } })) {
    slug = `${root}-${++n}`;
  }
  return slug;
}

// ---- Klienci ------------------------------------------------------------
export async function createClientAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const marketplaces = formData.getAll("marketplaces").map(String).join(",");
  const barterLimitRaw = String(formData.get("barterLimit") ?? "").replace(",", ".");
  const barterLimit = barterLimitRaw ? Number(barterLimitRaw) : null;

  const client = await prisma.client.create({
    data: {
      name,
      slug: await uniqueSlug(name),
      status: (String(formData.get("status")) as never) || "ACTIVE",
      barterLimit: Number.isFinite(barterLimit as number) ? barterLimit : null,
      marketplaces,
      handledBy: String(formData.get("handledBy") ?? "").trim() || null,
      sheetUrl: String(formData.get("sheetUrl") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  // opcjonalna usługa startowa (wartość barteru)
  const startService = String(formData.get("startServiceAmount") ?? "").replace(",", ".");
  const amt = Number(startService);
  if (Number.isFinite(amt) && amt > 0) {
    await prisma.service.create({
      data: { clientId: client.id, name: "Barter startowy", amount: amt },
    });
  }

  revalidatePath("/");
  revalidatePath("/klienci");
  redirect(`/klienci/${client.slug}`);
}

// ---- Sprzedaż -----------------------------------------------------------
export async function addSaleAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const productName = String(formData.get("productName") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").replace(",", "."));
  if (!clientId || !productName || !Number.isFinite(amount) || amount <= 0) return;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return;

  const variant = String(formData.get("variant") ?? "").trim() || null;
  const marketplace = (String(formData.get("marketplace")) as never) || "MANUAL";
  const buyer = String(formData.get("buyer") ?? "").trim() || null;

  const sale = await prisma.sale.create({
    data: {
      clientId,
      productName,
      variant,
      fabric: String(formData.get("fabric") ?? "").trim() || null,
      buyer,
      amount,
      quantity: Number(formData.get("quantity")) || 1,
      marketplace,
    },
  });

  // aplikacja → arkusz: dopisz wiersz i zapamiętaj jego numer (best-effort)
  await pushSaleToSheet(sale.id, {
    productName,
    producer: client.name,
    marketplace,
    status: "NEW",
    amount,
    buyer,
    soldAt: sale.soldAt,
  });

  // powiadomienie o nowej sprzedaży (SMS + e-mail wg preferencji odbiorców)
  await notifyNewSale({
    clientName: client.name,
    productName,
    variant,
    amount,
    marketplace: String(marketplace),
  });

  revalidatePath("/");
  revalidatePath("/sprzedaz");
  revalidatePath(`/klienci/${client.slug}`);
}

/**
 * Zapis pojedynczej sprzedaży do arkusza sprzedażowego (append) i zapamiętanie
 * numeru wiersza. Best-effort: brak konfiguracji lub błąd nie blokuje akcji.
 */
async function pushSaleToSheet(
  saleId: string,
  data: Parameters<typeof appendSaleRow>[0],
): Promise<void> {
  if (!isSalesSheetConfigured()) return;
  try {
    const r = await appendSaleRow(data);
    if (r.ok && r.sheetRow) {
      await prisma.sale.update({
        where: { id: saleId },
        data: { sheetRow: r.sheetRow, lastSyncedFromApp: new Date() },
      });
    }
  } catch {
    // arkusz niedostępny — sprzedaż i tak zapisana w bazie
  }
}

// ---- Usługi (barter dostarczony) ---------------------------------------
export async function addServiceAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").replace(",", "."));
  if (!clientId || !name || !Number.isFinite(amount) || amount <= 0) return;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return;

  await prisma.service.create({
    data: {
      clientId,
      name,
      amount,
      status: (String(formData.get("status")) as never) || "DELIVERED",
      period: String(formData.get("period") ?? "").trim() || null,
    },
  });

  revalidatePath("/");
  revalidatePath(`/klienci/${client.slug}`);
}

// ---- Powiadomienia ------------------------------------------------------
export type NotifyState = { ok: boolean; message: string } | null;

export async function sendTestNotificationAction(
  _prev: NotifyState,
  formData: FormData,
): Promise<NotifyState> {
  const channel = String(formData.get("channel") ?? "SMS");
  const to = String(formData.get("to") ?? "").trim();
  if (!to) return { ok: false, message: "Podaj numer lub e-mail." };

  const text = "Furnito: to jest testowe powiadomienie z panelu.";
  const res =
    channel === "EMAIL"
      ? await sendEmail(to, "Test Furnito", text, "TEST")
      : await sendSms(to, text, "TEST");

  revalidatePath("/powiadomienia");
  const label =
    res.status === "SIMULATED"
      ? "zasymulowane (tryb testowy — brak kluczy API)"
      : res.status === "SENT"
        ? "wysłane"
        : `błąd: ${res.error}`;
  return { ok: res.status !== "FAILED", message: `Powiadomienie ${label}.` };
}

// ---- Podsumowanie sprzedaży SMS (prezentacyjnie) -----------------------
export type SummaryState = { ok: boolean; message: string } | null;

export async function sendSalesSummaryAction(
  _prev: SummaryState,
  formData: FormData,
): Promise<SummaryState> {
  const days = Number(formData.get("days")) || 30;
  const client = String(formData.get("client") ?? "") || undefined;
  const ids = formData.getAll("recipients").map(String).filter(Boolean);
  // wybrany klient → schemat SKLEP + FURNITO; brak → zbiorczo (SKLEPY + BARTER)
  const text = client
    ? await buildClientSmsSummary(client, days)
    : await buildAllStoresSmsSummary(days);

  const recipients = await prisma.recipient.findMany({
    where: { id: { in: ids }, phone: { not: null } },
  });
  if (recipients.length === 0)
    return {
      ok: false,
      message: "Zaznacz przynajmniej jednego odbiorcę z numerem telefonu.",
    };

  const results = [];
  for (const r of recipients) {
    if (r.phone) results.push(await sendSms(r.phone, text, "SALES_SUMMARY", true));
  }
  const sent = results.filter((r) => r.status === "SENT").length;
  revalidatePath("/powiadomienia");
  return {
    ok: sent > 0,
    message: `Wysłano ${sent}/${results.length} SMS. Treść: „${text}"`,
  };
}

export async function setSimulateAction(formData: FormData) {
  const value = String(formData.get("simulate") ?? "true");
  await prisma.setting.upsert({
    where: { key: "notifications.simulate" },
    update: { value },
    create: { key: "notifications.simulate", value },
  });
  revalidatePath("/powiadomienia");
  revalidatePath("/integracje");
}

// ---- Import CSV ---------------------------------------------------------
export type ImportState = {
  ok: boolean;
  imported: number;
  skipped: number;
  errors: string[];
} | null;

export async function importSalesCsvAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const text = String(formData.get("csv") ?? "");
  const rows = parseSalesCsv(text);
  if (rows.length === 0)
    return { ok: false, imported: 0, skipped: 0, errors: ["Pusty lub błędny CSV."] };

  const clients = await prisma.client.findMany({
    select: { id: true, name: true, slug: true },
  });
  const match = (hint: string) => {
    const h = hint.toLowerCase();
    return clients.find(
      (c) => c.name.toLowerCase().includes(h) || h.includes(c.slug.replace(/-/g, " ")),
    );
  };

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const touched = new Set<string>();

  for (const [i, r] of rows.entries()) {
    if (!r.ok) {
      skipped++;
      errors.push(`Wiersz ${i + 2}: ${r.error}`);
      continue;
    }
    const client = match(r.clientHint);
    if (!client) {
      skipped++;
      errors.push(`Wiersz ${i + 2}: nie dopasowano klienta "${r.clientHint}"`);
      continue;
    }
    await prisma.sale.create({
      data: {
        clientId: client.id,
        productName: r.productName,
        variant: r.variant,
        buyer: r.buyer,
        amount: r.amount,
        quantity: r.quantity,
        marketplace: r.marketplace as never,
      },
    });
    touched.add(client.slug);
    imported++;
  }

  revalidatePath("/");
  revalidatePath("/sprzedaz");
  touched.forEach((slug) => revalidatePath(`/klienci/${slug}`));
  return { ok: imported > 0, imported, skipped, errors: errors.slice(0, 8) };
}

// ---- Odbiorcy powiadomień ----------------------------------------------
export async function addRecipientAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.recipient.create({
    data: {
      name,
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      saleAlerts: formData.get("saleAlerts") === "on",
      weeklyReport: formData.get("weeklyReport") === "on",
    },
  });
  revalidatePath("/powiadomienia");
}

export async function deleteRecipientAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await prisma.recipient.delete({ where: { id } }).catch(() => {});
  revalidatePath("/powiadomienia");
}

// ---- Edycja / usuwanie klienta -----------------------------------------
export async function updateClientAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return;

  const barterLimitRaw = String(formData.get("barterLimit") ?? "").replace(",", ".");
  const barterLimit = barterLimitRaw ? Number(barterLimitRaw) : null;

  await prisma.client.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? client.name).trim() || client.name,
      status: (String(formData.get("status")) as never) || client.status,
      handledBy: String(formData.get("handledBy") ?? "").trim() || null,
      barterLimit: Number.isFinite(barterLimit as number) ? barterLimit : null,
      marketplaces: formData.getAll("marketplaces").map(String).join(","),
      sheetUrl: String(formData.get("sheetUrl") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  revalidatePath("/");
  revalidatePath("/klienci");
  revalidatePath(`/klienci/${client.slug}`);
}

export async function deleteClientAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await prisma.client.delete({ where: { id } }).catch(() => {});
  revalidatePath("/");
  revalidatePath("/klienci");
  redirect("/klienci");
}

// ---- Zmiana statusu sprzedaży ------------------------------------------
export async function updateSaleStatusAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !status) return;
  const sale = await prisma.sale
    .update({
      where: { id },
      data: { status: status as never },
      include: { client: { select: { name: true } } },
    })
    .catch(() => null);

  // aplikacja → arkusz: zaktualizuj wiersz, jeśli sprzedaż jest z niego sparowana
  if (sale?.sheetRow && isSalesSheetConfigured()) {
    try {
      const r = await updateSaleRow(sale.sheetRow, {
        productName: sale.productName,
        producer: sale.producer ?? sale.client?.name,
        barterAmount: sale.barterAmount,
        channel: sale.channel,
        marketplace: sale.marketplace,
        status: sale.status,
        amount: sale.amount,
        transportAmount: sale.transportAmount,
        cashStatus: sale.cashStatus,
        soldAt: sale.soldAt,
        shippedAt: sale.shippedAt,
        receivedAt: sale.receivedAt,
        buyer: sale.buyer,
      });
      if (r.ok) {
        await prisma.sale.update({
          where: { id },
          data: { lastSyncedFromApp: new Date() },
        });
      }
    } catch {
      // arkusz niedostępny — status i tak zapisany w bazie
    }
  }

  revalidatePath("/sprzedaz");
  revalidatePath("/");
}

// ---- Synchronizacja z integracjami -------------------------------------
export type SyncState = { ok: boolean; message: string } | null;

export async function syncNowAction(
  _prev: SyncState,
  formData: FormData,
): Promise<SyncState> {
  const source = String(formData.get("source") ?? "");
  let msg = "Nieznane źródło.";
  let ok = false;

  if (source === "allegro") {
    const { syncAllegroOrders } = await import("@/lib/integrations/allegro");
    const r = await syncAllegroOrders();
    ok = r.ok;
    msg = r.ok
      ? `Allegro: pobrano ${r.fetched}, nowych ${r.imported}, zaktualizowanych ${r.updated}.`
      : `Allegro: ${r.error}`;
  } else if (source === "erli") {
    const { syncErliOrders } = await import("@/lib/integrations/erli");
    const r = await syncErliOrders();
    ok = r.ok;
    msg = r.ok
      ? `Erli: pobrano ${r.fetched}, nowych ${r.imported}, zaktualizowanych ${r.updated}.`
      : `Erli: ${r.error}`;
  } else if (source === "sheets") {
    const { syncAllSheets } = await import("@/lib/integrations/sheets");
    const { reconcileSalesSheet } = await import("@/lib/integrations/salesSheet");
    const [barter, sales] = await Promise.all([
      syncAllSheets(),
      reconcileSalesSheet(),
    ]);
    ok = barter.ok || sales.ok;
    const parts: string[] = [];
    if (barter.ok) parts.push(`arkusze barterowe: ${barter.clients} (${barter.sales} poz.)`);
    else if (barter.errors[0]) parts.push(`barter: ${barter.errors[0]}`);
    if (sales.ok) parts.push(`arkusz sprzedażowy: ${sales.upserted} zapisów, ${sales.removed} usuniętych`);
    else if (sales.error) parts.push(`sprzedażowy: ${sales.error}`);
    msg = `Google Sheets — ${parts.join(" · ")}`;
  }

  revalidatePath("/");
  revalidatePath("/integracje");
  return { ok, message: msg };
}
