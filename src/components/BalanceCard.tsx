import Link from "next/link";
import {
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Card, Badge, ProgressBar, Money, Swatch } from "@/components/ui";
import { balanceTone } from "@/lib/barter";
import { clientStatusLabel, clientStatusTone, marketplaceLabel } from "@/lib/labels";
import { timeAgo } from "@/lib/format";
import type { ClientWithBalance } from "@/lib/data";

export function BalanceCard({ client }: { client: ClientWithBalance }) {
  const b = client.balance;
  const tone = balanceTone(b);
  const toneText =
    tone === "over"
      ? "text-brick-500"
      : tone === "warn"
        ? "text-brass-600"
        : "text-brand-600";

  return (
    <Card className="animate-rise flex flex-col p-5">
      <div className="flex items-start gap-3">
        <Swatch seed={client.slug} size={40} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/klienci/${client.slug}`}
            className="group flex items-center gap-1 font-medium text-ink hover:text-brand-600"
          >
            <span className="truncate">{client.name}</span>
            <ArrowUpRight
              size={15}
              className="shrink-0 text-stone-300 transition group-hover:text-brand-500"
            />
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={clientStatusTone[client.status]}>
              {clientStatusLabel[client.status]}
            </Badge>
            {client.marketplaces.map((m) => (
              <Badge key={m}>{marketplaceLabel[m] ?? m}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">
            {b.isOverdrawn ? "Ponad stan" : "Dostępne środki"}
          </span>
          <span className={`flex items-center gap-1 text-xs font-medium ${toneText}`}>
            {b.isOverdrawn ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
            {b.utilizationPct.toFixed(0)}%
          </span>
        </div>
        <p className={`mt-1 font-display text-3xl font-semibold tracking-tight ${toneText}`}>
          <Money value={Math.abs(b.available)} />
        </p>
        <div className="mt-2.5">
          <ProgressBar value={b.utilizationPct} tone={tone} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
        <div>
          <p className="text-xs text-muted">Usługi zrealizowane</p>
          <p className="font-medium text-ink">
            <Money value={b.deliveredServices} />
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">Sprzedane meble</p>
          <p className="font-medium text-ink">
            <Money value={b.soldFurniture} />
          </p>
        </div>
      </div>

      {b.hasOrdersDiscrepancy && (
        <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-brass-50 px-3 py-2 text-xs text-brass-600 ring-1 ring-brass-100">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            Arkusz na żywo odbiega od Moniki o{" "}
            <strong>
              {b.ordersDiscrepancy > 0 ? "+" : "−"}
              <Money value={Math.abs(b.ordersDiscrepancy)} />
            </strong>
            <br />
            <span className="text-brass-600">
              Monika (źródło prawdy): <Money value={b.monikaOrdersTotal ?? 0} /> ·
              na żywo: <Money value={b.liveOrdersTotal} />
            </span>
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>
          {client.salesCount} sprzedaży
          {client.handledBy && <span> · opiekun: {client.handledBy}</span>}
        </span>
        {client.lastSaleAt ? (
          <span className="flex items-center gap-1">
            <Clock size={12} /> {timeAgo(client.lastSaleAt)}
          </span>
        ) : (
          <span>brak sprzedaży</span>
        )}
      </div>

      {client.barterLimit ? (
        <div className="mt-3 rounded-lg bg-brand-50/60 px-3 py-2 text-xs text-muted">
          Limit barteru: <Money value={client.barterLimit} className="text-ink" />
          {b.limitUsedPct != null && (
            <span className="ml-1">({b.limitUsedPct.toFixed(0)}% wykorzystane)</span>
          )}
        </div>
      ) : null}
    </Card>
  );
}
