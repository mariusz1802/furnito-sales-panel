import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, TrendingDown, TrendingUp, Pencil } from "lucide-react";
import { getClientBySlug } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Card, Badge, ProgressBar, Money, Swatch, SectionTitle } from "@/components/ui";
import { SalesFeed } from "@/components/lists";
import { balanceTone } from "@/lib/barter";
import {
  clientStatusLabel,
  clientStatusTone,
  marketplaceLabel,
} from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { addSaleAction, addServiceAction } from "@/app/actions";
import type { RecentSale } from "@/lib/data";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const b = client.balance;
  const tone = balanceTone(b);
  const toneText =
    tone === "over"
      ? "text-brick-500"
      : tone === "warn"
        ? "text-brass-600"
        : "text-brand-600";
  const marketplaces = client.marketplaces
    ? client.marketplaces.split(",").filter(Boolean)
    : [];

  const salesForFeed: RecentSale[] = client.sales.map((s) => ({
    id: s.id,
    productName: s.productName,
    variant: s.variant,
    buyer: s.buyer,
    amount: s.amount,
    quantity: s.quantity,
    marketplace: s.marketplace,
    status: s.status,
    producer: s.producer,
    soldAt: s.soldAt,
    clientName: client.name,
    clientSlug: client.slug,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Klient barter"
        title={client.name}
        action={
          <div className="flex items-center gap-2">
            {client.sheetUrl && (
              <a
                href={client.sheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-stone-50"
              >
                <ExternalLink size={15} /> Arkusz
              </a>
            )}
            <Link
              href={`/klienci/${client.slug}/edytuj`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-stone-50"
            >
              <Pencil size={15} /> Edytuj
            </Link>
            <Link
              href="/klienci"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-stone-50"
            >
              <ArrowLeft size={16} /> Klienci
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Saldo */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-start gap-4">
            <Swatch seed={client.slug} size={56} />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={clientStatusTone[client.status]}>
                  {clientStatusLabel[client.status]}
                </Badge>
                {marketplaces.map((m) => (
                  <Badge key={m}>{marketplaceLabel[m] ?? m}</Badge>
                ))}
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <span className="eyebrow">
                  {b.isOverdrawn ? "Ponad stan barteru" : "Dostępne środki"}
                </span>
                <span className={`flex items-center gap-1 text-sm font-medium ${toneText}`}>
                  {b.isOverdrawn ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                  {b.utilizationPct.toFixed(0)}% wykorzystania
                </span>
              </div>
              <p className={`mt-1 font-display text-4xl font-semibold tracking-tight ${toneText}`}>
                <Money value={Math.abs(b.available)} />
              </p>
              <div className="mt-3">
                <ProgressBar value={b.utilizationPct} tone={tone} />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-3">
                <div>
                  <p className="eyebrow">Usługi zrealizowane</p>
                  <p className="mt-0.5 font-medium text-ink">
                    <Money value={b.deliveredServices} />
                  </p>
                </div>
                <div>
                  <p className="eyebrow">Sprzedane</p>
                  <p className="mt-0.5 font-medium text-ink">
                    <Money value={b.soldFurniture} />
                  </p>
                </div>
                {client.barterLimit ? (
                  <div>
                    <p className="eyebrow">Limit</p>
                    <p className="mt-0.5 font-medium text-ink">
                      <Money value={client.barterLimit} />
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        {/* Notatki */}
        <Card className="p-6">
          <SectionTitle title="Notatki" />
          {client.notes ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
              {client.notes}
            </p>
          ) : (
            <p className="text-sm text-muted">Brak notatek.</p>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sprzedaż */}
        <div>
          <SectionTitle eyebrow="Meble" title={`Sprzedaż (${client.sales.length})`} />
          <Card className="mb-4 p-4">
            <form action={addSaleAction} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="clientId" value={client.id} />
              <input name="productName" required placeholder="Produkt *" className={`col-span-2 ${inputCls}`} />
              <input name="variant" placeholder="Kolor / tkanina" className={inputCls} />
              <input name="buyer" placeholder="Nabywca" className={inputCls} />
              <input name="amount" inputMode="decimal" required placeholder="Kwota *" className={inputCls} />
              <select name="marketplace" defaultValue="ALLEGRO" className={inputCls}>
                <option value="ALLEGRO">Allegro</option>
                <option value="ERLI">Erli</option>
                <option value="MANUAL">Ręcznie</option>
              </select>
              <button className="col-span-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600">
                Dodaj sprzedaż (wyśle powiadomienie)
              </button>
            </form>
          </Card>
          <Card className="px-4 py-1">
            <SalesFeed sales={salesForFeed} showClient={false} />
          </Card>
        </div>

        {/* Usługi */}
        <div>
          <SectionTitle eyebrow="Barter AD Awards" title={`Usługi (${client.services.length})`} />
          <Card className="mb-4 p-4">
            <form action={addServiceAction} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="clientId" value={client.id} />
              <input name="name" required placeholder="Nazwa usługi *" className={`col-span-2 ${inputCls}`} />
              <input name="amount" inputMode="decimal" required placeholder="Kwota *" className={inputCls} />
              <input name="period" placeholder="Okres (np. VII 2026)" className={inputCls} />
              <select name="status" defaultValue="DELIVERED" className={`col-span-2 ${inputCls}`}>
                <option value="DELIVERED">Dostarczona</option>
                <option value="PLANNED">Planowana</option>
              </select>
              <button className="col-span-2 rounded-lg border border-brand-500 px-3 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50">
                Dodaj usługę
              </button>
            </form>
          </Card>
          <Card className="divide-y divide-stone-100 px-4">
            {client.services.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">Brak usług.</p>
            )}
            {client.services.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-muted">
                    {s.period ? `${s.period} · ` : ""}
                    {formatDate(s.date)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.status === "PLANNED" && (
                    <Badge tone="bg-brass-50 text-brass-600 ring-brass-100">
                      planowana
                    </Badge>
                  )}
                  <Money value={s.amount} className="text-sm font-semibold text-ink" />
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
