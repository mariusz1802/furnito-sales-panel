import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui";
import { createClientAction } from "@/app/actions";

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const labelCls = "block text-sm font-medium text-ink";

export default function NewClientPage() {
  return (
    <>
      <PageHeader
        eyebrow="Barter · nowy"
        title="Dodaj klienta"
        subtitle="Nowy producent w barterze. Saldo policzy się automatycznie z usług i sprzedaży."
        action={
          <Link
            href="/klienci"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-stone-50"
          >
            <ArrowLeft size={16} /> Wróć
          </Link>
        }
      />

      <Card className="max-w-3xl p-6">
        <form action={createClientAction} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className={labelCls}>
              Nazwa producenta *
            </label>
            <input id="name" name="name" required placeholder="np. Meble Cezar" className={`mt-1.5 ${inputCls}`} />
          </div>

          <div>
            <label htmlFor="status" className={labelCls}>
              Status
            </label>
            <select id="status" name="status" defaultValue="ACTIVE" className={`mt-1.5 ${inputCls}`}>
              <option value="ACTIVE">Aktywny</option>
              <option value="TEMPORARY">Tymczasowo</option>
              <option value="PROSPECT">Do podpisania</option>
              <option value="PAUSED">Wstrzymany</option>
            </select>
          </div>

          <div>
            <label htmlFor="handledBy" className={labelCls}>
              Prowadzi
            </label>
            <input id="handledBy" name="handledBy" placeholder="np. Darek" className={`mt-1.5 ${inputCls}`} />
          </div>

          <div>
            <span className={labelCls}>Kanały sprzedaży</span>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="marketplaces" value="ALLEGRO" defaultChecked className="h-4 w-4 rounded border-line text-brand-500 focus:ring-brand-300" />
                Allegro
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="marketplaces" value="ERLI" className="h-4 w-4 rounded border-line text-brand-500 focus:ring-brand-300" />
                Erli
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="barterLimit" className={labelCls}>
              Limit barteru (zł)
            </label>
            <input id="barterLimit" name="barterLimit" inputMode="decimal" placeholder="np. 31000" className={`mt-1.5 ${inputCls}`} />
          </div>

          <div>
            <label htmlFor="startServiceAmount" className={labelCls}>
              Wartość dostarczonych usług (zł)
            </label>
            <input id="startServiceAmount" name="startServiceAmount" inputMode="decimal" placeholder="np. 18000" className={`mt-1.5 ${inputCls}`} />
            <p className="mt-1 text-xs text-muted">
              Startowa wartość barteru AD Awards. Kolejne usługi dodasz na karcie klienta.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="sheetUrl" className={labelCls}>
              Link do arkusza Google
            </label>
            <input id="sheetUrl" name="sheetUrl" type="url" placeholder="https://docs.google.com/…" className={`mt-1.5 ${inputCls}`} />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="notes" className={labelCls}>
              Notatki
            </label>
            <textarea id="notes" name="notes" rows={3} placeholder="Zasady dostaw, magazyn, ustalenia…" className={`mt-1.5 ${inputCls}`} />
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
            >
              Zapisz klienta
            </button>
            <Link href="/klienci" className="text-sm font-medium text-muted hover:text-ink">
              Anuluj
            </Link>
          </div>
        </form>
      </Card>
    </>
  );
}
