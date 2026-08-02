"use client";

import * as React from "react";
import { Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ============================================================
// WhatsNew — a header button that opens a popover of recent releases. Entries
// are a small typed constant (no DB / CMS). We persist the newest version the
// user has opened in localStorage and show an unread dot until they open it.
// ============================================================

interface Release {
  version: string;
  date: string; // ISO date, shown as a friendly label
  items: string[];
}

// Seeded from recent shipped work. Newest first — RELEASES[0] is "latest".
const RELEASES: Release[] = [
  {
    version: "0.1.0",
    date: "2026-07-10",
    items: [
      "ClickUp-style workspace kit: module header chips, view tabs, and kanban boards.",
      "Colored sidebar icon tiles across the app shell.",
    ],
  },
  {
    version: "0.0.9",
    date: "2026-07-10",
    items: [
      "HR self-service is live — employees can reach their own attendance, payslips, and leaves.",
      "Time & Attendance: monthly calendar, admin edit, and muster export.",
    ],
  },
  {
    version: "0.0.8",
    date: "2026-07-10",
    items: [
      "Attendance geo-tag hardened — five integrity holes closed for trustworthy check-ins.",
    ],
  },
  {
    version: "0.0.7",
    date: "2026-07-10",
    items: [
      "Payroll now computes employer PF/ESI correctly, so CTC reflects true employer cost.",
    ],
  },
];

const STORAGE_KEY = "veloria:whats-new:last-seen-version";
const LATEST_VERSION = RELEASES[0]?.version ?? "";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function WhatsNew() {
  const [open, setOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(false);

  // On mount, compare the newest release against the last version the user opened.
  React.useEffect(() => {
    if (!LATEST_VERSION) return;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      setUnread(seen !== LATEST_VERSION);
    } catch {
      // localStorage unavailable (private mode / SSR guard) — just show no dot.
      setUnread(false);
    }
  }, []);

  const markSeen = React.useCallback(() => {
    setUnread(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, LATEST_VERSION);
    } catch {
      /* ignore */
    }
  }, []);

  const onOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) markSeen();
    },
    [markSeen]
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 rounded-full text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-[0.94]"
          title="What's new"
        >
          <Gift className="size-4" />
          <span className="sr-only">What&apos;s new</span>
          {unread && (
            <span
              aria-hidden
              className={cn(
                "absolute right-1.5 top-1.5 size-2 rounded-full bg-primary",
                "ring-2 ring-background"
              )}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <Sparkles className="size-4 text-primary" />
          <div className="flex flex-col">
            <p className="text-sm font-semibold leading-none">What&apos;s new</p>
            <p className="mt-1 text-meta text-muted-foreground">
              Recent updates to Veloria
            </p>
          </div>
        </div>
        <ScrollArea className="max-h-80">
          <ul className="divide-y divide-border/50">
            {RELEASES.map((rel) => (
              <li key={rel.version} className="px-4 py-3">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-detail font-semibold tabular-nums text-foreground">
                    v{rel.version}
                  </span>
                  <span className="text-meta text-muted-foreground">
                    {formatDate(rel.date)}
                  </span>
                </div>
                <ul className="space-y-1">
                  {rel.items.map((item, i) => (
                    <li
                      key={i}
                      className="flex gap-1.5 text-detail leading-snug text-muted-foreground"
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
