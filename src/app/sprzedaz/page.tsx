import { prisma } from "@/lib/prisma";
import { getRecentSales, getDashboardSummary } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Card, StatCard, SectionTitle, Money } from "@/components/ui";
import { SalesFeed } from "@/components/lists";
import { addSaleAction } from "@/app/actions";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ShoppingBag, CalendarDays, Package } from "lucide-react";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export default async function SalesPage() {
  const [sales, summary, clients] = await Promise.all([
    getRecentSales(60),
    getDashboardSummary(),
    prisma.client.findMany({
      where: { status: { not: "PAUSED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <LiveRefresh seconds={15} />
      <PageHeader
        eyebrow="Sprzedaż · Allegro & Erli"
        title="Sprzedaż"
        subtitle="Zamówienia spływają tu z integracji lub dodasz je ręcznie. Każde nowe wyśle powiadomienie."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="W tym tygodniu"
          value={<Money value={summary.salesThisWeek.amount} />}
          icon={<CalendarDays size={20} />}
          hint={`${summary.salesThisWeek.count} zamówień · ${summary.salesThisWeek.units} szt.`}
        />
        <StatCard
          label="Poprzedni tydzień"
          value={<Money value={summary.salesLastWeek.amount} />}
          icon={<ShoppingBag size={20} />}
          hint={`${summary.salesLastWeek.count} zamówień`}
        />
        <StatCard
          label="Sprzedane meble (łącznie)"
          value={<Money value={summary.soldFurnitureTotal} />}
          icon={<Package size={20} />}
          hint="wszyscy klienci"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <SectionTitle eyebrow="Ręcznie" title="Dodaj sprzedaż" />
          <Card className="p-4">
            <form action={addSaleAction} className="grid grid-cols-2 gap-2">
              <select name="clientId" required defaultValue="" className={`col-span-2 ${inputCls}`}>
                <option value="" disabled>
                  Wybierz klienta *
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input name="productName" required placeholder="Produkt *" className={`col-span-2 ${inputCls}`} />
              <input name="variant" placeholder="Kolor / tkanina" className={inputCls} />
              <input name="buyer" placeholder="Nabywca" className={inputCls} />
              <input name="amount" inputMode="decimal" required placeholder="Kwota *" className={inputCls} />
              <input name="quantity" inputMode="numeric" defaultValue={1} placeholder="Ilość" className={inputCls} />
              <select name="marketplace" defaultValue="ALLEGRO" className={`col-span-2 ${inputCls}`}>
                <option value="ALLEGRO">Allegro</option>
                <option value="ERLI">Erli</option>
                <option value="MANUAL">Ręcznie</option>
              </select>
              <button className="col-span-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600">
                Zapisz i powiadom
              </button>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <SectionTitle eyebrow="Historia" title="Ostatnie zamówienia" />
          <Card className="px-4 py-1">
            <SalesFeed sales={sales} />
          </Card>
        </div>
      </div>
    </>
  );
}
