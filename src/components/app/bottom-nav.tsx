"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ClipboardList,
  Bird,
  Wallet,
  BookOpen,
  MoreHorizontal,
  Users,
  MapPin,
  ListChecks,
  LayoutDashboard,
  FileBarChart,
} from "lucide-react";
import { getDictionary } from "@/lib/i18n/translations";

export type NavVariant = "farmer" | "field" | "admin";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

// Only the farmer variant's labels are localized (spec §10 scope — see
// src/lib/i18n/translations.ts). Field/admin variants stay English-only
// for this pass.
function getItems(variant: NavVariant, locale?: string): NavItem[] {
  if (variant === "farmer") {
    const nav = getDictionary(locale).nav;
    return [
      { href: "/app/home", label: nav.home, icon: Home },
      { href: "/app/record", label: nav.record, icon: ClipboardList },
      { href: "/app/flock", label: nav.flock, icon: Bird },
      { href: "/app/sales", label: nav.sales, icon: Wallet },
      { href: "/app/advice", label: nav.advice, icon: BookOpen },
      { href: "/app/more", label: nav.more, icon: MoreHorizontal },
    ];
  }
  if (variant === "field") {
    return [
      { href: "/app/field", label: "Farmers", icon: Users },
      { href: "/app/field/visits", label: "Visits", icon: MapPin },
      { href: "/app/tasks", label: "Tasks", icon: ListChecks },
      { href: "/app/advice", label: "Advice", icon: BookOpen },
    ];
  }
  return [
    { href: "/app/network", label: "Network", icon: LayoutDashboard },
    { href: "/app/team", label: "Team", icon: Users },
    { href: "/app/tasks", label: "Tasks", icon: ListChecks },
    { href: "/app/reports", label: "Reports", icon: FileBarChart },
    { href: "/app/more", label: "More", icon: MoreHorizontal },
  ];
}

export function BottomNav({
  variant,
  containerClass = "max-w-md",
  locale,
}: {
  variant: NavVariant;
  containerClass?: string;
  locale?: string;
}) {
  const pathname = usePathname();
  const items = getItems(variant, locale);

  // Pick the most specific matching href so a nested route (e.g.
  // /app/field/visits) doesn't also light up a sibling tab whose href is
  // just a shorter prefix of it (e.g. /app/field).
  const activeHref = items
    .map((i) => i.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper-raised pb-[env(safe-area-inset-bottom)]">
      <div className={`mx-auto flex ${containerClass}`}>
        {items.map((item) => {
          const active = item.href === activeHref;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]"
            >
              <Icon
                className={`h-5 w-5 ${active ? "text-primary" : "text-ink-faint"}`}
                strokeWidth={active ? 2.25 : 1.75}
              />
              <span className={active ? "font-medium text-primary" : "text-ink-faint"}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
