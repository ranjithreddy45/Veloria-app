"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  Users,
  TrendingUp,
  Eye,
  FileText,
  type LucideIcon,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface PlatformAnalytics {
  platform: string;
  followers: number;
  engagement: number;
  reach: number;
  posts: number;
}

interface SocialAnalyticsProps {
  analytics: PlatformAnalytics[];
}

// ============================================================
// Constants
// ============================================================

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  TWITTER: Twitter,
  LINKEDIN: Linkedin,
};

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TWITTER: "Twitter",
  LINKEDIN: "LinkedIn",
};

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: "text-pink-600 dark:text-pink-400",
  FACEBOOK: "text-blue-600 dark:text-blue-400",
  TWITTER: "text-sky-600 dark:text-sky-400",
  LINKEDIN: "text-indigo-600 dark:text-indigo-400",
};

// ============================================================
// Social Analytics Component
// ============================================================

export function SocialAnalytics({ analytics }: SocialAnalyticsProps) {
  // Aggregate totals
  const totals = analytics.reduce(
    (acc, item) => ({
      followers: acc.followers + item.followers,
      engagement:
        acc.engagement + item.engagement,
      reach: acc.reach + item.reach,
      posts: acc.posts + item.posts,
    }),
    { followers: 0, engagement: 0, reach: 0, posts: 0 }
  );

  const avgEngagement =
    analytics.length > 0
      ? (totals.engagement / analytics.length).toFixed(1)
      : "0";

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950">
              <Users className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {totals.followers.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Followers</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950">
              <TrendingUp className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgEngagement}%</p>
              <p className="text-xs text-muted-foreground">Avg. Engagement</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950">
              <Eye className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {totals.reach.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Total Reach</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
              <FileText className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totals.posts}</p>
              <p className="text-xs text-muted-foreground">Total Posts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Platform Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Platform Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {analytics.map((item) => {
              const Icon = PLATFORM_ICONS[item.platform] ?? Instagram;
              const colorClass =
                PLATFORM_COLORS[item.platform] ?? "text-zinc-600";
              const label =
                PLATFORM_LABELS[item.platform] ?? item.platform;

              return (
                <div
                  key={item.platform}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`size-5 ${colorClass}`} />
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-xs">
                      {item.followers.toLocaleString()} followers
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {item.engagement}% eng.
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {item.reach.toLocaleString()} reach
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
