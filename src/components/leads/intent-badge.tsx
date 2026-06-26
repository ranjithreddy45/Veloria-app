"use client";

import * as React from "react";
import { Flame, CalendarClock, BadgeIndianRupee, Snowflake, MessageCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================================
// IntentBadge — colored inbound-intent chip (presentational)
// ============================================================
// Reused on the lead worklist row + lead-detail header. No data fetching.

type Intent =
  | "READY_TO_BUY"
  | "DATE_CHECK"
  | "PRICE_OBJECTION"
  | "COLD"
  | "GENERAL"
  | (string & {});

interface IntentMeta {
  label: string;
  className: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const INTENT_META: Record<string, IntentMeta> = {
  READY_TO_BUY: {
    label: "Ready to buy",
    className:
      "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    Icon: Flame,
  },
  DATE_CHECK: {
    label: "Date check",
    className:
      "bg-sky-500/12 text-sky-700 dark:text-sky-400 border-sky-500/20",
    Icon: CalendarClock,
  },
  PRICE_OBJECTION: {
    label: "Price objection",
    className:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    Icon: BadgeIndianRupee,
  },
  COLD: {
    label: "Cold",
    className:
      "bg-slate-500/12 text-slate-600 dark:text-slate-400 border-slate-500/20",
    Icon: Snowflake,
  },
  GENERAL: {
    label: "General",
    className: "bg-muted text-muted-foreground border-border",
    Icon: MessageCircle,
  },
};

export interface IntentBadgeProps {
  intent: Intent | null | undefined;
  confidence?: number | null;
  method?: "LLM" | "KEYWORD" | string | null;
  className?: string;
  /** Hide when intent is null/GENERAL (e.g. on dense worklist rows). */
  hideGeneral?: boolean;
}

export function IntentBadge({
  intent,
  confidence,
  method,
  className,
  hideGeneral = false,
}: IntentBadgeProps) {
  if (!intent) return null;
  if (hideGeneral && intent === "GENERAL") return null;

  const meta = INTENT_META[intent] ?? INTENT_META.GENERAL;
  const { Icon } = meta;

  const pct =
    typeof confidence === "number"
      ? `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`
      : null;

  const badge = (
    <Badge className={cn("gap-1", meta.className, className)}>
      <Icon className="size-3" />
      {meta.label}
    </Badge>
  );

  if (!pct && !method) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{badge}</span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <div className="font-medium">{meta.label}</div>
          {pct && <div className="text-muted-foreground">Confidence {pct}</div>}
          {method && (
            <div className="text-muted-foreground">
              Source {method === "LLM" ? "AI model" : "Keyword match"}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
