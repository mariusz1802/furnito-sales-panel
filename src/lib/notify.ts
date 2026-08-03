import { prisma } from "@/lib/prisma";
import { formatPLN } from "@/lib/format";

/**
 * Warstwa powiadomień. Domyślnie działa w trybie SYMULACJI (loguje do bazy,
 * nic nie wysyła), dopóki nie skonfigurujesz kluczy API w Integracjach / .env.
 *
 * SMS: SMSAPI.pl (https://www.smsapi.pl/docs) — ustaw SMSAPI_TOKEN + SMSAPI_FROM.
 * E-mail: dowolny provider SMTP/API — do domknięcia (SMTP_* lub RESEND_API_KEY).
 */

async function isSimulate(): Promise<boolean> {
  // Symulacja gdy brak tokenu SMSAPI lub gdy ustawienie wymusza symulację
  const setting = await prisma.setting.findUnique({
    where: { key: "notifications.simulate" },
  });
  if (setting?.value === "false") return false;
  return true;
}

export type SendResult = {
  channel: "SMS" | "EMAIL";
  to: string;
  status: "SENT" | "FAILED" | "SIMULATED";
  error?: string;
};

async function log(
  type: string,
  r: SendResult & { message: string },
): Promise<void> {
  await prisma.notificationLog.create({
    data: {
      type,
      channel: r.channel,
      to: r.to,
      message: r.message,
      status: r.status,
      error: r.error,
    },
  });
}

export async function sendSms(
  to: string,
  message: string,
  type = "MANUAL",
  force = false,
): Promise<SendResult> {
  // force = realna wysyłka niezależnie od globalnego przełącznika symulacji
  const simulate = force ? false : await isSimulate();
  const token = process.env.SMSAPI_TOKEN;
  let result: SendResult;

  if (simulate || !token) {
    result = { channel: "SMS", to, status: "SIMULATED" };
  } else {
    try {
      // SMSAPI.pl — https://www.smsapi.pl/docs
      // numer musi być czysty (bez spacji/+): "+48 577 505 536" → "48577505536"
      const num = to.replace(/[^0-9]/g, "");
      const body = new URLSearchParams({ to: num, message, format: "json" });
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
      if (!res.ok || data.error) {
        throw new Error(`SMSAPI: ${data.message ?? res.status}`);
      }
      result = { channel: "SMS", to, status: "SENT" };
    } catch (e) {
      result = {
        channel: "SMS",
        to,
        status: "FAILED",
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
  await log(type, { ...result, message });
  return result;
}

export async function sendEmail(
  to: string,
  subject: string,
  message: string,
  type = "MANUAL",
): Promise<SendResult> {
  const simulate = await isSimulate();
  const configured = !!process.env.SMTP_HOST || !!process.env.RESEND_API_KEY;
  let result: SendResult;

  if (simulate || !configured) {
    result = { channel: "EMAIL", to, status: "SIMULATED" };
  } else {
    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        // Resend — https://resend.com/docs
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM ?? "Furnito <panel@furni.to>",
            to: [to],
            subject,
            text: message,
          }),
        });
        if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
      } else {
        // SMTP skonfigurowane, ale wysyłkę SMTP podłączymy przy realnych danych serwera
        throw new Error("SMTP wysyłka nie jest jeszcze podłączona — ustaw RESEND_API_KEY");
      }
      result = { channel: "EMAIL", to, status: "SENT" };
    } catch (e) {
      result = {
        channel: "EMAIL",
        to,
        status: "FAILED",
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
  await log(type, { ...result, message: `${subject} — ${message}` });
  return result;
}

/** Powiadom wybrane osoby o nowej sprzedaży (SMS + e-mail wg preferencji). */
export async function notifyNewSale(input: {
  clientName: string;
  productName: string;
  variant?: string | null;
  amount: number;
  marketplace: string;
}): Promise<SendResult[]> {
  const recipients = await prisma.recipient.findMany({
    where: { active: true, saleAlerts: true },
  });

  const variant = input.variant ? ` (${input.variant})` : "";
  const smsText = `Furnito: sprzedano ${input.productName}${variant} — ${formatPLN(
    input.amount,
  )} · ${input.clientName} · ${input.marketplace}`;
  const emailSubject = `Nowa sprzedaż: ${input.productName}`;

  const results: SendResult[] = [];
  for (const r of recipients) {
    if (r.phone) results.push(await sendSms(r.phone, smsText, "SALE_ALERT"));
    if (r.email)
      results.push(
        await sendEmail(r.email, emailSubject, smsText, "SALE_ALERT"),
      );
  }
  return results;
}
