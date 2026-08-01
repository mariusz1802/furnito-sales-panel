"use client";

import { RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="font-display text-2xl font-semibold text-ink">Coś poszło nie tak</h1>
      <p className="mt-1 max-w-md text-sm text-muted">
        {error.message || "Wystąpił nieoczekiwany błąd."}
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
      >
        <RotateCcw size={16} /> Spróbuj ponownie
      </button>
    </div>
  );
}
