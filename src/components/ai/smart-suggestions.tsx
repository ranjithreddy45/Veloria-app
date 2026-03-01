"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sparkles,
  RefreshCw,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Users,
  Clock,
  Target,
  Star,
  FileText,
  MessageSquare,
  Briefcase,
  UserPlus,
  GitMerge,
  Reply,
  CalendarPlus,
  Zap,
  Lightbulb,
  IndianRupee,
  Award,
  InboxIcon,
  type LucideIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================
// Types
// ============================================================

interface SmartSuggestion {
  id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: "ACTION" | "INSIGHT" | "WARNING";
  title: string;
  description: string;
  icon: string;
  actionLabel?: string;
  actionHref?: string;
}

interface SmartSuggestionsProps {
  entityType: "lead" | "deal" | "contact";
  entityId: string;
}

// ============================================================
// Icon map
// ============================================================

const ICON_MAP: Record<string, LucideIcon> = {
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  TrendingUp,
  Users,
  Clock,
  Target,
  Star,
  FileText,
  MessageSquare,
  Briefcase,
  UserPlus,
  GitMerge,
  Reply,
  CalendarPlus,
  Zap,
  Lightbulb,
  IndianRupee,
  Award,
};

// ============================================================
// Priority colors
// ============================================================

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 border-red-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  LOW: "bg-green-100 text-green-700 border-green-200",
};

// ============================================================
// Type icons
// ============================================================

const TYPE_ICON_MAP: Record<string, LucideIcon> = {
  ACTION: Zap,
  INSIGHT: Lightbulb,
  WARNING: AlertTriangle,
};

// ============================================================
// Component
// ============================================================

export function SmartSuggestions({ entityType, entityId }: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/ai/suggestions?entityType=${entityType}&entityId=${entityId}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch suggestions");
      }
      const data = await res.json();
      setSuggestions(data.data ?? []);
    } catch (err) {
      console.error("[SmartSuggestions] Fetch error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-amber-500" />
          Smart Suggestions
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={fetchSuggestions}
          disabled={loading}
          title="Refresh suggestions"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 shrink-0 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-4 text-center">
            <AlertTriangle className="text-muted-foreground mx-auto mb-2 size-8" />
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={fetchSuggestions}
            >
              Try Again
            </Button>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-6 text-center">
            <InboxIcon className="text-muted-foreground mx-auto mb-2 size-8" />
            <p className="text-muted-foreground text-sm">
              No suggestions available
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => {
              const SuggestionIcon =
                ICON_MAP[suggestion.icon] ?? Lightbulb;
              const TypeIcon =
                TYPE_ICON_MAP[suggestion.type] ?? Zap;

              return (
                <div
                  key={suggestion.id}
                  className="flex gap-3 rounded-lg border p-3"
                >
                  {/* Icon */}
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <div className="bg-muted flex size-8 items-center justify-center rounded-md">
                      <SuggestionIcon className="size-4" />
                    </div>
                    <TypeIcon className="text-muted-foreground size-3" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">
                        {suggestion.title}
                      </p>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] ${PRIORITY_STYLES[suggestion.priority] ?? ""}`}
                      >
                        {suggestion.priority}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {suggestion.description}
                    </p>
                    {suggestion.actionLabel && (
                      <div className="mt-2">
                        {suggestion.actionHref ? (
                          <a href={suggestion.actionHref}>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              {suggestion.actionLabel}
                            </Button>
                          </a>
                        ) : (
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            {suggestion.actionLabel}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
