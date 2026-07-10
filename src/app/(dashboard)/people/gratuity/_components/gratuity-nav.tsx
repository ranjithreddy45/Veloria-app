"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Table2, FileBarChart, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Sub-navigation across the three gratuity surfaces. Styled to match the
// app's ClickUp-style ViewTabs pill group; active tab derived from the path.
const TABS = [
  { href: "/people/gratuity", label: "Ledger", icon: Table2 },
  { href: "/people/gratuity/report", label: "Report", icon: FileBarChart },
  { href: "/people/gratuity/add", label: "Add Gratuity", icon: PlusCircle },
] as const;

export function GratuityNav() {
  const pathname = usePathname();
  return (
    <div
      role="tablist"
      aria-label="Gratuity"
      className="inline-flex items-center gap-0.5 rounded-xl border border-border/70 bg-muted/40 p-0.5"
    >
      {TABS.map((t) => {
        // Exact match so /report and /add don't both light up the ledger tab.
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium transition-all duration-150 active:scale-[0.97]",
              active
                ? "bg-violet-500/12 text-violet-600 shadow-[inset_0_0_0_1px_oklch(0.55_0.25_293/0.18)] dark:bg-violet-400/15 dark:text-violet-300"
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
