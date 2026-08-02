"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { celebrate } from "@/lib/celebrate";
import {
  seedEngagementDemo,
  clearEngagementDemo,
} from "@/actions/demo-engagement.actions";

export function DemoDataButtons() {
  const router = useRouter();
  const [seeding, setSeeding] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);

  async function onSeed() {
    setSeeding(true);
    try {
      const res = await seedEngagementDemo();
      if (res.success) {
        celebrate();
        toast.success("Demo data added 🎉", {
          description: `+${res.pointsAwarded ?? 0} Velos and ${res.activity ?? 0} activity items on your account.`,
        });
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not add demo data");
      }
    } finally {
      setSeeding(false);
    }
  }

  async function onClear() {
    setClearing(true);
    try {
      const res = await clearEngagementDemo();
      if (res.success) {
        toast.success("Demo data cleared", {
          description: `Removed ${res.removedPoints ?? 0} points and ${res.removedActivity ?? 0} activity items.`,
        });
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not clear demo data");
      }
    } finally {
      setClearing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sample engagement data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5 text-body text-muted-foreground">
          <li>• Adds <strong className="text-foreground">100 Velos points</strong> to your account this month</li>
          <li>• Adds <strong className="text-foreground">6 recent activity items</strong> to the live feed</li>
          <li>• Lights up the points chip (top bar), the leaderboard standing, and the dashboard activity feed</li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={onSeed} disabled={seeding || clearing}>
            {seeding ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Add demo data
          </Button>
          <Button variant="outline" onClick={onClear} disabled={seeding || clearing}>
            {clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Clear demo data
          </Button>
        </div>
        <p className="text-detail text-muted-foreground">
          After adding, open the <strong className="text-foreground">Dashboard</strong> to see it all. Everything here is tagged and only affects your account — “Clear” removes it completely.
        </p>
      </CardContent>
    </Card>
  );
}
