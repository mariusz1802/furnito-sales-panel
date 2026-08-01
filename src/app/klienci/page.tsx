import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { getClientsWithBalances } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { BalanceCard } from "@/components/BalanceCard";
import { Money } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ opiekun?: string }>;
}) {
  const { opiekun } = await searchParams;
  const all = await getClientsWithBalances();

  // opiekunowie barteru (do segregacji)
  const owners = Array.from(
    new Set(all.map((c) => c.handledBy).filter(Boolean) as string[]),
  ).sort();

  const clients = opiekun
    ? all.filter((c) => c.handledBy === opiekun)
    : all;

  const overdrawn = clients.filter((c) => c.balance.isOverdrawn).length;
  const availableTotal = clients.reduce((a, c) => a + c.balance.available, 0);

  const sorted = [...clients].sort((a, b) => {
    if (a.balance.isOverdrawn !== b.balance.isOverdrawn)
      return a.balance.isOverdrawn ? -1 : 1;
    return b.balance.utilizationPct - a.balance.utilizationPct;
  });

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
      active
        ? "bg-ink text-white"
        : "border border-line bg-surface text-stone-600 hover:bg-stone-50"
    }`;

  return (
    <>
      <PageHeader
        eyebrow="Barter · producenci"
        title="Klienci"
        subtitle={`${clients.length} producentów · ${overdrawn} ponad stan`}
        action={
          <Link
            href="/klienci/nowy"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
          >
            <Plus size={16} /> Dodaj klienta
          </Link>
        }
      />

      {/* Segregacja po opiekunach */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
          <Users size={14} /> Opiekun:
        </span>
        <Link href="/klienci" className={chip(!opiekun)}>
          Wszyscy
        </Link>
        {owners.map((o) => (
          <Link
            key={o}
            href={`/klienci?opiekun=${encodeURIComponent(o)}`}
            className={chip(opiekun === o)}
          >
            {o}
          </Link>
        ))}
        <span className="ml-auto inline-flex items-baseline gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm">
          <span className="text-muted">Dostępne środki:</span>
          <Money
            value={availableTotal}
            display
            className={`text-lg font-semibold ${
              availableTotal < 0 ? "text-brick-500" : "text-brand-600"
            }`}
          />
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((c) => (
          <BalanceCard key={c.id} client={c} />
        ))}
      </div>
    </>
  );
}
