# Furnito — panel barterów AD Awards

Panel do zarządzania i automatyzacji barterów z producentami mebli: salda barterów,
sprzedaż z Allegro/Erli, tygodniowe statystyki i powiadomienia SMS/e-mail.

## Uruchomienie (dev)

```bash
npm install
npm run db:migrate      # tworzy bazę SQLite (dev.db)
npm run seed            # wgrywa 15 klientów + realne dane Cezara
npm run dev             # http://localhost:3000
```

Reset danych do stanu demo: `npm run db:reset`.

## Co jest w środku

- **Pulpit** — KPI, wykres sprzedaży tygodniowej, podział kanałów, salda klientów, feed sprzedaży.
- **Klienci** — lista z saldem barteru (dostępne środki / „ponad stan"), karta klienta,
  formularz „Dodaj klienta", dodawanie sprzedaży i usług.
- **Sprzedaż** — historia zamówień + szybkie dodawanie (wyzwala powiadomienie).
- **Statystyki** — co się sprzedaje / co stoi, podział wg kolorów i tkanin, kanały,
  klienci bez sprzedaży.
- **Powiadomienia** — odbiorcy, tryb symulacja/na żywo, test wysyłki, log.
- **Integracje** — status Allegro/Erli/SMSAPI/e-mail, webhooki, import CSV.

## Logika barteru

`dostępne środki = usługi dostarczone − sprzedane meble`
(patrz `src/lib/barter.ts`). Wartość dodatnia = zostały środki, ujemna = „ponad stan".

## Integracje

- **Import CSV** — działa od ręki (Integracje → Import sprzedaży).
- **Allegro / Erli** — webhooki `POST /api/webhooks/{allegro,erli}` przyjmują zamówienia
  (`src/lib/ingest.ts` mapuje payload → sprzedaż, dedup po `externalId`, wysyła powiadomienie).
  Realne wywołania API podłącza się po uzupełnieniu kluczy w `.env` — patrz `.env.example`.
- **Powiadomienia** — domyślnie SYMULACJA (logowane, nie wysyłane). Po dodaniu
  `SMSAPI_TOKEN` / konfiguracji e-mail przełącz „wysyłkę na żywo" na stronie Powiadomienia.
- **Raport tygodniowy** — `GET /api/cron/weekly-report` (podłącz pod cron, np. poniedziałek rano).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Prisma 7 (SQLite, adapter
better-sqlite3) · Recharts · lucide-react. Font display: Fraunces.

## Produkcja (kolejny krok)

Zamień SQLite na Postgres (Neon/Supabase) — zmień `provider` w `prisma/schema.prisma`
i adapter w `src/lib/prisma.ts`, po czym `prisma migrate deploy`. Deploy np. na Vercel;
cron raportu ustaw w `vercel.json`.
