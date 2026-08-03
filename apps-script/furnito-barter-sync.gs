/**
 * Furnito — synchronizacja arkusza BARTEROWEGO Moniki → panel (źródło prawdy salda).
 *
 * DODAJESZ TEN SKRYPT DO KAŻDEGO PLIKU MONIKI (jeden plik = jeden klient).
 * Skrypt sam znajduje dwie liczby PO ETYKIETACH (działa mimo różnych układów):
 *   • "KWOTA ZAMÓWIEŃ"              → ile my u niego nazamawialiśmy (meble wzięte)
 *   • "KWOTA ZREALIZOWANYCH ZLECEŃ" → ile zrobiliśmy dla niego (usługi)
 * Wartość bierze z komórki DOKŁADNIE POD etykietą. Nazwę klienta czyta z A2
 * (np. "Meble Cezar"), a jak pusto — z nazwy pliku.
 *
 * URUCHOMIENIE (raz na każdy plik):
 *   1. Plik Moniki → Rozszerzenia → Apps Script → wklej ten kod.
 *   2. WEBHOOK_URL i SECRET są już wpisane (te same co w panelu).
 *   3. Uruchom installBarterTrigger (zaakceptuj uprawnienia).
 *   4. Uruchom syncNow (od razu wyśle bieżące sumy).
 *
 * WAŻNE: suma zrealizowanych usług musi być w komórce POD nagłówkiem
 * "KWOTA ZREALIZOWANYCH ZLECEŃ". Jeśli u kogoś jest gdzie indziej — przesuń ją pod nagłówek.
 */

const WEBHOOK_URL = "https://furnito-sales-panel.vercel.app/api/webhooks/sheets";
const SECRET = "5550af1c4b2fc1e0a4746aad7545662056d370cdb2abf07c";

/** Instalowany trigger — uruchom RAZ w każdym pliku. */
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

function norm(v) {
  return String(v == null ? "" : v).toUpperCase();
}

/** Znajdź sumy po etykietach (wartość w komórce pod etykietą). */
function readTotals(sheet) {
  const maxR = Math.min(10, sheet.getLastRow());
  const maxC = Math.min(30, sheet.getLastColumn());
  if (maxR < 2) return null;
  const v = sheet.getRange(1, 1, maxR, maxC).getValues();
  let orders = null,
    services = null;
  for (let r = 0; r < v.length - 1; r++) {
    for (let c = 0; c < v[r].length; c++) {
      const t = norm(v[r][c]);
      if (orders == null && (t.indexOf("ZAMÓWIE") >= 0 || t.indexOf("ZAMOWIE") >= 0)) {
        orders = v[r + 1][c];
      }
      if (
        services == null &&
        (t.indexOf("ZREALIZOWAN") >= 0 || t.indexOf("ZREALZIOWAN") >= 0)
      ) {
        services = v[r + 1][c];
      }
    }
  }
  const clientName =
    String((v[1] && v[1][0]) || "").trim() || SpreadsheetApp.getActive().getName();
  return { clientName: clientName, orders: orders, services: services };
}

function sendTotals(sheet) {
  const d = readTotals(sheet);
  if (!d || !d.clientName) return;
  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      secret: SECRET,
      monika: true,
      client: d.clientName,
      ordersTotal: d.orders,
      servicesRealized: d.services,
    }),
    muteHttpExceptions: true,
  });
  Logger.log(
    "Wysłano: " + d.clientName + " | zamówienia: " + d.orders + " | zrealizowane: " + d.services,
  );
}

/** Po każdej edycji wysyła aktualne sumy tego arkusza. */
function onEditBarter(e) {
  try {
    sendTotals(e.range.getSheet());
  } catch (err) {
    Logger.log("onEditBarter: " + err);
  }
}

/** Wyślij teraz (uruchom ręcznie po instalacji). */
function syncNow() {
  sendTotals(SpreadsheetApp.getActive().getActiveSheet());
}
