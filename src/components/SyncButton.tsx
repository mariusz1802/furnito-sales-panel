"use client";

import { useActionState } from "react";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { syncNowAction, type SyncState } from "@/app/actions";

export function SyncButton({
  source,
  label,
}: {
  source: "allegro" | "erli" | "sheets";
  label: string;
}) {
  const [state, action, pending] = useActionState<SyncState, FormData>(
    syncNowAction,
    null,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="source" value={source} />
      <button
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-stone-50 disabled:opacity-60"
      >
        <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
        {pending ? "Synchronizuję…" : label}
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
