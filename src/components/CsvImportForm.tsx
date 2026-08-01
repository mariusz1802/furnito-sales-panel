"use client";

import { useActionState } from "react";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { importSalesCsvAction, type ImportState } from "@/app/actions";

const SAMPLE = `klient;produkt;wariant;kupujacy;kwota;ilosc;kanal
Meble Cezar;Wersalka AURORA;Beżowa;Kowalski;1310;1;Allegro
Komartex Meble;Narożnik 180;Szary;Nowak;2250;1;Erli`;

export function CsvImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(
    importSalesCsvAction,
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-muted">
        Wklej dane w formacie CSV. Kolumny (elastycznie):{" "}
        <span className="font-mono text-xs text-ink">
          klient, produkt, wariant, kupujacy, kwota, ilosc, kanal
        </span>
        . Separator <span className="font-mono">,</span> lub{" "}
        <span className="font-mono">;</span>.
      </p>
      <textarea
        name="csv"
        rows={8}
        required
        defaultValue={SAMPLE}
        spellCheck={false}
        className="w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
      <button
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60"
      >
        <Upload size={15} /> {pending ? "Importuję…" : "Importuj sprzedaż"}
      </button>

      {state && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            state.ok
              ? "border-brand-100 bg-brand-50 text-brand-700"
              : "border-brass-100 bg-brass-50 text-brass-600"
          }`}
        >
          <p className="flex items-center gap-1.5 font-medium">
            {state.ok ? (
              <CheckCircle2 size={15} />
            ) : (
              <AlertTriangle size={15} />
            )}
            Zaimportowano {state.imported}, pominięto {state.skipped}.
          </p>
          {state.errors.length > 0 && (
            <ul className="mt-1.5 list-inside list-disc text-xs">
              {state.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
