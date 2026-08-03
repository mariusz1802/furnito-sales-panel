/**
 * Logika salda barteru — zgodna z arkuszami Google klientów.
 *
 * W arkuszu:
 *   KWOTA ZAMÓWIEŃ            = ile mebli AD Awards już WZIĄŁ u producenta (soldFurniture)
 *   KWOTA ZREALIZOWANYCH ZLECEŃ = ile usług producent realnie ZAMÓWIŁ (deliveredServices)
 *   różnica                  = KWOTA ZAMÓWIEŃ − KWOTA ZREALIZOWANYCH ZLECEŃ
 *
 * Liczymy "dostępne środki" jako ile jeszcze możemy wziąć mebli:
 *   available = deliveredServices − soldFurniture
 *
 * available > 0  -> zostały środki (dostarczyliśmy więcej usług niż wzięliśmy mebli)
 * available < 0  -> PONAD STAN (wzięliśmy więcej mebli niż dostarczonych usług) — jak Cezar
 *
 * Uwaga: liczą się usługi ZREALIZOWANE (DELIVERED). Zaplanowane (PLANNED, np. SEO
 * na kolejne miesiące z góry) trzymamy osobno jako `committedServices` (informacyjnie).
 */

export type SaleLike = {
  amount: number;
  quantity: number;
  status: string;
  /** "kwota z barteru" — wartość barterowa mebla (podstawa salda barteru) */
  barterAmount?: number | null;
};
export type ServiceLike = { amount: number; status: string };

export type BarterBalance = {
  /** usługi zrealizowane (KWOTA ZREALIZOWANYCH ZLECEŃ) — podstawa salda */
  deliveredServices: number;
  /** cała zakontraktowana wartość (DELIVERED + PLANNED) — informacyjnie */
  committedServices: number;
  /** meble wzięte (KWOTA ZAMÓWIEŃ) — na żywo z arkusza "dane sprzedażowe" */
  soldFurniture: number;
  /** deliveredServices − soldFurniture (ujemne = ponad stan) */
  available: number;
  isOverdrawn: boolean;
  /** wykorzystanie: wzięte / zrealizowane usługi (0..100+) */
  utilizationPct: number;
  limitUsedPct: number | null;
  /** autorytatywna suma zamówień z arkusza Moniki (ŹRÓDŁO PRAWDY salda) */
  monikaOrdersTotal: number | null;
  /** suma z arkusza "dane sprzedażowe" na żywo (do porównania) */
  liveOrdersTotal: number;
  /** różnica: na żywo − Monika; 0 gdy brak odniesienia */
  ordersDiscrepancy: number;
  /** czy rozbieżność jest istotna (>= 1 zł) i mamy z czym porównać */
  hasOrdersDiscrepancy: boolean;
};

const ACTIVE_SALE = (s: SaleLike) =>
  s.status !== "CANCELLED" && s.status !== "RESIGNED";

/** Suma wartości SPRZEDAŻY (kwota sprzedaży / resale). */
export function sumSales(sales: SaleLike[]): number {
  return sales.filter(ACTIVE_SALE).reduce((acc, s) => acc + (s.amount || 0), 0);
}

/** Suma wartości BARTEROWEJ (kwota z barteru); fallback do amount, gdy brak. */
export function sumBarter(sales: SaleLike[]): number {
  return sales
    .filter(ACTIVE_SALE)
    .reduce((acc, s) => acc + (s.barterAmount ?? s.amount ?? 0), 0);
}

export type SheetTotals = {
  ordersTotalSheet?: number | null;
  servicesRealizedSheet?: number | null;
};

export function computeBalance(
  services: ServiceLike[],
  sales: SaleLike[],
  barterLimit?: number | null,
  sheet?: SheetTotals,
): BarterBalance {
  const deliveredFromLines = services
    .filter((s) => s.status === "DELIVERED")
    .reduce((acc, s) => acc + (s.amount || 0), 0);
  const committedServices = services.reduce((acc, s) => acc + (s.amount || 0), 0);

  // usługi zrealizowane: autorytatywna suma z arkusza barterowego Moniki,
  // a jeśli brak — z pozycji usług.
  const deliveredServices =
    sheet?.servicesRealizedSheet != null
      ? sheet.servicesRealizedSheet
      : deliveredFromLines;

  // ŹRÓDŁO PRAWDY: autorytatywna suma z arkusza Moniki. Arkusz "dane sprzedażowe"
  // (na żywo) liczymy osobno tylko do PORÓWNANIA — tam łatwiej o błąd/brak
  // aktualizacji. Gdy brak sumy Moniki — fallback do sumy na żywo.
  const monikaOrdersTotal = sheet?.ordersTotalSheet ?? null;
  const liveOrdersTotal = sumBarter(sales);
  const hasLiveSales = sales.some(ACTIVE_SALE);
  const soldFurniture = monikaOrdersTotal ?? liveOrdersTotal;

  // rozbieżność: o ile arkusz na żywo odbiega od Moniki (dodatnie = na żywo więcej)
  const ordersDiscrepancy =
    hasLiveSales && monikaOrdersTotal != null
      ? liveOrdersTotal - monikaOrdersTotal
      : 0;
  const hasOrdersDiscrepancy =
    hasLiveSales && monikaOrdersTotal != null && Math.abs(ordersDiscrepancy) >= 1;

  const available = deliveredServices - soldFurniture;
  const utilizationPct =
    deliveredServices > 0
      ? (soldFurniture / deliveredServices) * 100
      : soldFurniture > 0
        ? 100
        : 0;
  const limitUsedPct =
    barterLimit && barterLimit > 0 ? (soldFurniture / barterLimit) * 100 : null;

  return {
    deliveredServices,
    committedServices,
    soldFurniture,
    available,
    isOverdrawn: available < 0,
    utilizationPct,
    limitUsedPct,
    monikaOrdersTotal,
    liveOrdersTotal,
    ordersDiscrepancy,
    hasOrdersDiscrepancy,
  };
}

/** Kolor statusu salda: zielony = dużo miejsca, bursztyn = blisko wyrównania, czerwony = ponad stan */
export function balanceTone(b: BarterBalance): "ok" | "warn" | "over" {
  if (b.isOverdrawn) return "over";
  if (b.utilizationPct >= 80) return "warn";
  return "ok";
}
