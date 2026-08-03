"use client";

import { useActionState } from "react";
import { Send, CheckCircle2, XCircle } from "lucide-react";
import { sendSalesSummaryAction, type SummaryState } from "@/app/actions";

const inputCls =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

type ClientOpt = { slug: string; name: string };
type RecipientOpt = { id: string; name: string; phone: string | null };

/** Wybór klienta + okres + odbiorcy → wysyła krótkie podsumowanie SMS. */
export function SalesSummaryForm({
  clients,
  recipients,
}: {
  clients: ClientOpt[];
  recipients: RecipientOpt[];
}) {
  const [state, action, pending] = useActionState<SummaryState, FormData>(
    sendSalesSummaryAction,
    null,
  );
  const withPhone = recipients.filter((r) => r.phone);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow mb-1 block">Klient</span>
          <select name="client" defaultValue="" className={`${inputCls} w-full`}>
            <option value="">— wszyscy klienci —</option>
            {clients.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow mb-1 block">Okres</span>
          <select name="days" defaultValue="7" className={`${inputCls} w-full`}>
            <option value="7">Ostatni tydzień</option>
            <option value="30">Ostatnie 30 dni</option>
            <option value="90">Ostatnie 90 dni</option>
          </select>
        </label>
      </div>

      <div>
        <span className="eyebrow mb-1.5 block">Do kogo (SMS)</span>
        {withPhone.length === 0 ? (
          <p className="text-xs text-muted">Brak odbiorców z numerem telefonu.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {withPhone.map((r) => (
              <label
                key={r.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm"
              >
                <input type="checkbox" name="recipients" value={r.id} defaultChecked />
                {r.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
      >
        <Send size={14} className={pending ? "animate-pulse" : ""} />
        {pending ? "Wysyłam…" : "Wyślij podsumowanie SMS"}
      </button>

      {state && (
        <p
          className={`flex items-start gap-1.5 text-xs ${
            state.ok ? "text-brand-600" : "text-brick-500"
          }`}
        >
          {state.ok ? (
            <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
          ) : (
            <XCircle size={13} className="mt-0.5 shrink-0" />
          )}
          {state.message}
        </p>
      )}
    </form>
  );
}
