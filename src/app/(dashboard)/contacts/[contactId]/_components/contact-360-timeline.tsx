"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  MessageSquareIcon,
  CalendarCheckIcon,
  FileTextIcon,
  IndianRupeeIcon,
  FileIcon,
  TargetIcon,
  SmartphoneIcon,
  FileSignatureIcon,
  CheckSquareIcon,
  UserPlusIcon,
  Loader2Icon,
  ChevronDownIcon,
  FilterIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  getContact360Timeline,
  type TimelineItem,
} from "@/actions/timeline.actions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

// ============================================================
// Icon & Color Mapping
// ============================================================

const TYPE_CONFIG: Record<
  string,
  { icon: LucideIcon; color: string; label: string }
> = {
  communication: {
    icon: MessageSquareIcon,
    color: "bg-sky-100 text-sky-700 border-sky-200",
    label: "Communication",
  },
  booking: {
    icon: CalendarCheckIcon,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    label: "Booking",
  },
  invoice: {
    icon: FileTextIcon,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    label: "Invoice",
  },
  payment: {
    icon: IndianRupeeIcon,
    color: "bg-green-100 text-green-700 border-green-200",
    label: "Payment",
  },
  quote: {
    icon: FileIcon,
    color: "bg-violet-100 text-violet-700 border-violet-200",
    label: "Quote",
  },
  deal: {
    icon: TargetIcon,
    color: "bg-indigo-100 text-indigo-700 border-indigo-200",
    label: "Deal",
  },
  lead: {
    icon: UserPlusIcon,
    color: "bg-pink-100 text-pink-700 border-pink-200",
    label: "Lead",
  },
  whatsapp: {
    icon: SmartphoneIcon,
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    label: "WhatsApp",
  },
  contract: {
    icon: FileSignatureIcon,
    color: "bg-orange-100 text-orange-700 border-orange-200",
    label: "Contract",
  },
  task: {
    icon: CheckSquareIcon,
    color: "bg-teal-100 text-teal-700 border-teal-200",
    label: "Task",
  },
};

const ALL_TYPES = Object.keys(TYPE_CONFIG);

// ============================================================
// Component
// ============================================================

interface Contact360TimelineProps {
  contactId: string;
}

export function Contact360Timeline({ contactId }: Contact360TimelineProps) {
  const [items, setItems] = React.useState<TimelineItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [activeFilters, setActiveFilters] = React.useState<string[]>([]);

  const fetchTimeline = React.useCallback(
    async (pageNum: number, filters: string[], append = false) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const result = await getContact360Timeline(
        contactId,
        pageNum,
        20,
        filters.length > 0 ? filters : undefined
      );

      if (result.success) {
        if (append) {
          setItems((prev) => [...prev, ...result.data.items]);
        } else {
          setItems(result.data.items);
        }
        setTotal(result.data.total);
        setHasMore(result.data.hasMore);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [contactId]
  );

  React.useEffect(() => {
    setPage(1);
    fetchTimeline(1, activeFilters);
  }, [fetchTimeline, activeFilters]);

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTimeline(nextPage, activeFilters, true);
  }

  function toggleFilter(type: string) {
    setActiveFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function clearFilters() {
    setActiveFilters([]);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">360° Timeline</CardTitle>
            <p className="text-muted-foreground text-xs mt-1">
              {total} activities across all touchpoints
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FilterIcon className="size-4 text-muted-foreground" />
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {ALL_TYPES.map((type) => {
            const config = TYPE_CONFIG[type];
            const isActive =
              activeFilters.length === 0 || activeFilters.includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleFilter(type)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                  isActive
                    ? config.color
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                <config.icon className="size-3" />
                {config.label}
              </button>
            );
          })}
          {activeFilters.length > 0 && (
            <button
              onClick={clearFilters}
              className="border-border text-muted-foreground hover:bg-accent inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
            <span className="text-muted-foreground ml-2 text-sm">
              Loading timeline...
            </span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            className="py-12"
            icon={<TargetIcon />}
            title="No activity yet"
            description="Leads, bookings, invoices and conversations for this contact will stack up here as a single timeline."
          />
        ) : (
          <div className="relative space-y-0">
            {/* Vertical timeline line */}
            <div className="absolute top-0 bottom-0 left-5 w-px bg-border" />

            {items.map((item, index) => {
              const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.communication;
              const Icon = config.icon;
              const isLast = index === items.length - 1;

              return (
                <div
                  key={`${item.type}-${item.id}-${index}`}
                  className={cn(
                    "relative flex gap-4 pl-0",
                    !isLast && "pb-5"
                  )}
                >
                  {/* Icon circle on timeline */}
                  <div
                    className={cn(
                      "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border",
                      config.color
                    )}
                  >
                    <Icon className="size-4" />
                  </div>

                  {/* Content card */}
                  <div className="min-w-0 flex-1 rounded-xl border bg-card p-3.5 shadow-card transition-shadow hover:shadow-card-hover">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "border font-medium text-meta",
                              config.color
                            )}
                          >
                            {config.label}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(item.timestamp), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium leading-snug">
                          {item.entityUrl ? (
                            <Link
                              href={item.entityUrl}
                              className="hover:underline"
                            >
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )}
                        </p>
                        {item.description && (
                          <p className="text-muted-foreground mt-0.5 text-xs line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More Button */}
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
              Load More ({total - items.length} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
