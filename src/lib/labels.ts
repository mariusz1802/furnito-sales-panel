export const clientStatusLabel: Record<string, string> = {
  ACTIVE: "Aktywny",
  TEMPORARY: "Tymczasowo",
  PAUSED: "Wstrzymany",
  PROSPECT: "Do podpisania",
};

export const clientStatusTone: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  TEMPORARY: "bg-amber-50 text-amber-700 ring-amber-200",
  PAUSED: "bg-stone-100 text-stone-500 ring-stone-200",
  PROSPECT: "bg-sky-50 text-sky-700 ring-sky-200",
};

export const saleStatusLabel: Record<string, string> = {
  NEW: "Nowa",
  COMPLETED: "Zrealizowana",
  CANCELLED: "Anulowana",
  RESIGNED: "Rezygnacja",
};

export const saleStatusTone: Record<string, string> = {
  NEW: "bg-brand-50 text-brand-700 ring-brand-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-600 ring-rose-200",
  RESIGNED: "bg-rose-50 text-rose-600 ring-rose-200",
};

export const marketplaceLabel: Record<string, string> = {
  ALLEGRO: "Allegro",
  ERLI: "Erli",
  MANUAL: "Ręcznie",
  OTHER: "Inne",
};

export const marketplaceTone: Record<string, string> = {
  ALLEGRO: "bg-orange-50 text-orange-700 ring-orange-200",
  ERLI: "bg-violet-50 text-violet-700 ring-violet-200",
  MANUAL: "bg-stone-100 text-stone-600 ring-stone-200",
  OTHER: "bg-stone-100 text-stone-600 ring-stone-200",
};
