"use client";

import { Printer } from "lucide-react";

/** Otwiera okno druku przeglądarki → "Zapisz jako PDF". Ukrywa się na wydruku. */
export function PrintButton({ label = "Pobierz PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
    >
      <Printer size={16} /> {label}
    </button>
  );
}
