import { prisma } from "@/lib/prisma";
import { getClientReport } from "@/lib/reports";
import { wooProductReport, type StoreProductReport } from "@/lib/integrations/woocommerce";
import { shoperProductReport } from "@/lib/integrations/shoper";
import { prestashopProductReport } from "@/lib/integrations/prestashop";
import { PageHeader } from "@/components/PageHeader";
import { Card, StatCard, SectionTitle, Money } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { RangePresets } from "@/components/RangePresets";
import { marketplaceLabel } from "@/lib/labels";
import {
  ShoppingBag,
  Package,
  Palette,
  CalendarRange,
  Store,
} from "lucide-react";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const plDate = (d: Date) =>
  d.toLocaleDateString("pl-PL", { day: "2-digit", month: "long", year: "numeric" });

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
  });

  // domyślny zakres: ostatnie 30 dni (render na serwerze, request-time)
  const today = new Date();
  const defFrom = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = sp.from ? new Date(sp.from) : defFrom;
  const to = sp.to ? new Date(`${sp.to}T23:59:59`) : today;
  const slug = sp.client ?? "";

  const report = slug ? await getClientReport(slug, from, to) : null;
  const maxUnits = report?.bestsellers[0]?.units ?? 1;

  // sprzedaż ze sklepu klienta (na żywo), jeśli podłączony WooCommerce
  const storeConn = slug
    ? await prisma.storeConnection.findFirst({
        where: { active: true, client: { slug } },
      })
    : null;
  let store: StoreProductReport | null = null;
  let storeError: string | null = null;
  if (storeConn?.active) {
    try {
      if (storeConn.platform === "woocommerce") {
        store = await wooProductReport(
          { baseUrl: storeConn.baseUrl, username: storeConn.username, secret: storeConn.secret },
          from,
          to,
        );
      } else if (storeConn.platform === "shoper") {
        store = await shoperProductReport(
          { baseUrl: storeConn.baseUrl, secret: storeConn.secret },
          from,
          to,
        );
      } else if (storeConn.platform === "prestashop") {
        store = await prestashopProductReport(
          { baseUrl: storeConn.baseUrl, secret: storeConn.secret },
          from,
          to,
        );
      }
    } catch (e) {
      storeError = e instanceof Error ? e.message : String(e);
    }
  }
  const storeMax = store?.top[0]?.units ?? 1;

  return (
    <>
      <PageHeader
        eyebrow="Raporty · sprzedaż"
        title="Raporty"
        subtitle="Wybierz klienta i okres — panel wygeneruje raport bestsellerów i kolorów. Zapisz jako PDF."
      />

      <Card className="no-print p-5">
        <form
          id="report-form"
          method="get"
          className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
        >
          <label className="block">
            <span className="eyebrow mb-1 block">Klient</span>
            <select name="client" defaultValue={slug} className={inputCls} required>
              <option value="" disabled>
                — wybierz klienta —
              </option>
              {clients.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow mb-1 block">Od</span>
            <input type="date" name="from" defaultValue={iso(from)} className={inputCls} />
          </label>
          <label className="block">
            <span className="eyebrow mb-1 block">Do</span>
            <input type="date" name="to" defaultValue={sp.to ?? iso(today)} className={inputCls} />
          </label>
          <button className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600">
            Generuj
          </button>
        </form>
        <RangePresets />
      </Card>

      {slug && !report && (
        <p className="mt-6 text-sm text-muted">Nie znaleziono klienta.</p>
      )}

      {report && (
        <div id="report-print" className="mt-6 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow flex items-center gap-1.5">
                <CalendarRange size={13} /> Raport sprzedaży
              </p>
              <h2 className="font-display text-2xl font-semibold text-ink">
                {report.client.name}
              </h2>
              <p className="text-sm text-muted">
                {plDate(report.from)} — {plDate(report.to)}
              </p>
            </div>
            <PrintButton />
          </div>

          {storeConn && (
            <div>
              <SectionTitle
                eyebrow="Na żywo ze sklepu klienta"
                title="Co sprzedaje sklep"
              />
              {storeError ? (
                <Card className="p-5 text-sm text-brick-500">
                  Nie udało się pobrać ze sklepu: {storeError}
                </Card>
              ) : store && store.top.length > 0 ? (
                <>
                  <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <StatCard
                      label="Sztuk w sklepie"
                      value={String(store.totalUnits)}
                      icon={<Store size={20} />}
                    />
                    <StatCard
                      label="Przychód sklepu"
                      value={<Money value={store.totalRevenue} />}
                      icon={<ShoppingBag size={20} />}
                    />
                  </div>
                  <Card className="overflow-hidden p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs text-muted">
                          <th className="px-4 py-2 font-medium">Produkt (sklep)</th>
                          <th className="px-4 py-2 text-right font-medium">Szt.</th>
                          <th className="px-4 py-2 text-right font-medium">Przychód</th>
                          <th className="w-24 px-4 py-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {store.top.map((p) => (
                          <tr key={p.name} className="border-b border-line/60 last:border-0">
                            <td className="px-4 py-2 text-ink">{p.name}</td>
                            <td className="px-4 py-2 text-right font-medium text-ink">{p.units}</td>
                            <td className="px-4 py-2 text-right text-muted">
                              <Money value={p.revenue} />
                            </td>
                            <td className="px-4 py-2">
                              <div className="h-1.5 rounded-full bg-stone-100">
                                <div
                                  className="h-1.5 rounded-full bg-brand-500"
                                  style={{ width: `${Math.round((p.units / storeMax) * 100)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                  {store.colors.length > 0 && (
                    <Card className="mt-4 p-5">
                      <p className="eyebrow mb-2">Kolory w sklepie</p>
                      <div className="flex flex-wrap gap-2">
                        {store.colors.map((c) => (
                          <span
                            key={c.name}
                            className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600"
                          >
                            {c.name} · {c.units} szt.
                          </span>
                        ))}
                      </div>
                    </Card>
                  )}
                </>
              ) : (
                <Card className="p-5 text-sm text-muted">
                  Brak sprzedaży w sklepie w tym okresie.
                </Card>
              )}
            </div>
          )}

          <SectionTitle eyebrow="Panel · barter" title="Nasza sprzedaż barterowa" />
          {report.orderCount === 0 ? (
            <Card className="p-6 text-sm text-muted">
              Brak sprzedaży barterowej w tym okresie dla klienta {report.client.name}.
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  label="Wartość sprzedaży"
                  value={<Money value={report.totalAmount} />}
                  icon={<ShoppingBag size={20} />}
                  hint={`${report.orderCount} pozycji`}
                />
                <StatCard
                  label="Sztuk sprzedanych"
                  value={String(report.totalUnits)}
                  icon={<Package size={20} />}
                />
                <StatCard
                  label="Rozpoznanych kolorów"
                  value={String(report.colors.length)}
                  icon={<Palette size={20} />}
                />
              </div>

              <div>
                <SectionTitle eyebrow="Co się sprzedaje" title="Bestsellery" />
                <Card className="overflow-hidden p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th className="px-4 py-2 font-medium">Produkt</th>
                        <th className="px-4 py-2 text-right font-medium">Szt.</th>
                        <th className="px-4 py-2 text-right font-medium">Wartość</th>
                        <th className="w-24 px-4 py-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {report.bestsellers.map((p) => (
                        <tr key={p.name} className="border-b border-line/60 last:border-0">
                          <td className="px-4 py-2 text-ink">{p.name}</td>
                          <td className="px-4 py-2 text-right font-medium text-ink">{p.units}</td>
                          <td className="px-4 py-2 text-right text-muted">
                            <Money value={p.amount} />
                          </td>
                          <td className="px-4 py-2">
                            <div className="h-1.5 rounded-full bg-stone-100">
                              <div
                                className="h-1.5 rounded-full bg-brand-400"
                                style={{ width: `${Math.round((p.units / maxUnits) * 100)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <SectionTitle eyebrow="Kolory / tkaniny" title="Najczęstsze kolory" />
                  <Card className="p-5">
                    {report.colors.length === 0 ? (
                      <p className="text-sm text-muted">Brak rozpoznanych kolorów w nazwach.</p>
                    ) : (
                      <ul className="space-y-2">
                        {report.colors.map((c) => (
                          <li key={c.name} className="flex items-center justify-between text-sm">
                            <span className="text-ink">{c.name}</span>
                            <span className="font-medium text-muted">{c.units} szt.</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>
                <div>
                  <SectionTitle eyebrow="Kanały" title="Gdzie sprzedano" />
                  <Card className="p-5">
                    <ul className="space-y-2">
                      {report.channels.map((ch) => (
                        <li key={ch.name} className="flex items-center justify-between text-sm">
                          <span className="text-ink">{marketplaceLabel[ch.name] ?? ch.name}</span>
                          <span className="font-medium text-muted">
                            {ch.units} szt. · <Money value={ch.amount} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              </div>

              <p className="text-center text-xs text-muted">
                Furnito · raport wygenerowany z panelu barteru AD Awards
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
