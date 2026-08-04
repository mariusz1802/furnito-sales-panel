import Link from "next/link";
import { Badge, Money } from "@/components/ui";
import {
  saleStatusLabel,
  saleStatusTone,
  marketplaceLabel,
  marketplaceTone,
} from "@/lib/labels";
import { timeAgo } from "@/lib/format";
import type { RecentSale } from "@/lib/data";

export function SalesFeed({
  sales,
  showClient = true,
}: {
  sales: RecentSale[];
  showClient?: boolean;
}) {
  if (sales.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-muted">Brak sprzedaży.</p>;
  }
  return (
    <ul className="divide-y divide-stone-100">
      {sales.map((s) => (
        <li key={s.id} className="flex items-center gap-3 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-600">
            {s.quantity > 1 ? `${s.quantity}×` : "1"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {s.productName}
              {s.variant && <span className="text-muted"> · {s.variant}</span>}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
              {showClient && (
                <Link
                  href={`/klienci/${s.clientSlug}`}
                  className="font-medium text-stone-500 hover:text-brand-600"
                >
                  {s.clientName}
                </Link>
              )}
              {s.buyer && <span>· {s.buyer}</span>}
              <span>· {s.soldAt ? timeAgo(s.soldAt) : "bez daty"}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Money value={s.amount} className="text-sm font-semibold text-ink" />
            <div className="flex items-center gap-1">
              <Badge tone={marketplaceTone[s.marketplace]}>
                {marketplaceLabel[s.marketplace] ?? s.marketplace}
              </Badge>
              {s.status !== "NEW" && (
                <Badge tone={saleStatusTone[s.status]}>
                  {saleStatusLabel[s.status]}
                </Badge>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RankingList({
  items,
  emptyText = "Brak danych.",
  metric = "units",
}: {
  items: { name: string; units: number; amount: number }[];
  emptyText?: string;
  metric?: "units" | "amount";
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{emptyText}</p>;
  }
  const max = Math.max(...items.map((i) => (metric === "units" ? i.units : i.amount)));
  return (
    <ul className="space-y-3">
      {items.map((it) => {
        const val = metric === "units" ? it.units : it.amount;
        const pct = max > 0 ? (val / max) * 100 : 0;
        return (
          <li key={it.name}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="truncate pr-2 font-medium text-ink">{it.name}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {metric === "units" ? `${it.units} szt.` : <Money value={it.amount} />}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-brand-400"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
