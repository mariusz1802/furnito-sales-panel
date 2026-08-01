import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui";
import { updateClientAction, deleteClientAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";
const labelCls = "block text-sm font-medium text-ink";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await prisma.client.findUnique({ where: { slug } });
  if (!client) notFound();
  const markets = client.marketplaces?.split(",").filter(Boolean) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Klient · edycja"
        title={`Edytuj: ${client.name}`}
        action={
          <Link
            href={`/klienci/${client.slug}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-stone-50"
          >
            <ArrowLeft size={16} /> Wróć
          </Link>
        }
      />

      <Card className="max-w-3xl p-6">
        <form action={updateClientAction} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <input type="hidden" name="id" value={client.id} />
          <div className="sm:col-span-2">
            <label htmlFor="name" className={labelCls}>Nazwa</label>
            <input id="name" name="name" defaultValue={client.name} className={`mt-1.5 ${inputCls}`} />
          </div>
          <div>
            <label htmlFor="status" className={labelCls}>Status</label>
            <select id="status" name="status" defaultValue={client.status} className={`mt-1.5 ${inputCls}`}>
              <option value="ACTIVE">Aktywny</option>
              <option value="TEMPORARY">Tymczasowo</option>
              <option value="PROSPECT">Do podpisania</option>
              <option value="PAUSED">Wstrzymany</option>
            </select>
          </div>
          <div>
            <label htmlFor="handledBy" className={labelCls}>Opiekun</label>
            <input id="handledBy" name="handledBy" defaultValue={client.handledBy ?? ""} className={`mt-1.5 ${inputCls}`} />
          </div>
          <div>
            <span className={labelCls}>Kanały</span>
            <div className="mt-2 flex gap-4">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="marketplaces" value="ALLEGRO" defaultChecked={markets.includes("ALLEGRO")} className="h-4 w-4 rounded border-line text-brand-500" />
                Allegro
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="marketplaces" value="ERLI" defaultChecked={markets.includes("ERLI")} className="h-4 w-4 rounded border-line text-brand-500" />
                Erli
              </label>
            </div>
          </div>
          <div>
            <label htmlFor="barterLimit" className={labelCls}>Limit barteru (zł)</label>
            <input id="barterLimit" name="barterLimit" defaultValue={client.barterLimit ?? ""} inputMode="decimal" className={`mt-1.5 ${inputCls}`} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="sheetUrl" className={labelCls}>Link do arkusza Google</label>
            <input id="sheetUrl" name="sheetUrl" type="url" defaultValue={client.sheetUrl ?? ""} className={`mt-1.5 ${inputCls}`} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className={labelCls}>Notatki</label>
            <textarea id="notes" name="notes" rows={3} defaultValue={client.notes ?? ""} className={`mt-1.5 ${inputCls}`} />
          </div>
          <div className="sm:col-span-2">
            <button className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600">
              Zapisz zmiany
            </button>
          </div>
        </form>
      </Card>

      <Card className="mt-4 max-w-3xl border-brick-100 bg-brick-50/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-ink">Usuń klienta</p>
            <p className="text-sm text-muted">
              Usuwa producenta wraz z jego sprzedażą i usługami. Nieodwracalne.
            </p>
          </div>
          <form action={deleteClientAction}>
            <input type="hidden" name="id" value={client.id} />
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-brick-200 bg-surface px-3.5 py-2 text-sm font-medium text-brick-600 transition hover:bg-brick-50">
              <Trash2 size={15} /> Usuń
            </button>
          </form>
        </div>
      </Card>
    </>
  );
}
