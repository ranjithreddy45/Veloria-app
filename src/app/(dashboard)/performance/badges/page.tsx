import type { Metadata } from "next";
import Link from "next/link";
import {
  AwardIcon,
  ArrowLeftIcon,
  ZapIcon,
  ShieldCheckIcon,
  CrownIcon,
  StarIcon,
  TrophyIcon,
  MedalIcon,
  UserIcon,
  BuildingIcon,
} from "lucide-react";

import { getBadges } from "@/actions/performance-score.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BADGE_TYPE_LABELS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Badges & Recognition",
};

// ============================================================
// Badge Icon Map
// ============================================================

const BADGE_ICONS: Record<string, React.ReactNode> = {
  SPEED_STAR: <ZapIcon className="size-5 text-amber-500" />,
  QUALITY_CHAMPION: <ShieldCheckIcon className="size-5 text-blue-500" />,
  RELIABILITY_KING: <CrownIcon className="size-5 text-violet-500" />,
  ZERO_ESCALATION: <StarIcon className="size-5 text-emerald-500" />,
  TOP_PERFORMER: <TrophyIcon className="size-5 text-amber-600" />,
  MONTHLY_BEST: <MedalIcon className="size-5 text-rose-500" />,
};

const BADGE_BG_COLORS: Record<string, string> = {
  SPEED_STAR: "bg-amber-100 dark:bg-amber-900/30",
  QUALITY_CHAMPION: "bg-blue-100 dark:bg-blue-900/30",
  RELIABILITY_KING: "bg-violet-100 dark:bg-violet-900/30",
  ZERO_ESCALATION: "bg-emerald-100 dark:bg-emerald-900/30",
  TOP_PERFORMER: "bg-amber-100 dark:bg-amber-900/30",
  MONTHLY_BEST: "bg-rose-100 dark:bg-rose-900/30",
};

// ============================================================
// Badges & Recognition Page
// ============================================================

export default async function BadgesPage() {
  const result = await getBadges();
  const badges = result.success ? result.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Badges & Recognition"
        description="All badges earned by staff and vendors for outstanding performance."
      >
        <Button variant="outline" asChild>
          <Link href="/performance/scores">
            <ArrowLeftIcon className="mr-2 size-4" />
            Scores
          </Link>
        </Button>
      </PageHeader>

      {badges.length === 0 ? (
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AwardIcon className="mb-4 size-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">
              No badges awarded yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Badges will appear here once they are earned.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {badges.map((badge: any) => {
            const user = badge.user;
            const vendor = badge.vendor;
            const recipientName =
              user?.name || vendor?.name || "Unknown";
            const isVendor = !!vendor;
            const icon = BADGE_ICONS[badge.type] || (
              <AwardIcon className="size-5 text-muted-foreground" />
            );
            const bgColor =
              BADGE_BG_COLORS[badge.type] || "bg-zinc-100 dark:bg-zinc-800/30";

            return (
              <Card
                key={badge.id}
                className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm"
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div
                      className={`flex size-14 items-center justify-center rounded-full ${bgColor}`}
                    >
                      {icon}
                    </div>

                    {/* Title & Type */}
                    <p className="mt-3 font-semibold">{badge.title}</p>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {BADGE_TYPE_LABELS[badge.type] || badge.type}
                    </Badge>

                    {/* Description */}
                    {badge.description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {badge.description}
                      </p>
                    )}

                    {/* Recipient */}
                    <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
                      {isVendor ? (
                        <BuildingIcon className="size-3" />
                      ) : (
                        <UserIcon className="size-3" />
                      )}
                      <span>{recipientName}</span>
                    </div>

                    {/* Date & Period */}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {badge.period && (
                        <span className="mr-2">Period: {badge.period}</span>
                      )}
                      <span>
                        {new Date(badge.earnedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
