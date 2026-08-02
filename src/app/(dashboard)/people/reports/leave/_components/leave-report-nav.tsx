"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Wallet, CalendarCheck, Gift, TrendingDown, PieChart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Sub-navigation across the leave report surfaces. Styled to match the app's
// ClickUp-style pill group; active tab derived from the pathname prefix.
type ReportTab = { href: string; label: string; icon: LucideIcon; exact?: boolean };
const TABS: ReportTab[] = [
  { href: "/people/reports/leave", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/people/reports/leave/balance", label: "Balance", icon: Wallet },
  { href: "/people/reports/leave/availed", label: "Availed", icon: CalendarCheck },
  { href: "/people/reports/leave/allotment", label: "Allotment", icon: Gift },
  { href: "/people/reports/leave/lapsed", label: "Lapsed", icon: TrendingDown },
  { href: "/people/reports/leave/summary", label: "Summary", icon: PieChart },
];

export function LeaveReportNav() {
  const pathname = usePathname();
  return (
    <div
      role="tablist"
      aria-label="Leave reports"
      className="inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-border/70 bg-muted/40 p-0.5"
    >
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-detail font-medium transition-all duration-150 active:scale-[0.97]",
              active
                ? "bg-blue-500/12 text-blue-600 shadow-[inset_0_0_0_1px_oklch(0.6_0.2_255/0.18)] dark:bg-blue-400/15 dark:text-blue-300"
                : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" strokeWidth={active ? 2.4 : 2} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
