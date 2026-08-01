import Link from "next/link";
import {
  Users,
  Wallet,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  ArrowRight,
} from "lucide-react";
import {
  getDashboardSummary,
  getClientsWithBalances,
  getRecentSales,
  getWeeklyTimeline,
  getMarketplaceSplit,
} from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Card, StatCard, SectionTitle, Money } from "@/components/ui";
import { BalanceCard } from "@/components/BalanceCard";
import { SalesFeed } from "@/components/lists";
import { WeeklyBarChart, SplitDonut } from "@/components/charts";
import { LiveRefresh } from "@/components/LiveRefresh";
import { marketplaceLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [summary, clients, recent, weekly, split] = await Promise.all([
    getDashboardSummary(),
    getClientsWithBalances(),
    getRecentSales(8),
    getWeeklyTimeline(8),
    getMarketplaceSplit(60),
  ]);

  const weekDelta =
    summary.salesLastWeek.amount > 0
      ? ((summary.salesThisWeek.amount - summary.salesLastWeek.amount) /
          summary.salesLastWeek.amount) *
        100
      : null;

  const sortedClients = [...clients].sort((a, b) => {
    if (a.balance.isOverdrawn !== b.balance.isOverdrawn)
      return a.balance.isOverdrawn ? -1 : 1;
    return b.balance.utilizationPct - a.balance.utilizationPct;
  });

  const donutData = split.map((s) => ({
    name: marketplaceLabel[s.name] ?? s.name,
    value: s.amount,
  }));

  return (
    <>
      <LiveRefresh seconds={20} />
      <PageHeader
        eyebrow="Atelier · przegląd"
        title="Pulpit"
        subtitle="Salda barterów, stan magazynu usług i sprzedaż — w jednym miejscu."
        action={
          <Link
            href="/klienci/nowy"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
          >
            <Plus size={16} /> Dodaj klienta
          </Link>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Klienci barter"
          value={summary.totalClients}
          icon={<Users size={20} />}
          hint={`${summary.activeClients} aktywnych`}
        />
        <StatCard
          label="Usługi zrealizowane"
          value={<Money value={summary.deliveredServicesTotal} />}
          icon={<Wallet size={20} />}
          hint="łączna wartość dostarczonego barteru AD Awards"
        />
        <StatCard
          label="Sprzedane meble"
          value={<Money value={summary.soldFurnitureTotal} />}
          icon={<ShoppingBag size={20} />}
          hint={
            <span>
              dostępne środki:{" "}
              <Money
                value={summary.availableTotal}
                className={
                  summary.availableTotal < 0 ? "text-brick-500" : "text-brand-600"
                }
              />
            </span>
          }
        />
        <StatCard
          label="Sprzedaż w tym tygodniu"
          value={<Money value={summary.salesThisWeek.amount} />}
          icon={<TrendingUp size={20} />}
          hint={
            weekDelta == null ? (
              `${summary.salesThisWeek.count} zamówień`
            ) : (
              <span
                className={`inline-flex items-center gap-1 ${
                  weekDelta >= 0 ? "text-brand-600" : "text-brick-500"
                }`}
              >
                {weekDelta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {weekDelta >= 0 ? "+" : ""}
                {weekDelta.toFixed(0)}% vs poprzedni tydzień
              </span>
            )
          }
        />
      </div>

      {/* Alert ponad stan */}
      {summary.overdrawnCount > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-brick-100 bg-brick-50 p-4">
          <AlertTriangle className="mt-0.5 shrink-0 text-brick-500" size={20} />
          <div className="text-sm">
            <p className="font-medium text-brick-600">
              {summary.overdrawnCount}{" "}
              {summary.overdrawnCount === 1 ? "klient jest" : "klientów jest"} ponad
              stan barteru
            </p>
            <p className="mt-0.5 text-brick-600/80">
              Sprzedaliśmy więcej mebli niż dostarczonych usług:{" "}
              {summary.overdrawnClients.join(", ")}.
            </p>
          </div>
        </div>
      )}

      {/* Wykresy */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle
            eyebrow="Sprzedaż"
            title="Ostatnie 8 tygodni"
            subtitle="Wartość zrealizowanych zamówień tygodniowo"
          />
          <WeeklyBarChart data={weekly} />
        </Card>
        <Card className="p-5">
          <SectionTitle eyebrow="Kanały" title="Allegro vs Erli" subtitle="Ostatnie 60 dni" />
          {donutData.length > 0 ? (
            <SplitDonut data={donutData} />
          ) : (
            <p className="py-16 text-center text-sm text-muted">Brak danych.</p>
          )}
        </Card>
      </div>

      {/* Salda + feed */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionTitle
            eyebrow="Barter"
            title="Salda klientów"
            subtitle="Ile środków zostało u każdego producenta"
            action={
              <Link
                href="/klienci"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Wszyscy <ArrowRight size={15} />
              </Link>
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sortedClients.slice(0, 6).map((c) => (
              <BalanceCard key={c.id} client={c} />
            ))}
          </div>
        </div>
        <div>
          <SectionTitle
            eyebrow="Na żywo"
            title="Ostatnia sprzedaż"
            action={
              <Link
                href="/sprzedaz"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Wszystkie <ArrowRight size={15} />
              </Link>
            }
          />
          <Card className="px-4 py-1">
            <SalesFeed sales={recent} />
          </Card>
        </div>
      </div>
    </>
  );
}
