import { CheckCircle2, Circle, ExternalLink, Webhook, FileUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, Badge, SectionTitle } from "@/components/ui";
import { CsvImportForm } from "@/components/CsvImportForm";
import { SyncButton } from "@/components/SyncButton";
import { getIntegrationStatuses } from "@/lib/integrations";

const syncable: Record<string, string> = {
  sheets: "Synchronizuj arkusze",
  allegro: "Pobierz zamówienia",
  erli: "Pobierz zamówienia",
};

export const dynamic = "force-dynamic";

const webhooks = [
  { name: "Allegro — nowe zamówienia", path: "/api/webhooks/allegro" },
  { name: "Erli — nowe zamówienia", path: "/api/webhooks/erli" },
  { name: "Raport tygodniowy (cron)", path: "/api/cron/weekly-report" },
];

export default function IntegrationsPage() {
  const integrations = getIntegrationStatuses();

  return (
    <>
      <PageHeader
        eyebrow="Połączenia · API"
        title="Integracje"
        subtitle="Podłącz Allegro i Erli, żeby sprzedaż wpadała automatycznie. Import CSV działa od ręki."
      />

      <SectionTitle eyebrow="Dostawcy" title="Status połączeń" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {integrations.map((it) => (
          <Card key={it.key} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-semibold text-ink">
                    {it.name}
                  </h3>
                  {it.configured ? (
                    <Badge tone="bg-brand-50 text-brand-700 ring-brand-100">
                      <CheckCircle2 size={12} /> podłączone
                    </Badge>
                  ) : (
                    <Badge tone="bg-stone-100 text-stone-500 ring-stone-200">
                      <Circle size={12} /> do konfiguracji
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-muted">{it.description}</p>
              </div>
              {it.docsUrl && (
                <a
                  href={it.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-stone-400 transition hover:text-brand-500"
                  aria-label={`Dokumentacja ${it.name}`}
                >
                  <ExternalLink size={16} />
                </a>
              )}
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <p className="eyebrow mb-1.5">Zmienne środowiskowe</p>
              <div className="flex flex-wrap gap-1.5">
                {it.envVars.map((v) => (
                  <code
                    key={v}
                    className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-600"
                  >
                    {v}
                  </code>
                ))}
              </div>
            </div>
            {syncable[it.key] && (
              <div className="mt-3">
                <SyncButton
                  source={it.key as "allegro" | "erli" | "sheets"}
                  label={syncable[it.key]}
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle eyebrow="Webhooki" title="Adresy do podłączenia" />
          <Card className="p-5">
            <p className="mb-3 flex items-start gap-1.5 text-sm text-muted">
              <Webhook size={15} className="mt-0.5 shrink-0" />
              Wskaż te adresy w panelu sprzedawcy (lub cron), by zamówienia wpadały
              automatycznie i wyzwalały powiadomienia.
            </p>
            <ul className="space-y-2">
              {webhooks.map((w) => (
                <li
                  key={w.path}
                  className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2"
                >
                  <span className="text-sm text-ink">{w.name}</span>
                  <code className="font-mono text-xs text-brand-600">{w.path}</code>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div>
          <SectionTitle eyebrow="Na start" title="Import sprzedaży (CSV)" />
          <Card className="p-5">
            <p className="mb-3 flex items-start gap-1.5 text-sm text-muted">
              <FileUp size={15} className="mt-0.5 shrink-0" />
              Zanim podłączymy API — wgraj sprzedaż z arkusza jako CSV.
            </p>
            <CsvImportForm />
          </Card>
        </div>
      </div>
    </>
  );
}
