import Link from "next/link";
import { AlertCircle } from "lucide-react";
import {
  getWeeklyTimeline,
  getBestsellers,
  getVariantBreakdown,
  getMarketplaceSplit,
  getClientsWithBalances,
} from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Card, SectionTitle, Swatch } from "@/components/ui";
import { RankingList } from "@/components/lists";
import { WeeklyBarChart, SplitDonut } from "@/components/charts";
import { marketplaceLabel } from "@/lib/labels";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const STALE_DAYS = 21;

export default async function StatsPage() {
  const [weekly, bestsellers, variants, split, clients] = await Promise.all([
    getWeeklyTimeline(12),
    getBestsellers(30),
    getVariantBreakdown(60),
    getMarketplaceSplit(60),
    getClientsWithBalances(),
  ]);

  const topSellers = bestsellers.slice(0, 8);
  const worstSellers = [...bestsellers].reverse().slice(0, 5);
  const variantDonut = variants
    .slice(0, 7)
    .map((v) => ({ name: v.name, value: v.units }));
  const splitRanking = split.map((s) => ({
    name: marketplaceLabel[s.name] ?? s.name,
    units: s.units,
    amount: s.amount,
  }));

  // Server Component renderowany na żądanie (force-dynamic) — czas bieżący jest
  // tu poprawny; reguła czystości nie dotyczy request-time renderu na serwerze.
  // eslint-disable-next-line react-hooks/purity
  const staleCutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
  const stale = clients
    .filter(
      (c) =>
        c.status === "ACTIVE" &&
        (!c.lastSaleAt || c.lastSaleAt.getTime() < staleCutoff),
    )
    .sort((a, b) => {
      const at = a.lastSaleAt?.getTime() ?? 0;
      const bt = b.lastSaleAt?.getTime() ?? 0;
      return at - bt;
    });

  return (
    <>
      <PageHeader
        eyebrow="Analiza · tydzień & trendy"
        title="Statystyki"
        subtitle="Co się sprzedaje, a co stoi — z podziałem na kolory, tkaniny i kanały."
      />

      <Card className="p-5">
        <SectionTitle
          eyebrow="Trend"
          title="Sprzedaż — ostatnie 12 tygodni"
          subtitle="Wartość zrealizowanych zamówień tygodniowo"
        />
        <WeeklyBarChart data={weekly} />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle
            eyebrow="Hity"
            title="Co się sprzedaje"
            subtitle="Ranking modeli — ostatnie 30 dni (szt.)"
          />
          <RankingList items={topSellers} metric="units" />
        </Card>

        <Card className="p-5">
          <SectionTitle
            eyebrow="Tkaniny & kolory"
            title="Podział wariantów"
            subtitle="Sprzedaż wg koloru / tkaniny — 60 dni"
          />
          {variantDonut.length > 0 ? (
            <SplitDonut data={variantDonut} />
          ) : (
            <p className="py-16 text-center text-sm text-muted">Brak danych.</p>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle
            eyebrow="Kanały"
            title="Allegro vs Erli"
            subtitle="Wartość sprzedaży wg kanału — 60 dni"
          />
          <RankingList items={splitRanking} metric="amount" />
        </Card>

        <Card className="p-5">
          <SectionTitle
            eyebrow="Uwaga"
            title="Klienci bez sprzedaży"
            subtitle={`Aktywni bez zamówienia od ${STALE_DAYS} dni`}
          />
          {stale.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              Wszyscy aktywni klienci mają świeżą sprzedaż. 👏
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {stale.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <Swatch seed={c.slug} size={32} />
                  <Link
                    href={`/klienci/${c.slug}`}
                    className="flex-1 truncate text-sm font-medium text-ink hover:text-brand-600"
                  >
                    {c.name}
                  </Link>
                  <span className="flex items-center gap-1 text-xs text-brick-500">
                    <AlertCircle size={13} />
                    {c.lastSaleAt ? timeAgo(c.lastSaleAt) : "brak sprzedaży"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {worstSellers.length > 0 && (
        <Card className="mt-6 p-5">
          <SectionTitle
            eyebrow="Do rozruszania"
            title="Najsłabiej rotujące modele"
            subtitle="Najmniej sztuk w ostatnich 30 dniach"
          />
          <RankingList items={worstSellers} metric="units" />
        </Card>
      )}
    </>
  );
}
