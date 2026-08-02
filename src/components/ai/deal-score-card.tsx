"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { aiScoreDeal } from "@/actions/ai.actions";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface DealScoreCardProps {
  dealId: string;
  currentScore?: number | null;
  currentReason?: string | null;
  currentFactors?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  scoredAt?: string | Date | null;
}

type Factor = {
  name: string;
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  score: number;
  description: string;
};

// ============================================================
// Helpers
// ============================================================

function getRiskLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 70) return "LOW";
  if (score >= 50) return "MEDIUM";
  if (score >= 30) return "HIGH";
  return "CRITICAL";
}

function getRiskBadgeConfig(risk: string) {
  switch (risk) {
    case "LOW":
      return {
        label: "Low Risk",
        className: "bg-green-100 text-green-800 border-green-200",
        icon: ShieldCheck,
      };
    case "MEDIUM":
      return {
        label: "Medium Risk",
        className: "bg-yellow-100 text-yellow-800 border-yellow-200",
        icon: AlertTriangle,
      };
    case "HIGH":
      return {
        label: "High Risk",
        className: "bg-orange-100 text-orange-800 border-orange-200",
        icon: ShieldAlert,
      };
    case "CRITICAL":
      return {
        label: "Critical Risk",
        className: "bg-red-100 text-red-800 border-red-200",
        icon: ShieldAlert,
      };
    default:
      return {
        label: "Unknown",
        className: "bg-zinc-100 text-zinc-800 border-zinc-200",
        icon: Minus,
      };
  }
}

function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  if (score >= 30) return "text-orange-600";
  return "text-red-600";
}

function getScoreTrackColor(score: number): string {
  if (score >= 70) return "stroke-green-500";
  if (score >= 50) return "stroke-yellow-500";
  if (score >= 30) return "stroke-orange-500";
  return "stroke-red-500";
}

function getImpactIcon(impact: string) {
  switch (impact) {
    case "POSITIVE":
      return <TrendingUp className="size-3.5 text-green-600 shrink-0" />;
    case "NEGATIVE":
      return <TrendingDown className="size-3.5 text-red-600 shrink-0" />;
    default:
      return <Minus className="size-3.5 text-zinc-400 shrink-0" />;
  }
}

function formatScoredAt(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(d);
}

// ============================================================
// Circular Progress Component
// ============================================================

