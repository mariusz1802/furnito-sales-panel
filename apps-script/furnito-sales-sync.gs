/**
 * Furnito — synchronizacja arkusza "dane sprzedażowe" → panel (na żywo).
 *
 * Co robi: po każdej zmianie w arkuszu wysyła zmieniony wiersz do panelu
 * (endpoint /api/webhooks/sheets), a panel zapisuje/aktualizuje sprzedaż.
 *
 * JAK URUCHOMIĆ (raz):
 *  1. W arkuszu: Rozszerzenia → Apps Script.
 *  2. Wklej ten plik (zastąp domyślny Code.gs).
 *  3. Ustaw poniżej WEBHOOK_URL (adres panelu na Vercel) oraz SECRET
 *     (dokładnie ten sam co SHEETS_WEBHOOK_SECRET w panelu).
 *  4. Sprawdź HEADER_ROW — to numer wiersza z nagłówkami (MEBEL, Marketplace…).
 *     W "dane sprzedażowe" nagłówek jest w wierszu 2.
 *  5. Uruchom funkcję installTrigger (menu ▶) i zaakceptuj uprawnienia.
 *  6. Gotowe — od teraz każda zmiana leci do panelu w kilka sekund.
 *
 * Uwaga: to jest trigger INSTALOWANY (nie "prosty onEdit"), bo tylko taki może
 * wysyłać żądania na zewnątrz (UrlFetchApp).
 */

const WEBHOOK_URL = "https://TWOJ-PANEL.vercel.app/api/webhooks/sheets";
const SECRET = "WKLEJ_TEN_SAM_SEKRET_CO_W_PANELU";
const HEADER_ROW = 2; // wiersz z nagłówkami kolumn
// Opcjonalnie ogranicz do jednej zakładki (np. "Arkusz1"). Puste = wszystkie.
const SHEET_NAME = "";

/** Instalowany trigger onEdit — uruchom RAZ, ręcznie. */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "onEditFurnito") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("onEditFurnito")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  Logger.log("Trigger zainstalowany. Sync na żywo aktywny.");
}

/** Wywoływane automatycznie po każdej edycji arkusza. */
function onEditFurnito(e) {
  try {
    const sheet = e.range.getSheet();
    if (SHEET_NAME && sheet.getName() !== SHEET_NAME) return;

    const row = e.range.getRow();
    if (row <= HEADER_ROW) return; // pomiń nagłówek i wiersz sum

    const lastCol = sheet.getLastColumn();
    const header = sheet.getRange(HEADER_ROW, 1, 1, lastCol).getValues()[0];
    const values = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

    postToPanel({ secret: SECRET, rowNumber: row, header: header, row: values });
  } catch (err) {
    Logger.log("onEditFurnito error: " + err);
  }
}

/** Wyślij pełną synchronizację (opcjonalnie: uruchom ręcznie lub z triggera czasowego). */
function fullReconcile() {
  postToPanel({ secret: SECRET, reconcile: true });
}

function postToPanel(payload) {
  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}
