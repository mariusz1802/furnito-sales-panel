import { Phone, Mail, Bell, Radio, Trash2, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Card, Badge, SectionTitle } from "@/components/ui";
import { TestNotifyForm } from "@/components/TestNotifyForm";
import { SalesSummaryForm } from "@/components/SalesSummaryForm";
import {
  setSimulateAction,
  addRecipientAction,
  deleteRecipientAction,
} from "@/app/actions";
import { formatDateTime } from "@/lib/format";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export const dynamic = "force-dynamic";

const channelTone: Record<string, string> = {
  SMS: "bg-brand-50 text-brand-700 ring-brand-100",
  EMAIL: "bg-brass-50 text-brass-600 ring-brass-100",
};
const statusTone: Record<string, string> = {
  SENT: "bg-brand-50 text-brand-700 ring-brand-100",
  SIMULATED: "bg-stone-100 text-stone-500 ring-stone-200",
  FAILED: "bg-brick-50 text-brick-500 ring-brick-100",
};
const statusLabel: Record<string, string> = {
  SENT: "wysłane",
  SIMULATED: "symulacja",
  FAILED: "błąd",
};

export default async function NotificationsPage() {
  const [recipients, setting, logs, clients] = await Promise.all([
    prisma.recipient.findMany({ orderBy: { name: "asc" } }),
    prisma.setting.findUnique({ where: { key: "notifications.simulate" } }),
    prisma.notificationLog.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
  ]);
  const simulate = setting?.value !== "false";

  return (
    <>
      <PageHeader
        eyebrow="Alerty · SMS & e-mail"
        title="Powiadomienia"
        subtitle="Kto dostaje alerty o sprzedaży i raporty tygodniowe."
      />

      {/* Tryb */}
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${
              simulate ? "bg-stone-100 text-stone-500" : "bg-brand-50 text-brand-600"
            }`}
          >
            <Radio size={18} />
          </span>
          <div>
            <p className="font-medium text-ink">
              Tryb: {simulate ? "symulacja" : "wysyłka na żywo"}
            </p>
            <p className="text-sm text-muted">
              {simulate
                ? "Powiadomienia są logowane, ale nie wysyłane. Włącz wysyłkę po podłączeniu SMSAPI / e-mail w Integracjach."
                : "Powiadomienia są wysyłane realnie przez skonfigurowanych dostawców."}
            </p>
          </div>
        </div>
        <form action={setSimulateAction} className="flex items-center gap-2">
          <input type="hidden" name="simulate" value={simulate ? "false" : "true"} />
          <button className="rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-stone-50">
            {simulate ? "Włącz wysyłkę na żywo" : "Wróć do symulacji"}
          </button>
        </form>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Odbiorcy */}
        <div className="lg:col-span-2">
          <SectionTitle eyebrow="Zespół" title="Odbiorcy" />
          <Card className="divide-y divide-stone-100 px-5">
            {recipients.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 font-display text-sm font-semibold text-brand-600">
                  {r.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{r.name}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                    {r.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={12} /> {r.phone}
                      </span>
                    )}
                    {r.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={12} /> {r.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.saleAlerts && <Badge tone={channelTone.SMS}>alerty sprzedaży</Badge>}
                  {r.weeklyReport && (
                    <Badge tone={channelTone.EMAIL}>raport tygodniowy</Badge>
                  )}
                  {!r.active && <Badge>nieaktywny</Badge>}
                  <form action={deleteRecipientAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button
                      className="ml-1 rounded-md p-1.5 text-stone-400 transition hover:bg-brick-50 hover:text-brick-500"
                      aria-label={`Usuń ${r.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </form>
                </div>
              </div>
            ))}

            {/* Dodaj odbiorcę */}
            <form
              action={addRecipientAction}
              className="flex flex-wrap items-center gap-2 py-4"
            >
              <input name="name" required placeholder="Imię *" className={`${inputCls} max-w-[8rem]`} />
              <input name="phone" placeholder="Numer" className={`${inputCls} max-w-[9rem]`} />
              <input name="email" placeholder="E-mail" className={`${inputCls} max-w-[11rem]`} />
              <label className="flex items-center gap-1 text-xs text-muted">
                <input type="checkbox" name="saleAlerts" defaultChecked className="h-3.5 w-3.5 rounded border-line text-brand-500" />
                sprzedaż
              </label>
              <label className="flex items-center gap-1 text-xs text-muted">
                <input type="checkbox" name="weeklyReport" defaultChecked className="h-3.5 w-3.5 rounded border-line text-brand-500" />
                raport
              </label>
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-600">
                <UserPlus size={14} /> Dodaj
              </button>
            </form>
          </Card>
        </div>

        {/* Test */}
        <div>
          <SectionTitle eyebrow="Sprawdź" title="Wyślij test" />
          <Card className="p-5">
            <TestNotifyForm />
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
              <Bell size={13} className="mt-0.5 shrink-0" />W trybie symulacji test
              zostanie tylko zalogowany poniżej.
            </p>
          </Card>
        </div>
      </div>

      {/* Podsumowanie sprzedaży SMS */}
      <div className="mt-6">
        <SectionTitle eyebrow="Prezentacyjnie" title="Podsumowanie sprzedaży SMS" />
        <Card className="p-5">
          <p className="mb-3 text-sm text-muted">
            Wyślij do odbiorców z numerem telefonu krótkie podsumowanie: hity
            sprzedaży + trend tygodniowy. Wysyłka realna (SMS wychodzi od razu).
          </p>
          <SalesSummaryForm
            clients={clients}
            recipients={recipients.map((r) => ({ id: r.id, name: r.name, phone: r.phone }))}
          />
        </Card>
      </div>

      {/* Log */}
      <div className="mt-6">
        <SectionTitle eyebrow="Historia" title="Log powiadomień" />
        <Card className="overflow-hidden">
          {logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Jeszcze nic nie wysłano.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">Kiedy</th>
                  <th className="px-3 py-3 font-medium">Typ</th>
                  <th className="px-3 py-3 font-medium">Kanał</th>
                  <th className="px-3 py-3 font-medium">Do</th>
                  <th className="px-3 py-3 font-medium">Treść</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {logs.map((l) => (
                  <tr key={l.id} className="text-ink/90">
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                      {formatDateTime(l.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-xs">{l.type}</td>
                    <td className="px-3 py-3">
                      <Badge tone={channelTone[l.channel]}>{l.channel}</Badge>
                    </td>
                    <td className="px-3 py-3 text-xs">{l.to}</td>
                    <td className="max-w-xs truncate px-3 py-3 text-xs text-muted">
                      {l.message}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone[l.status]}>
                        {statusLabel[l.status] ?? l.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
