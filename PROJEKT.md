# Furnito Panel — dokumentacja projektu

Panel barteru mebli AD Awards: klienci (producenci), sprzedaż, salda barteru, statystyki,
powiadomienia, oraz **dwukierunkowa synchronizacja „na żywo" z Google Sheets**.

> Sekrety (connection string, tokeny, sekrety webhooka) są w `SEKRETY.local.md` — plik
> **poza gitem**. Ten plik (PROJEKT.md) trzymamy w repo i nie wpisujemy do niego sekretów.

---

## Adresy i zasoby

| Co | Gdzie |
|---|---|
| Produkcja (panel) | https://furnito-sales-panel.vercel.app |
| Repo GitHub | https://github.com/mariusz1802/furnito-sales-panel (branch `main`) |
| Projekt Vercel | `furnito-sales-panel`, zespół/scope `arkadius-projects-c2fb86f7` |
| Baza | Prisma Postgres (projekt „Obedient Rust Badger", host `db.prisma.io`) |
| Arkusz sync dwukierunkowy | „dane sprzedażowe", `SALES_SHEET_ID=1sPrpBdmBqfVCSaz5Bbi4HYVs8-RPgtyxvRLMGABNJ5A` |

## Stack

- **Next.js 16** (App Router, Turbopack) — uwaga: to nowa wersja, patrz `node_modules/next/dist/docs/`
- **React 19**, Tailwind v4, recharts, lucide-react
- **Prisma v7.9** z **driver adapters** (generator `prisma-client`, klient w `src/generated/prisma`,
  connection w `prisma.config.ts`, nie w `schema.prisma`)
- Baza: **Prisma Postgres** na produkcji; adapter dobiera się po `DATABASE_URL`
  (`postgres://` → `PrismaPg`, `file:` → SQLite) w [src/lib/prisma.ts](src/lib/prisma.ts)

---

## Jak działa synchronizacja z Google Sheets

**Zakres:** dwukierunkowo synchronizowany jest TYLKO arkusz „dane sprzedażowe" (stałe kolumny).
Arkusze barterowe per klient (Cezar, Roberto…) są **tylko do odczytu** (mają nieregularny układ).

Kolumny arkusza sprzedażowego:
```
MEBEL | kwota z barteru | producent | Marketplace | STATUS | kwota sprzedaży |
kwota transportu | status kasy | data sprzedaży | data wysyłki | data otrzymania |
Status kasy | Inne | Nazwisko Klienta
```

**Sheet → panel (na żywo):** Apps Script ([apps-script/furnito-sales-sync.gs](apps-script/furnito-sales-sync.gs))
z triggerem `onEdit` POST-uje zmieniony wiersz na `/api/webhooks/sheets` (sekret). Upsert po `Sale.sheetRow`.

**Panel → Sheet:** `appendSaleRow` / `updateSaleRow` w [src/lib/integrations/salesSheet.ts](src/lib/integrations/salesSheet.ts),
wpięte w [src/app/actions.ts](src/app/actions.ts) (dodanie sprzedaży, zmiana statusu).

**Anty-pętla:** zapisy przez Sheets API nie wyzwalają `onEdit` + guard `Sale.lastSyncedFromApp` (<15 s).
**Auto-refresh UI:** [src/components/LiveRefresh.tsx](src/components/LiveRefresh.tsx) (co 15–20 s) na `/` i `/sprzedaz`.
**Cron zapasowy:** [vercel.json](vercel.json) → GET `/api/sync/sheets` co godzinę (pełny reconcile).

Kluczowe pliki:
- [src/lib/integrations/google.ts](src/lib/integrations/google.ts) — auth konta serwisowego (scope read+write)
- [src/lib/integrations/salesSheet.ts](src/lib/integrations/salesSheet.ts) — parser tabeli, reconcile, zapis
- [src/lib/integrations/sheets.ts](src/lib/integrations/sheets.ts) — arkusze barterowe (read-only)
- [src/app/api/webhooks/sheets/route.ts](src/app/api/webhooks/sheets/route.ts) — webhook onEdit

---

## Zmienne środowiskowe

Nazwy (wartości w `.env` lokalnie i w Vercel → Settings → Environment Variables):

| Zmienna | Do czego | Status |
|---|---|---|
| `DATABASE_URL` | Prisma Postgres | ✅ ustawione |
| `SALES_SHEET_ID` | arkusz sprzedażowy | ✅ ustawione |
| `SHEETS_WEBHOOK_SECRET` | sekret webhooka onEdit | ✅ ustawione |
| `CRON_SECRET` | zabezpieczenie crona | ✅ ustawione |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | konto serwisowe Google | ⏳ do dodania |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | klucz PEM konta serwisowego (z `\n`) | ⏳ do dodania |
| `SMSAPI_TOKEN`, `RESEND_API_KEY`, … | powiadomienia (opcjonalne) | ⏳ opcjonalne |

---

## Stan projektu

**Zrobione:**
- ✅ Panel wdrożony i działa na produkcji (Postgres + realne dane)
- ✅ Cała mechanika sync dwukierunkowego + webhook + auto-refresh + Apps Script
- ✅ Baza Postgres: migracje + import danych klientów

**Do zrobienia, żeby sync ruszył „na żywo":**
1. Utworzyć **konto serwisowe Google** + włączyć **Google Sheets API**, pobrać klucz JSON
2. Ustawić `GOOGLE_SERVICE_ACCOUNT_EMAIL` i `GOOGLE_SERVICE_ACCOUNT_KEY` w Vercel + redeploy
3. Udostępnić arkusz „dane sprzedażowe" temu kontu jako **Edytor**
4. W arkuszu: wkleić Apps Script, ustawić `WEBHOOK_URL` + `SECRET`, uruchomić `installTrigger`

**Opcjonalne:**
- Połączyć konto GitHub z Vercel (Project → Settings → Git) → auto-deploy po `git push`

---

## Raporty sprzedaży ze sklepów (`/raporty`)

Wybór klienta + zakres dat (presety: tydzień/miesiąc/pół roku/rok) → raport
„co się sprzedaje" **na żywo ze sklepu klienta** + nasza sprzedaż barterowa + **PDF** (druk).

- Integracje sklepów per klient (tabela `StoreConnection`): platforma + URL + poświadczenie.
  - **WooCommerce** — [woocommerce.ts](src/lib/integrations/woocommerce.ts), Analytics API `wc-analytics/reports/products`.
  - **Shoper** — [shoper.ts](src/lib/integrations/shoper.ts), webapi `/orders` + `/order-products` (Bearer).
  - **PrestaShop** — [prestashop.ts](src/lib/integrations/prestashop.ts), Webservice `/api/orders?display=full`.
- Dodawanie połączeń: `POST /api/admin/store-connection` (sekret; poświadczenia z `claude_desktop_config.json`, gitignored). Wartości i lista podłączonych — w `SEKRETY.local.md`.
- **Słownik tkanin/kolorów** [fabrics.ts](src/lib/fabrics.ts): kody z nazw (np. „MONOLITH 02") → „Monolith Beżowy" w raportach i statystyce kolorów.

## Przydatne komendy

```bash
# Lokalny development (używa DATABASE_URL z .env)
npm run dev

# Build produkcyjny (prisma generate + next build)
npm run build

# Migracja bazy (po zmianie schema.prisma) — generuje SQL i aplikuje
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > prisma/migrations/<ts>_<nazwa>/migration.sql
npx prisma migrate deploy

# Import danych do bazy (seed + arkusze; dane lokalne, poza gitem)
npm run seed
npm run sync:sheets

# Deploy na Vercel (token/scope w SEKRETY.local.md)
npx vercel deploy --prod --yes --scope arkadius-projects-c2fb86f7 --token <VERCEL_TOKEN>
```
