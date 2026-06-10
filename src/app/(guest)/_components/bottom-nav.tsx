"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Building2, CalendarCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/app", label: "Home", icon: Home, match: (p: string) => p === "/app" },
  {
    href: "/app/venues",
    label: "Venues",
    icon: Building2,
    match: (p: string) => p.startsWith("/app/venues"),
  },
  {
    href: "/portal/bookings",
    label: "Bookings",
    icon: CalendarCheck,
    match: (p: string) => p.startsWith("/portal/bookings"),
  },
  {
    href: "/portal",
    label: "Account",
    icon: User,
    match: (p: string) => p === "/portal",
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg"
      style={{ paddingBottom: "var(--sab)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className="size-[22px]"
                strokeWidth={active ? 2.4 : 1.9}
              />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