function ScoreGauge({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const trackColorClass = getScoreTrackColor(score);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
        {/* Background track */}
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-zinc-100"
        />
        {/* Progress arc */}
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className={cn("transition-all duration-700 ease-out", trackColorClass)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-xl font-bold", getScoreColor(score))}>
          {score}
        </span>
        <span className="text-meta text-zinc-400 font-medium">/ 100</span>
      </div>
    </div>
  );
}

// ============================================================
// Component
// ============================================================

export function DealScoreCard({
  dealId,
  currentScore,
  currentReason,
  currentFactors,
  scoredAt,
}: DealScoreCardProps) {
  const [isPending, startTransition] = useTransition();
  const [localScore, setLocalScore] = useState(currentScore);
  const [localReason, setLocalReason] = useState(currentReason);
  const [localFactors, setLocalFactors] = useState(currentFactors);
  const [localScoredAt, setLocalScoredAt] = useState(scoredAt);
  const [showDetails, setShowDetails] = useState(false);

  const hasScore = localScore !== null && localScore !== undefined;
  const riskLevel = hasScore ? getRiskLevel(localScore) : null;
  const riskConfig = riskLevel ? getRiskBadgeConfig(riskLevel) : null;

  // Parse factors from JSON
  let factors: Factor[] = [];
  let recommendations: string[] = [];

  if (localFactors) {
    try {
      const parsed =
        typeof localFactors === "string"
          ? JSON.parse(localFactors)
          : localFactors;
      if (parsed.factors && Array.isArray(parsed.factors)) {
        factors = parsed.factors;
      }
      if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
        recommendations = parsed.recommendations;
      }
    } catch {
      // Failed to parse factors, keep empty
    }
  }

  const handleScore = () => {
    startTransition(async () => {
      const result = await aiScoreDeal(dealId);
      if (result.success) {
        const data = result.data;
        setLocalScore(data.winProbability);
        setLocalReason(data.explanation);
        setLocalFactors({
          factors: data.factors,
          recommendations: data.recommendations,
        });
        setLocalScoredAt(new Date().toISOString());
        toast.success("Deal scored successfully", {
          description: `Win probability: ${data.winProbability}% (${data.riskLevel} risk)`,
        });
      } else {
        toast.error("Failed to score deal", { description: result.error });
      }
    });
  };

  // Loading state
  if (isPending) {
    return (
      <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-indigo-600 animate-pulse" />
            <CardTitle className="text-sm font-semibold text-zinc-700">
              AI Deal Score
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <Skeleton className="size-[88px] rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No score yet — show prompt
  if (!hasScore) {
    return (
      <Card className="border-dashed border-indigo-200 bg-gradient-to-br from-indigo-50/30 to-white">
        <CardContent className="flex flex-col items-center justify-center py-6 gap-3">
          <div className="flex items-center justify-center size-12 rounded-full bg-indigo-100">
            <Sparkles className="size-5 text-indigo-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-zinc-700">
              AI Deal Scoring
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Analyze this deal with AI to get win probability, risk assessment, and recommendations.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleScore}
            disabled={isPending}
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Brain className="size-3.5" />
            Score This Deal
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Score exists — display results
  const RiskIcon = riskConfig!.icon;

  return (
    <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-white">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-indigo-600" />
            <CardTitle className="text-sm font-semibold text-zinc-700">
              AI Deal Score
            </CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            {localScoredAt && (
              <span className="flex items-center gap-1 text-meta text-zinc-400">
                <Clock className="size-3" />
                {formatScoredAt(localScoredAt)}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleScore}
              disabled={isPending}
              title="Rescore deal"
            >
              <RefreshCw
                className={cn(
                  "size-3.5 text-zinc-500",
                  isPending && "animate-spin"
                )}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Score gauge + risk badge */}
        <div className="flex items-center gap-4">
          <ScoreGauge score={localScore} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Badge
                variant="outline"
                className={cn("text-meta px-1.5 py-0", riskConfig!.className)}
              >
                <RiskIcon className="size-3 mr-0.5" />
                {riskConfig!.label}
              </Badge>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed line-clamp-3">
              {localScore >= 70
                ? "Strong deal with high win probability. Focus on closing activities."
                : localScore >= 50
                  ? "Moderate deal health. Address key concerns to improve probability."
                  : localScore >= 30
                    ? "Deal needs attention. Several risk factors identified."
                    : "Critical risk. Immediate action required to save this deal."}
            </p>
          </div>
        </div>

        {/* Factor breakdown (collapsible) */}
        {factors.length > 0 && (
          <div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-meta font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              {showDetails ? "Hide details" : "Show factor breakdown"}
              <svg
                className={cn(
                  "size-3 transition-transform",
                  showDetails && "rotate-180"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showDetails && (
              <div className="mt-2 space-y-3">
                {/* Factors list */}
                <div className="space-y-1.5">
                  {factors.map((factor, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-md bg-white/70 dark:bg-card/70 p-2 border border-zinc-100 dark:border-zinc-800"
                    >
                      {getImpactIcon(factor.impact)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-meta font-medium text-zinc-700">
                            {factor.name}
                          </span>
                          <span
                            className={cn(
                              "text-meta font-semibold tabular-nums",
                              factor.impact === "POSITIVE"
                                ? "text-green-600"
                                : factor.impact === "NEGATIVE"
                                  ? "text-red-600"
                                  : "text-zinc-500"
                            )}
                          >
                            +{factor.score}
                          </span>
                        </div>
                        <p className="text-meta text-zinc-500 leading-relaxed mt-0.5">
                          {factor.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recommendations */}
                {recommendations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Lightbulb className="size-3 text-amber-500" />
                      <span className="text-meta font-medium text-zinc-600">
                        Recommendations
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {recommendations.map((rec, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 text-meta text-zinc-600 leading-relaxed"
                        >
                          <CheckCircle2 className="size-3 text-indigo-400 mt-0.5 shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
