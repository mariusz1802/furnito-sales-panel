import Link from "next/link";
import { Plus } from "lucide-react";
import { getClientsWithBalances } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { BalanceCard } from "@/components/BalanceCard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { Money } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await getClientsWithBalances();

  const overdrawn = clients.filter((c) => c.balance.isOverdrawn).length;
  const availableTotal = clients.reduce((a, c) => a + c.balance.available, 0);

  const sorted = [...clients].sort((a, b) => {
    if (a.balance.isOverdrawn !== b.balance.isOverdrawn)
      return a.balance.isOverdrawn ? -1 : 1;
    return b.balance.utilizationPct - a.balance.utilizationPct;
  });

  return (
    <>
      <LiveRefresh seconds={15} />
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

      {/* Suma dostępnych środków */}
      <div className="mb-5 flex justify-end">
        <span className="inline-flex items-baseline gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm">
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
