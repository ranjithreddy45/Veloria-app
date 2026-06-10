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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.15)]"
      style={{ paddingBottom: "var(--sab)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center gap-1 py-2"
            >
              <span
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                  active
                    ? "bg-violet-100 text-violet-700"
                    : "text-zinc-400"
                )}
              >
                <Icon
                  className="size-[21px]"
                  strokeWidth={active ? 2.5 : 2}
                  fill={active ? "currentColor" : "none"}
                  fillOpacity={active ? 0.15 : 0}
                />
              </span>
              <span
                className={cn(
                  "text-[10.5px] font-semibold",
                  active ? "text-violet-700" : "text-zinc-400"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
