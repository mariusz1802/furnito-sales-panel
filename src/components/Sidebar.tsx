"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  BarChart3,
  FileText,
  Bell,
  Cable,
} from "lucide-react";

const nav = [
  { href: "/", label: "Pulpit", icon: LayoutDashboard },
  { href: "/klienci", label: "Klienci", icon: Users },
  { href: "/sprzedaz", label: "Sprzedaż", icon: ShoppingBag },
  { href: "/statystyki", label: "Statystyki", icon: BarChart3 },
  { href: "/raporty", label: "Raporty", icon: FileText },
  { href: "/powiadomienia", label: "Powiadomienia", icon: Bell },
  { href: "/integracje", label: "Integracje", icon: Cable },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image
        src="/FURNITO_LOGO_POZIOM_CZARNE.svg"
        alt="Furnito"
        width={140}
        height={25}
        priority
        className="h-6 w-auto"
      />
      <span className="rounded-full bg-brand-400 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
        panel
      </span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-stone-200 bg-surface/70 px-4 py-6 backdrop-blur md:flex">
      <div className="px-2">
        <Brand />
      </div>
      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100"
                  : "text-stone-600 hover:bg-stone-100 hover:text-ink"
              }`}
            >
              <Icon size={18} className={active ? "text-brand-500" : "text-stone-400"} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 rounded-xl bg-stone-100 p-3 text-xs text-muted">
        Zalogowano jako
        <div className="mt-0.5 font-medium text-ink">AD Awards</div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-stone-200 bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
      <Brand />
      <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
        {nav.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                active ? "bg-brand-50 text-brand-600" : "text-stone-500"
              }`}
            >
              <Icon size={18} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
