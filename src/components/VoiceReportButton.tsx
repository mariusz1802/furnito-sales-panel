"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Loader2, Volume2 } from "lucide-react";
import { FURNITO_REPORT_SLUG } from "@/lib/reportShared";

/**
 * Głosowe generowanie raportów: szef klika i MÓWI, z czego chce raport.
 * Np. "Cezar ostatni tydzień", "wszyscy partnerzy miesiąc", "KMK kwartał".
 * Rozpoznaje partnera + okres z transkryptu i przechodzi na /raporty z parametrami.
 *
 * Wykorzystuje Web Speech API (webkitSpeechRecognition) — działa w Chrome/Edge,
 * po polsku (pl-PL), bez konta i bez kosztów. W przeglądarkach bez wsparcia
 * chowamy przycisk (fallback: zwykły formularz obok).
 */

type ClientOpt = { name: string; slug: string };

// --- lekkie typy Web Speech API (brak w standardowych typach TS) ---
type SpeechResult = { 0: { transcript: string }; isFinal: boolean };
type SpeechEvent = { results: { length: number } & Record<number, SpeechResult> };
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognitionCtor = new () => Recognition;

const strip = (s: string) =>
  s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const GENERIC = new Set([
  "meble", "mebel", "materace", "materac", "sofa", "sklep", "sklepy",
  "manufaktura", "wygody", "comfy",
]);

/** Rozpoznaj okres (w dniach) + etykietę z wypowiedzi. */
function parsePeriod(t: string): { days: number; label: string } {
  if (/\b(dzis|dzisiaj)\b/.test(t)) return { days: 1, label: "dzisiaj" };
  if (/\bwczoraj\b/.test(t)) return { days: 2, label: "ostatnie 2 dni" };
  if (/(dwa tygodnie|2 tygodnie|14 dni)/.test(t)) return { days: 14, label: "2 tygodnie" };
  if (/(tydzie|tygodn|7 dni)/.test(t)) return { days: 7, label: "ostatni tydzień" };
  if (/(kwartal|trzy miesiace|3 miesiace|90 dni)/.test(t)) return { days: 90, label: "kwartał" };
  if (/(pol roku|6 miesiecy|polrocz|180 dni)/.test(t)) return { days: 180, label: "pół roku" };
  if (/(rok|roku|roczny|12 miesiecy|365)/.test(t)) return { days: 365, label: "rok" };
  if (/(miesiac|miesiaca|miesieczn|30 dni)/.test(t)) return { days: 30, label: "ostatni miesiąc" };
  return { days: 30, label: "ostatni miesiąc" };
}

/** Rozpoznaj partnera (albo Furnito=wszyscy) z wypowiedzi. */
function matchClient(
  t: string,
  clients: ClientOpt[],
): { slug: string; name: string } | null {
  const nt = strip(t);
  if (/(wszyscy|wszystkich|wszystkie|wszystko|furnito|calosc|calos|lacznie|razem)/.test(nt))
    return { slug: FURNITO_REPORT_SLUG, name: "Furnito — wszyscy partnerzy" };

  let best: { slug: string; name: string; score: number } | null = null;
  for (const c of clients) {
    const words = strip(c.name)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !GENERIC.has(w));
    let score = 0;
    for (const w of words) if (nt.includes(w)) score = Math.max(score, w.length);
    if (score > (best?.score ?? 0)) best = { slug: c.slug, name: c.name, score };
  }
  return best ? { slug: best.slug, name: best.name } : null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function VoiceReportButton({ clients }: { clients: ClientOpt[] }) {
  const router = useRouter();
  const recogRef = useRef<Recognition | null>(null);
  const [supported, setSupported] = useState(true);
  const [state, setState] = useState<"idle" | "listening" | "working" | "error">("idle");
  const [heard, setHeard] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: RecognitionCtor;
      webkitSpeechRecognition?: RecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      // feature-detection przeglądarki — jednorazowo po montażu
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false);
      return;
    }
    const r = new Ctor();
    r.lang = "pl-PL";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    recogRef.current = r;
    return () => {
      try {
        r.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  function handleFinal(text: string) {
    const client = matchClient(text, clients);
    if (!client) {
      setState("error");
      setMsg(
        `Nie rozpoznałem partnera w: „${text}". Spróbuj np. „Cezar ostatni tydzień" albo „wszyscy miesiąc".`,
      );
      return;
    }
    const { days, label } = parsePeriod(strip(text));
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    setState("working");
    setMsg(`Raport: ${client.name} · ${label} — generuję…`);
    const params = new URLSearchParams({ client: client.slug, from: iso(from), to: iso(to) });
    router.push(`/raporty?${params.toString()}`);
  }

  function start() {
    const r = recogRef.current;
    if (!r) return;
    setHeard("");
    setMsg(null);
    setState("listening");
    r.onresult = (e: SpeechEvent) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setHeard(txt);
      const last = e.results[e.results.length - 1];
      if (last?.isFinal) {
        try {
          r.stop();
        } catch {
          /* ignore */
        }
        handleFinal(txt);
      }
    };
    r.onerror = (e: { error: string }) => {
      setState("error");
      setMsg(
        e.error === "not-allowed"
          ? "Brak dostępu do mikrofonu — zezwól w przeglądarce i spróbuj ponownie."
          : "Nie udało się nagrać. Spróbuj ponownie.",
      );
    };
    r.onend = () => {
      setState((s) => (s === "listening" ? "idle" : s));
    };
    try {
      r.start();
    } catch {
      /* już wystartowane */
    }
  }

  if (!supported) {
    return (
      <p className="mt-3 text-xs text-muted">
        🎤 Sterowanie głosem raportem działa w Chrome/Edge. Użyj formularza powyżej.
      </p>
    );
  }

  const listening = state === "listening";
  const working = state === "working";

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={listening || working}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition ${
            listening
              ? "animate-pulse bg-brick-500"
              : working
                ? "bg-stone-400"
                : "bg-ink hover:bg-brand-600"
          }`}
        >
          {working ? (
            <Loader2 size={18} className="animate-spin" />
          ) : listening ? (
            <Volume2 size={18} />
          ) : (
            <Mic size={18} />
          )}
          {listening ? "Słucham… mów" : working ? "Generuję…" : "Powiedz, z czego chcesz raport"}
        </button>
        <span className="text-xs text-muted">
          {`np. „Cezar ostatni tydzień”, „wszyscy partnerzy miesiąc”, „KMK kwartał”`}
        </span>
      </div>

      {(heard || msg) && (
        <div className="mt-3 text-sm">
          {heard && (
            <p className="text-ink">
              <span className="eyebrow mr-2">Usłyszałem</span>
              {`„${heard}”`}
            </p>
          )}
          {msg && (
            <p className={state === "error" ? "mt-1 text-brick-500" : "mt-1 text-brand-600"}>
              {msg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
