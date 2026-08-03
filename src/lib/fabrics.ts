/**
 * Słownik tkanin/kolorów mebli. Kod z nazwy produktu (np. "MONOLITH 02") →
 * konkretna tkanina + kolor ("Monolith Beżowy"). Używane w raportach, żeby
 * zamiast kodów pokazywać czytelny kolor tkaniny.
 */

// KOD → kolor (mianownik). Nazwa tkaniny (kolekcji) wyliczana z prefiksu kodu.
const FABRIC_COLOR: Record<string, string> = {
  // SORO
  "SORO 08": "Ciemny beż",
  "SORO 21": "Jasny beż",
  "SORO 28": "Brązowy",
  "SORO 34": "Turkusowy",
  "SORO 61": "Pudrowy różowy",
  "SORO 90": "Szary",
  "SORO 97": "Grafitowy",
  "SORO 100": "Czarny",
  // MONOLITH
  "MONOLITH 02": "Beżowy",
  "MONOLITH 04": "Ciemny beżowy",
  "MONOLITH 09": "Brązowy",
  "MONOLITH 15": "Brązowy",
  "MONOLITH 29": "Ciemny brąz",
  "MONOLITH 37": "Zielony",
  "MONOLITH 38": "Oliwkowy",
  "MONOLITH 48": "Brązowy",
  "MONOLITH 59": "Bordowy",
  "MONOLITH 61": "Łososiowy",
  "MONOLITH 70": "Szary",
  "MONOLITH -70": "Szary",
  "MONOLITH 72": "Jasny niebieski",
  "MONOLITH 77": "Niebieski",
  "MONOLITH 84": "Jasny szary",
  "MONOLITH 85": "Szary",
  "MONOLITH 92": "Antracytowy",
  "MONOLITH 95": "Ciemny szary",
  "MONOLITH 97": "Granatowy",
  // KRONOS
  "KRONOS 02": "Bordowy",
  "KRONOS 05": "Jasnoszary",
  "KRONOS 06": "Brązowy",
  "KRONOS 07": "Czarny",
  "KRONOS 09": "Niebieski",
  "KRONOS 14": "Zielony",
  "KRONOS 17": "Oliwkowy",
  "KRONOS 19": "Zielony",
  "KRONOS 35": "Beżowy",
  "KRONOS 53": "Szary",
  // PAROS
  "PAROS 02": "Beżowy",
  "PAROS 05": "Jasnoszary",
  "PAROS 06": "Szary",
  // INARI
  "INARI 91": "Szary",
  // POSO
  "POSO 01": "Musztardowy",
  "POSO 02": "Beżowy",
  "POSO 04": "Brązowy",
  "POSO 05": "Granatowy",
  "POSO 06": "Brązowy",
  "POSO 14": "Zielony",
  "POSO 22": "Szary",
  "POSO 27": "Różowy",
  "POSO 34": "Szary",
  "POSO 55": "Szary",
  "POSO 100": "Beżowy",
  "POSO 135": "Czarny",
  "L POSO 05": "Niebieski",
  // COSMIC
  "COSMIC 3": "Szary",
  "COSMIC 03": "Brązowy",
  // PISA TILIA
  "PISA TILIA 03": "Jasnobeżowy",
  "PISA TILIA 86": "Jasny szary",
  "PISA TILIA 100": "Czarny",
  // MAGIC VELVET
  "MAGIC VELVET 2216": "Granatowy",
  "MAGIC VELVET 2219": "Czarny",
  "MAGIC VELVET 2225": "Zielony",
  "MAGIC VELVET 2250": "Jasny beż",
  "MAGIC VELVET 2258": "Różowy",
  // VELLUTO
  "VELLUTO 07": "Ciemnoczerwony",
  "VELLUTO 08": "Musztardowy",
  "VELLUTO 15": "Szary",
  "VELLUTO 18": "Antracytowy",
  "VELLUTO 20": "Czarny",
  "VELLUTO 25": "Niebieski",
  "VELLUTO 27": "Butelkowa zieleń",
  "VELLUTO 32": "Czerwony",
  "VELLUTO 34": "Musztardowy",
  "VELLUTO 36": "Turkusowy",
  // VELVET
  "SMART VELVET 216-21": "Szary",
  "VELVET 16": "Szary",
  // SAWANA
  "SAWANA 01": "Ecru",
  "SAWANA 14": "Czarny",
  "SAWANA 21": "Szary",
  "SAWANA 61": "Różowy",
  // ULTRA / INNE
  "ULTRA 96001": "Beżowy",
  "ELEMENT 17": "Szary",
  "TRINITY 01": "Kremowy",
  "NEVE 02": "Beżowy",
};

// klucze posortowane od najdłuższych — dłuższy kod ma pierwszeństwo przy dopasowaniu
const CODES = Object.keys(FABRIC_COLOR).sort((a, b) => b.length - a.length);

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/** Nazwa tkaniny (kolekcji) z kodu: usuwa końcowe tokeny z cyframi. */
function fabricName(code: string): string {
  const tokens = code.split(/\s+/).filter((t) => !/\d/.test(t));
  return titleCase(tokens.join(" "));
}

// ---- proste kolory z nazwy (fallback, gdy brak kodu tkaniny) ------------
const COLOR_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /be[żz]ow|be[żz]\b/i, label: "Beżowy" },
  { re: /szar/i, label: "Szary" },
  { re: /grafit|antracyt/i, label: "Grafitowy" },
  { re: /czarn/i, label: "Czarny" },
  { re: /bia[łl]/i, label: "Biały" },
  { re: /niebiesk|granat|błękit/i, label: "Niebieski" },
  { re: /br[ąa]zow|br[ąa]z\b/i, label: "Brązowy" },
  { re: /zielon|butelkow|oliwkow/i, label: "Zielony" },
  { re: /[łl]ososi/i, label: "Łososiowy" },
  { re: /popiel|srebrn/i, label: "Popielaty" },
  { re: /kremow|krem\b|ecru/i, label: "Kremowy" },
  { re: /mi[ęe]tow/i, label: "Miętowy" },
  { re: /musztard/i, label: "Musztardowy" },
  { re: /bordow|burgund/i, label: "Bordowy" },
  { re: /czerwon/i, label: "Czerwony" },
  { re: /[żz][óo][łl]t/i, label: "Żółty" },
  { re: /pomarańcz|pomaranc/i, label: "Pomarańczowy" },
  { re: /r[óo][żz]ow|r[óo][żz]\b|pudrow/i, label: "Różowy" },
  { re: /fiolet|wrzos/i, label: "Fioletowy" },
  { re: /turkus/i, label: "Turkusowy" },
];

export function detectColor(text: string): string | null {
  for (const c of COLOR_PATTERNS) if (c.re.test(text)) return c.label;
  return null;
}

/**
 * Zamień kod tkaniny w nazwie produktu na "Tkanina Kolor".
 * Zwraca czytelną nazwę (display) oraz kolor (do statystyk kolorów).
 * Gdy brak kodu — fallback do rozpoznania koloru z nazwy.
 */
export function resolveFabric(rawName: string): { display: string; color: string | null } {
  const name = rawName ?? "";
  const upper = name.toUpperCase();
  for (const code of CODES) {
    const idx = upper.indexOf(code);
    if (idx >= 0) {
      const color = FABRIC_COLOR[code];
      const pretty = `${fabricName(code)} ${color}`;
      const display = (name.slice(0, idx) + pretty + name.slice(idx + code.length))
        .replace(/\s+/g, " ")
        .trim();
      return { display, color };
    }
  }
  return { display: name.trim(), color: detectColor(name) };
}
