"use client";

import { NavLink } from "./nav-transition";
import { usePathname } from "next/navigation";
import { Home, Building2, CalendarDays, MessageCircle, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

// The five roots of the v3 design. The bar shows ONLY on these — inner
// screens (hall detail, booking steps, guest list…) use a back button and
// their own sticky action bar instead, exactly as the prototype does.
const TABS = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/venues", label: "Halls", icon: Building2 },
  { href: "/app/event", label: "My event", icon: CalendarDays },
  { href: "/app/concierge", label: "Concierge", icon: MessageCircle },
  { href: "/app/account", label: "Account", icon: UserRound },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const isRoot = TABS.some((t) => t.href === pathname);
  if (!isRoot) return null;

  return (
    <nav
      className="vg-glass-white fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: "calc(var(--sab) + 6px)" }}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-md items-stretch px-2 pt-2">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.href}
              href={tab.href}
              kind="tab"
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center gap-1 py-1 transition-colors",
                active ? "text-[#6d1b52]" : "text-[#8e8e93]"
              )}
            >
              <Icon
                className="size-6"
                strokeWidth={1.8}
                fill={active ? "rgba(109,27,82,.18)" : "none"}
              />
              <span className="text-[10.5px] font-semibold">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
