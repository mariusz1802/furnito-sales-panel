import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-display text-6xl font-bold text-brand-400">404</p>
      <h1 className="mt-3 font-display text-2xl font-semibold text-ink">
        Nie znaleziono
      </h1>
      <p className="mt-1 text-sm text-muted">
        Ta strona lub klient nie istnieje.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
      >
        <ArrowLeft size={16} /> Wróć na pulpit
      </Link>
    </div>
  );
}
