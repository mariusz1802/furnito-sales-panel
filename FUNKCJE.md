# Furnito — funkcjonalności systemu

Dziennik tego, co ciekawego wpada do panelu Furnito. Najnowsze na górze.

**Panel:** https://furnito-sales-panel.vercel.app

---

## 2026-08-03

### 🧵 Słownik tkanin i kolorów
W raportach kody tkanin z nazw produktów zamieniane na czytelne nazwy:
„WERSALKA AURORA **MONOLITH 02**" → „WERSALKA AURORA **Monolith Beżowy**". Obejmuje
SORO, MONOLITH, KRONOS, PAROS, INARI, POSO, COSMIC, PISA TILIA, MAGIC VELVET,
VELLUTO, VELVET, SAWANA i inne. Kolory w statystyce też z realnych nazw.

### 🏪 Raporty sprzedaży ze sklepów klientów (na żywo)
Strona **Raporty**: wybierasz klienta + zakres dat (szybkie: tydzień / miesiąc /
pół roku / rok) → widzisz **co sprzedaje sklep klienta** (TOP produkty, sztuki,
przychód, kolory) obok naszej sprzedaży barterowej. Eksport do **PDF**.
Podłączone: WooCommerce (Cezar, Wuka, Lamal, RM Moś, MebelCraft), Shoper (K2),
PrestaShop (KMK).

### 🔄 Salda barteru na żywo z arkuszy Moniki
Do każdego pliku Moniki dodawany skrypt (Apps Script) — panel na żywo zaciąga
„kwotę zamówień" (ile u klienta nazamawialiśmy) i „kwotę zrealizowanych zleceń"
(ile dla niego zrobiliśmy). Saldo „ponad stan" liczone z danych Moniki (źródło prawdy).

### ⚠️ Wykrywanie rozbieżności
Na karcie klienta pokazuje się, gdy sprzedaż „na żywo" z arkusza „dane sprzedażowe"
odbiega od sumy Moniki — „tu się nie zgadza o X zł" (możliwy błąd / brak aktualizacji).

### ⚡ Dwukierunkowa synchronizacja z arkuszem „dane sprzedażowe"
Wpis w arkuszu → w panelu w sekundy (i odwrotnie). Auto-odświeżanie widoków
(Pulpit, Sprzedaż, Klienci) bez F5.

---

## Fundament (wdrożenie)

- Panel na **Vercel**, baza **Prisma Postgres** (produkcja).
- Moduły: Pulpit, Klienci (salda barteru), Sprzedaż, Statystyki, Raporty, Powiadomienia, Integracje.
- Powiadomienia SMS/e-mail (raport tygodniowy, alerty sprzedaży) — po podłączeniu kluczy.

---

> Jak dojdzie coś nowego — dopisujemy tu na górze z datą.
