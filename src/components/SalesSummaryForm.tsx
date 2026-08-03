"use client";

import { useActionState } from "react";
import { Send, CheckCircle2, XCircle } from "lucide-react";
import { sendSalesSummaryAction, type SummaryState } from "@/app/actions";

const inputCls =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

/** Wysyła krótkie podsumowanie sprzedaży SMS-em do odbiorców z numerem telefonu. */
export function SalesSummaryForm() {
  const [state, action, pending] = useActionState<SummaryState, FormData>(
    sendSalesSummaryAction,
    null,
  );
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted">Okres:</label>
        <select name="days" defaultValue="30" className={inputCls}>
          <option value="7">Ostatni tydzień</option>
          <option value="30">Ostatnie 30 dni</option>
          <option value="90">Ostatnie 90 dni</option>
        </select>
        <button
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
        >
          <Send size={14} className={pending ? "animate-pulse" : ""} />
          {pending ? "Wysyłam…" : "Wyślij podsumowanie SMS"}
        </button>
      </div>
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
