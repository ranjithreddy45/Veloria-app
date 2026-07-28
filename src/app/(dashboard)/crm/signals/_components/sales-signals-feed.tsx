"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  UserPlusIcon,
  TrendingUpIcon,
  IndianRupeeIcon,
  CalendarCheckIcon,
  MessageSquareIcon,
  CheckCircleIcon,
  TargetIcon,
  Loader2Icon,
  ChevronDownIcon,
  HistoryIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  getSalesSignals,
  type SalesSignal,
} from "@/actions/sales-signals.actions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ============================================================
// Icon Mapping
// ============================================================

const ICON_MAP: Record<string, LucideIcon> = {
  UserPlus: UserPlusIcon,
  TrendingUp: TrendingUpIcon,
  IndianRupee: IndianRupeeIcon,
  CalendarCheck: CalendarCheckIcon,
  MessageSquare: MessageSquareIcon,
  CheckCircle: CheckCircleIcon,
  Target: TargetIcon,
};

const CATEGORY_CONFIG: Record<
  string,
  { label: string; badgeColor: string }
> = {
  lead: { label: "Lead", badgeColor: "bg-blue-100 text-blue-700 border-blue-200" },
  deal: { label: "Deal", badgeColor: "bg-purple-100 text-purple-700 border-purple-200" },
  payment: { label: "Payment", badgeColor: "bg-green-100 text-green-700 border-green-200" },
  booking: { label: "Booking", badgeColor: "bg-amber-100 text-amber-700 border-amber-200" },
  communication: {
    label: "Communication",
    badgeColor: "bg-sky-100 text-sky-700 border-sky-200",
  },
  task: { label: "Task", badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  activity: {
    label: "Activity",
    badgeColor: "bg-zinc-100 text-zinc-700 border-zinc-200",
  },
};

const ALL_CATEGORIES = ["lead", "deal", "payment", "booking", "communication", "task"];

// ============================================================
// Component
// ============================================================

export function SalesSignalsFeed() {
  const [signals, setSignals] = React.useState<SalesSignal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);

  const fetchSignals = React.useCallback(
    async (pageNum: number, category: string | null, append = false) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const result = await getSalesSignals(category || undefined, pageNum, 30);

      if (result.success) {
        if (append) {
          setSignals((prev) => [...prev, ...result.data.signals]);
        } else {
          setSignals(result.data.signals);
        }
        setTotal(result.data.total);
        setHasMore(result.data.hasMore);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    []
  );

  React.useEffect(() => {
    setPage(1);
    fetchSignals(1, activeCategory);
  }, [fetchSignals, activeCategory]);

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchSignals(nextPage, activeCategory, true);
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HistoryIcon className="text-muted-foreground size-5" />
            <CardTitle className="text-base">Activity Feed</CardTitle>
            <span className="text-muted-foreground text-xs">Last 72 hours</span>
          </div>
          <span className="text-muted-foreground text-xs">{total} signals</span>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-all",
              activeCategory === null
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            All
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  activeCategory === cat
                    ? config.badgeColor
                    : "border-border bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
            <span className="text-muted-foreground ml-2 text-sm">
              Loading signals...
            </span>
          </div>
        ) : signals.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">
            No signals in the last 72 hours.
          </p>
        ) : (
          <div className="space-y-3">
            {signals.map((signal, i) => {
              const Icon = ICON_MAP[signal.icon] || HistoryIcon;
              const catConfig =
                CATEGORY_CONFIG[signal.category] || CATEGORY_CONFIG.activity;

              return (
                <div
                  key={`${signal.id}-${i}`}
                  className="border-border hover:bg-muted/50 flex items-start gap-3 rounded-lg border p-3 transition-colors"
                >
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      signal.color
                    )}
                  >
                    <Icon className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border text-[11px] font-medium",
                          catConfig.badgeColor
                        )}
                      >
                        {catConfig.label}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(signal.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium leading-snug">
                      {signal.entityUrl ? (
                        <Link
                          href={signal.entityUrl}
                          className="hover:underline"
                        >
                          {signal.title}
                        </Link>
                      ) : (
                        signal.title
                      )}
                    </p>
                    {signal.description && (
                      <p className="text-muted-foreground mt-0.5 text-xs line-clamp-2">
                        {signal.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {hasMore && !loading && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : (
                <ChevronDownIcon className="mr-2 size-4" />
              )}
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
