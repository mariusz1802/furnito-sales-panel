# Dziennik projektu Furnito Panel

Log sesji do łatwego wznowienia pracy. Najnowsze na górze. Każda sesja: data,
co zrobiono, decyzje, zweryfikowane fakty, następne kroki.

---

## Sesja 2026-07-29 (cd. — KOREKTA logiki salda)

Klient doprecyzował (zrzuty arkusza Cezara): KWOTA ZAMÓWIEŃ = meble które MY już wzięliśmy;
KWOTA ZREALIZOWANYCH ZLECEŃ = usługi które producent realnie zamówił. **Saldo = usługi
zrealizowane − meble wzięte; ujemne = PONAD STAN.** Liczą się usługi ZREALIZOWANE (nie
zakontraktowane/planowane). Cezar = 91 394,80 − 137 807 = **−46 412,20 (ponad stan, 151%)**.
- Poprawiono `src/lib/barter.ts` (kierunek + delivered zamiast committed).
- Dodano autorytatywne sumy z arkusza: kolumny `Client.ordersTotalSheet` / `servicesRealizedSheet`
  (migracja sheet_totals) — mają pierwszeństwo w `computeBalance` (bo pozycje z podagentów
  bywały błędne dla arkuszy „3‑w‑1"). Import ustawia je; Cezar override 91 394,80.
- Ponad stan: Cezar (−46 412,20), KMK (−7 081), RM Moś (−13 360), Szydłowski (−22 461).
- Pamiętać: po zmianie schematu ZAWSZE `npx prisma generate` (migrate dev nie odświeżył klienta).

## Sesja 2026-07-29 (cd. — optymalizacja autonomiczna)

Zrobione bez udziału klienta (czeka na dostępy/klucze):
- **Produkcyjny build zielony** (naprawione błędy typów recharts + enum SaleStatus). `npm run build` przechodzi.
- **Realna wysyłka**: SMS przez SMSAPI.pl i e-mail przez Resend (`src/lib/notify.ts`) — gated env, działa po podaniu kluczy.
- **Moduły integracji gotowe**: `src/lib/integrations/allegro.ts` (OAuth refresh-token → checkout-forms → mapowanie statusu), `erli.ts` (klucz API, do potwierdzenia ścieżek), `sheets.ts` (konto serwisowe JWT → Sheets API v4, parser best-effort). Endpointy: `GET /api/sync/{allegro,erli,sheets}`. Przyciski „Synchronizuj teraz" na /integracje.
- **Aktualizacja statusu**: `ingest.ts` robi upsert po `externalId` (aktualizuje status zamiast duplikować).
- **Raport TOP‑produktów** (`src/lib/reports.ts`) miesiąc/pół roku per sklep → `GET /api/cron/top-products?range=month|half`. Zweryfikowane: „Cezar: Wersalka AURORA 26 szt., KMK: Wiki 13 szt…". Do szefów Darka i Arka.
- **Zarządzanie**: dodawanie/usuwanie odbiorców (/powiadomienia), dodany **Arek**; edycja+usuwanie klienta (`/klienci/[slug]/edytuj`); zmiana statusu sprzedaży (akcja).
- **Stany**: loading.tsx, not-found.tsx, error.tsx.
- `.env.example` uzupełniony (GOOGLE_SERVICE_ACCOUNT_*, EMAIL_FROM, ERLI_API_BASE).

Uwaga o synchronizacji z Google Sheets: obecnie dane to SNAPSHOT (import z dziś), nie live. Live-sync włączy się po udostępnieniu arkuszy kontu serwisowemu (parser sheets.ts do kalibracji na realnym API). Endpoint /api/sync/sheets i przycisk już są.

---

## Sesja 2026-07-29 (start projektu)

### Kontekst / cel
Panel dla AD Awards do zarządzania barterami z producentami mebli: salda barterów,
sprzedaż (Allegro/Erli), statystyki tygodniowe, powiadomienia SMS/e-mail. Docelowo
zarządzanie z panelu; na razie dane z Google Sheets, które prowadzi Monika (księgowa).

### Co zbudowano
- Aplikacja **Next.js 16 + React 19 + TS + Tailwind v4 + Prisma 7 (SQLite)** w `furnito-panel/`.
- Sekcje: **Pulpit, Klienci (+karta, +dodawanie), Sprzedaż, Statystyki, Powiadomienia, Integracje**.
- **Import realnych danych z 11 arkuszy Google** → `prisma/imported/*.json` → `prisma/import-sheets.ts`.
- **Rebrand furni.to**: logo `public/FURNITO_LOGO_POZIOM_CZARNE.svg`, kolor `#50E089`+czerń, fonty Inter+Bricolage Grotesque.
- Filtr klientów po **opiekunie** (`/klienci?opiekun=`).
- Webhooki `POST /api/webhooks/{allegro,erli}` (+ dedup + powiadomienie), cron `GET /api/cron/weekly-report`.
- Powiadomienia w trybie **SYMULACJI** (logowane, nie wysyłane) do czasu podania kluczy.

### Decyzje
- Własna baza; arkusze = źródło importu (na razie), docelowo zarządzanie z panelu.
- Saldo liczone JAK W ARKUSZU: `available = całe zakontraktowane usługi − sprzedane meble` (`src/lib/barter.ts`).
- Design: świadomie NIE domyślny „krem+terakota"; finalnie brand furni.to (zieleń+czerń).

### Zweryfikowane fakty (salda = zgodne z Excelem)
- Cezar: usługi 265 394,80 / sprzedaż 137 807 → **środki 127 587,80 zł** (89 sprzedaży, 16 usług).
- Roberto: **10 403,26 zł**. Komartex: **36 680 zł**. Lunaro: **16 663 zł**. PIK: **18 040 zł**.
- RM Moś: **−13 360 zł** (ponad stan). Szydłowski: **−22 461 zł** (ponad stan).
- Comfy Sofa/ABI: usługi tylko PLANNED, brak sprzedaży w arkuszu.

### Jak uruchomić / odświeżyć
```
cd "c:\SEO-ADAWARDS\FURNITO APP\furnito-panel"
npm install
npm run db:reset      # migracja + seed + import z arkuszy (stan demo/realny)
npm run dev           # http://localhost:3000  (testowo chodził na :3939)
npm run sync:sheets   # ponowny import z prisma/imported/*.json
```

### Następne kroki (ustalone z klientem)
1. **Allegro API + Erli API** — aktualizacja STATUSU zamówień (fundament: webhooki + `src/lib/ingest.ts`).
2. **Auto-sync z Google Sheets** — konto serwisowe Google Sheets API, żeby salda odświeżały się same (dane Moniki).
3. **SMS na żywo** (SMSAPI.pl) + dodać kontakt **Arka** (obok Darka).
4. **Raporty ze sklepów producentów** (gdy będą dostępy): TOP produkty w miesiąc i ~pół roku, SMS do Darka i Arka co się sprzedaje na którym sklepie; cotygodniowe podsumowanie nowych produktów + czy sprzedają się / są zaindeksowane.
5. Edycja/usuwanie klientów i odbiorców, logowanie, deploy (Postgres + Vercel + cron).

### Potrzebne dostępy/dane
- Allegro `client_id`/`client_secret` (+ konto sprzedawcy); Erli `API_KEY`.
- Udostępnienie 12 arkuszy kontu serwisowemu Google.
- SMSAPI token + nadawca; numer/e-mail Arka.
- Dostępy do sklepów producentów (później).

### Stan pamięci Claude
Zapisane w `~/.claude/projects/.../memory/`: `furnito-panel-project.md`, `furnito-panel-stack.md`,
`session-journal-convention.md`, indeks w `MEMORY.md`.
