import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileText } from "lucide-react";
import { getSocialAnalytics } from "@/actions/social.actions";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/constants";
import { SocialPlatformCard } from "./_components/social-platform-card";
import { SocialAnalytics } from "./_components/social-analytics";

export const metadata: Metadata = { title: "Social Media Integration" };

// ============================================================
// Social Media Integration Settings Page
// ============================================================

export default async function SocialIntegrationPage() {
  const analyticsResult = await getSocialAnalytics();

  const analytics = analyticsResult.success ? analyticsResult.data : [];

  // Build a map of platform -> analytics for the cards
  const analyticsMap: Record<
    string,
    { followers: number; engagement: number; reach: number; posts: number }
  > = {};
  for (const item of analytics) {
    analyticsMap[item.platform] = {
      followers: item.followers,
      engagement: item.engagement,
      reach: item.reach,
      posts: item.posts,
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social Media Integration"
        description="Connect and manage your social media accounts."
      >
        <Link href="/settings/integrations/social/posts">
          <Button variant="outline" size="sm">
            <FileText className="mr-2 size-4" />
            Manage Posts
          </Button>
        </Link>
      </PageHeader>

      {/* Placeholder Notice */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          This is a placeholder integration. Real social media APIs (Meta Graph
          API, Twitter API, LinkedIn API) will be connected later.
        </p>
      </div>

      {/* Platform Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(SOCIAL_PLATFORM_LABELS).map(([key, label]) => (
          <SocialPlatformCard
            key={key}
            platform={key}
            label={label}
            analytics={analyticsMap[key]}
          />
        ))}
      </div>

      {/* Analytics Overview */}
      {analytics.length > 0 && <SocialAnalytics analytics={analytics} />}
    </div>
  );
}
