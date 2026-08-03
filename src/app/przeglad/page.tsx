import Link from "next/link";
import { getClientsSalesOverview } from "@/lib/reports";
import { PageHeader } from "@/components/PageHeader";
import { Card, Money } from "@/components/ui";
import { Store, Package } from "lucide-react";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PERIODS = [
  { days: 7, label: "Tydzień" },
  { days: 30, label: "30 dni" },
  { days: 90, label: "90 dni" },
];

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = Number(sp.days) || 7;
  const rows = await getClientsSalesOverview(days);
  const fromIso = new Date(new Date().getTime() - days * 86400000)
    .toISOString()
    .slice(0, 10);

  const storeTotal = rows.reduce((a, r) => a + r.storeRevenue, 0);
  const barterTotal = rows.reduce((a, r) => a + r.barterRevenue, 0);

  return (
    <>
      <PageHeader
        eyebrow="Przegląd · sklep vs barter"
        title="Sprzedaż po kliencie"
        subtitle="Jak sprzedaje sklep każdego klienta i co z niego poszło do nas (barter)."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.days}
            href={`/przeglad?days=${p.days}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              days === p.days
                ? "bg-ink text-white"
                : "border border-line bg-surface text-stone-600 hover:bg-stone-50"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Store size={20} />
          </span>
          <div>
            <p className="eyebrow">Sprzedaż sklepów (razem)</p>
            <p className="font-display text-xl font-semibold text-ink">
              <Money value={storeTotal} />
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brass-50 text-brass-600">
            <Package size={20} />
          </span>
          <div>
            <p className="eyebrow">Barter — wzięliśmy (razem)</p>
            <p className="font-display text-xl font-semibold text-ink">
              <Money value={barterTotal} />
            </p>
          </div>
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">Klient</th>
              <th className="px-4 py-2.5 text-right font-medium">Sklep — wartość</th>
              <th className="px-4 py-2.5 text-right font-medium">Sklep — szt.</th>
              <th className="px-4 py-2.5 text-right font-medium">Barter — wartość</th>
              <th className="px-4 py-2.5 text-right font-medium">Barter — szt.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/raporty?client=${r.slug}&from=${new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)}`}
                    className="font-medium text-ink hover:text-brand-600"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {r.hasStore ? (
                    r.storeOk ? (
                      <span className="font-medium text-ink">
                        <Money value={r.storeRevenue} />
                      </span>
                    ) : (
                      <span className="text-xs text-muted">— (wolny/błąd)</span>
                    )
                  ) : (
                    <span className="text-xs text-muted">brak sklepu</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-muted">
                  {r.hasStore && r.storeOk ? r.storeUnits : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-ink">
                  <Money value={r.barterRevenue} />
                </td>
                <td className="px-4 py-2.5 text-right text-muted">{r.barterUnits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mt-3 text-xs text-muted">
        Sklep = sprzedaż w sklepie klienta (WooCommerce/Shoper/PrestaShop) na żywo.
        Barter = co my wzięliśmy od niego (nasze pozycje). Kliknij klienta, by zobaczyć
        szczegóły w Raportach.
      </p>
    </>
  );
}
