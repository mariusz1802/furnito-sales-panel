"use client";

const iso = (d: Date) => d.toISOString().slice(0, 10);

const PRESETS: { label: string; apply: (d: Date) => void }[] = [
  { label: "Ostatni tydzień", apply: (d) => d.setDate(d.getDate() - 7) },
  { label: "Ostatni miesiąc", apply: (d) => d.setMonth(d.getMonth() - 1) },
  { label: "Ostatnie pół roku", apply: (d) => d.setMonth(d.getMonth() - 6) },
  { label: "Ostatni rok", apply: (d) => d.setFullYear(d.getFullYear() - 1) },
];

/**
 * Szybkie zakresy dat dla raportu. Ustawia pola from/to w formularzu (#report-form)
 * i wysyła je — dla aktualnie wybranego w liście klienta.
 */
export function RangePresets() {
  const pick = (apply: (d: Date) => void) => {
    const form = document.getElementById("report-form") as HTMLFormElement | null;
    if (!form) return;
    const to = new Date();
    const from = new Date();
    apply(from);
    const fromEl = form.querySelector<HTMLInputElement>('input[name="from"]');
    const toEl = form.querySelector<HTMLInputElement>('input[name="to"]');
    if (fromEl) fromEl.value = iso(from);
    if (toEl) toEl.value = iso(to);
    form.requestSubmit();
  };

  return (
    <div className="no-print mt-3 flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => pick(p.apply)}
          className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-stone-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
