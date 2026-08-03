/**
 * Furnito — synchronizacja arkusza BARTEROWEGO Moniki → panel (źródło prawdy salda).
 *
 * MODEL: JEDEN arkusz "Barter — klienci", po jednej KARCIE (zakładce) na klienta.
 * Nazwa karty = nazwa klienta. Na każdej karcie dwie stałe komórki z sumami:
 *   ORDERS_CELL   = KWOTA ZAMÓWIEŃ (meble wzięte)
 *   SERVICES_CELL = KWOTA ZREALIZOWANYCH ZLECEŃ (usługi)
 * Monika trzyma swój szczegół niżej; te dwie komórki mogą być formułami (=SUMA...).
 *
 * UNIWERSALNE: skrypt instalujesz RAZ. Obsługuje wszystkie karty — obecne i przyszłe.
 *   • nowa karta (nowy klient) → panel sam założy klienta,
 *   • usunięcie karty → nic nie trzeba robić,
 *   • NIGDY nie zmieniasz skryptu przy dodaniu/usunięciu klienta.
 *
 * URUCHOMIENIE (raz):
 *   1. Ten arkusz → Rozszerzenia → Apps Script, wklej ten plik.
 *   2. Ustaw WEBHOOK_URL i SECRET (jak w panelu / drugim skrypcie).
 *   3. Sprawdź ORDERS_CELL / SERVICES_CELL (gdzie na karcie są te dwie liczby).
 *   4. Uruchom installBarterTrigger (raz, zaakceptuj uprawnienia).
 *   5. (opcjonalnie) Uruchom syncAllCards, żeby od razu wysłać wszystkie karty.
 */

const WEBHOOK_URL = "https://furnito-sales-panel.vercel.app/api/webhooks/sheets";
const SECRET = "5550af1c4b2fc1e0a4746aad7545662056d370cdb2abf07c";
const ORDERS_CELL = "B1";   // KWOTA ZAMÓWIEŃ
const SERVICES_CELL = "B2"; // KWOTA ZREALIZOWANYCH ZLECEŃ
// karty pomijane (szablon/instrukcje) — nazwy zaczynające się od "_" też są pomijane
const IGNORE_TABS = ["SZABLON", "INSTRUKCJA", "SUMA"];

/** Instalowany trigger — uruchom RAZ. */
function installBarterTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "onEditBarter") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("onEditBarter")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  Logger.log("Barter sync na żywo aktywny.");
}

function isIgnored(name) {
  if (!name || name.charAt(0) === "_") return true;
  return IGNORE_TABS.indexOf(name.toUpperCase()) !== -1;
}

function sendCard(sheet) {
  const name = sheet.getName();
  if (isIgnored(name)) return;
  const orders = sheet.getRange(ORDERS_CELL).getValue();
  const services = sheet.getRange(SERVICES_CELL).getValue();
  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      secret: SECRET,
      monika: true,
      client: name,
      ordersTotal: orders,
      servicesRealized: services,
    }),
    muteHttpExceptions: true,
  });
}

/** Po każdej edycji karty wysyła jej sumy do panelu. */
function onEditBarter(e) {
  try {
    sendCard(e.range.getSheet());
  } catch (err) {
    Logger.log("onEditBarter: " + err);
  }
}

/** Wyślij WSZYSTKIE karty naraz (uruchom ręcznie raz / z triggera czasowego). */
function syncAllCards() {
  const sheets = SpreadsheetApp.getActive().getSheets();
  let n = 0;
  for (let i = 0; i < sheets.length; i++) {
    if (isIgnored(sheets[i].getName())) continue;
    sendCard(sheets[i]);
    n++;
  }
  Logger.log("Wysłano " + n + " kart.");
}
