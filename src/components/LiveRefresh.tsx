"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Cicho odświeża dane strony (Server Components) co `seconds` sekund oraz przy
 * powrocie do karty. Dzięki temu zmiany wprowadzone w arkuszu Google (przez
 * webhook onEdit → baza) pojawiają się w panelu bez ręcznego F5.
 *
 * Strona musi być dynamiczna (export const dynamic = "force-dynamic").
 */
export function LiveRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), Math.max(5, seconds) * 1000);
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [router, seconds]);

  return null;
}
