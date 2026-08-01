import { formatPLN } from "@/lib/format";
import { swatchFor } from "@/lib/swatch";
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(34,39,31,0.04),0_8px_24px_-16px_rgba(34,39,31,0.15)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "bg-stone-100 text-stone-600 ring-stone-200",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function Money({
  value,
  precise = false,
  display = false,
  className = "",
}: {
  value: number;
  precise?: boolean;
  display?: boolean;
  className?: string;
}) {
  return (
    <span className={`tabular-nums ${display ? "font-display" : ""} ${className}`}>
      {formatPLN(value, precise)}
    </span>
  );
}

/** Próbka tkaniny klienta — sygnatura wizualna */
export function Swatch({
  seed,
  size = 36,
  className = "",
}: {
  seed: string;
  size?: number;
  className?: string;
}) {
  const s = swatchFor(seed);
  return (
    <span
      title={`Tkanina: ${s.name}`}
      className={`swatch-weave inline-block shrink-0 rounded-md ring-1 ring-inset ring-black/10 ${className}`}
      style={{ width: size, height: size, backgroundColor: s.hex }}
    />
  );
}

export function SectionTitle({
  title,
  subtitle,
  eyebrow,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const toneStyles = {
  ok: { bar: "bg-brand-400", track: "bg-brand-100" },
  warn: { bar: "bg-brass-400", track: "bg-brass-100" },
  over: { bar: "bg-brick-500", track: "bg-brick-100" },
  brand: { bar: "bg-brand-400", track: "bg-brand-100" },
} as const;

export function ProgressBar({
  value,
  tone = "brand",
}: {
  value: number;
  tone?: keyof typeof toneStyles;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const s = toneStyles[tone];
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full ${s.track}`}>
      <div
        className={`h-full rounded-full ${s.bar} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "text-ink",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  tone?: string;
}) {
  return (
    <Card className="animate-rise p-5">
      <div className="flex items-start justify-between">
        <p className="eyebrow">{label}</p>
        {icon && (
          <span className="text-brand-500" aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <p
        className={`mt-2 font-display text-[1.75rem] font-semibold leading-tight tracking-tight ${tone}`}
      >
        {value}
      </p>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-stone-300">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}
