"use client";

import { useActionState } from "react";
import { Send, CheckCircle2, XCircle } from "lucide-react";
import { sendTestNotificationAction, type NotifyState } from "@/app/actions";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export function TestNotifyForm() {
  const [state, action, pending] = useActionState<NotifyState, FormData>(
    sendTestNotificationAction,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-2">
        <select name="channel" defaultValue="SMS" className={`${inputCls} max-w-[7rem]`}>
          <option value="SMS">SMS</option>
          <option value="EMAIL">E-mail</option>
        </select>
        <input name="to" required placeholder="numer lub e-mail" className={inputCls} />
        <button
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          <Send size={15} /> {pending ? "Wysyłam…" : "Wyślij test"}
        </button>
      </div>
      {state && (
        <p
          className={`flex items-center gap-1.5 text-sm ${
            state.ok ? "text-brand-600" : "text-brick-500"
          }`}
        >
          {state.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {state.message}
        </p>
      )}
    </form>
  );
}
