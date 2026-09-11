"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { NAV_ROOT_PATHS } from "@/components/app/bottom-nav";

/** Shown on every /app/* page except the primary bottom-nav tab roots,
 * where "back" doesn't make sense -- those already are the destination.
 * Uses real browser history (router.back()) rather than a hardcoded
 * parent path per route, same as any OS's own back gesture. */
export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  const isRoot = (NAV_ROOT_PATHS as readonly string[]).includes(pathname);
  if (isRoot) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Go back"
      className="-ml-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-paper-raised hover:text-ink"
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
  );
}
