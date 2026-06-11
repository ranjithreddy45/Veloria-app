"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Instagram, Facebook, Twitter, Linkedin, type LucideIcon } from "lucide-react";

// ============================================================
// Platform Icon Map
// ============================================================

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  TWITTER: Twitter,
  LINKEDIN: Linkedin,
};

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM:
    "bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400",
  FACEBOOK:
    "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  TWITTER:
    "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
  LINKEDIN:
    "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
};

// ============================================================
// Types
// ============================================================

interface SocialPlatformCardProps {
  platform: string;
  label: string;
  analytics?: {
    followers: number;
    engagement: number;
    reach: number;
    posts: number;
  };
}

// ============================================================
// Social Platform Card
// ============================================================

export function SocialPlatformCard({
  platform,
  label,
  analytics,
}: SocialPlatformCardProps) {
  const [connected, setConnected] = useState(false);
  const Icon = PLATFORM_ICONS[platform] ?? Instagram;
  const colorClass = PLATFORM_COLORS[platform] ?? PLATFORM_COLORS.INSTAGRAM;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
            >
              <Icon className="size-5" />
            </div>
            <div>
              <CardTitle className="text-base">{label}</CardTitle>
              <CardDescription className="text-xs">
                {connected ? "@veloria_grand" : "Not connected"}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              connected
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-zinc-100 text-zinc-600 border-zinc-200"
            }
          >
            {connected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Connection Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">
              {connected ? "Connected" : "Connect Account"}
            </p>
            <p className="text-xs text-muted-foreground">
              {connected
                ? "Account is linked (placeholder)"
                : "Link your account to start posting"}
            </p>
          </div>
          <Switch
            checked={connected}
            onCheckedChange={setConnected}
          />
        </div>

        {/* Analytics Preview */}
        {connected && analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold text-foreground">
                {analytics.followers.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold text-foreground">
                {analytics.engagement}%
              </p>
              <p className="text-xs text-muted-foreground">Engagement</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold text-foreground">
                {analytics.reach.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Reach</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-lg font-bold text-foreground">
                {analytics.posts}
              </p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
          </div>
        )}

        {/* Disconnect Button */}
        {connected && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            onClick={() => setConnected(false)}
          >
            Disconnect Account
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
