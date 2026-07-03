import type { Metadata } from "next";
import Link from "next/link";
import {
  GiftIcon,
  ArrowLeftIcon,
  PlusIcon,
  UserIcon,
  BuildingIcon,
} from "lucide-react";

import { getIncentives } from "@/actions/performance-score.actions";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { AutoIncentivePanel } from "./_components/auto-incentive-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { AwardIncentiveButton } from "./_components/award-incentive-button";

export const metadata: Metadata = {
  title: "Incentives",
};

// ============================================================
// Incentives Page
// ============================================================

export default async function IncentivesPage() {
  const [result, session] = await Promise.all([getIncentives(), auth()]);
  const incentives = result.success ? result.data ?? [] : [];
  const canManage = hasPermission((session?.user as { role?: string } | undefined)?.role ?? "", "performance:manage");

  const pending = incentives.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (i: any) => !i.isAwarded
  );
  const awarded = incentives.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (i: any) => i.isAwarded
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incentives"
        description="Manage performance incentives and rewards for staff and vendors."
      >
        <Button variant="outline" asChild>
          <Link href="/performance/scores">
            <ArrowLeftIcon className="mr-2 size-4" />
            Scores
          </Link>
        </Button>
      </PageHeader>

      {canManage && <AutoIncentivePanel />}

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Incentives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{incentives.length}</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">
              {pending.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Awarded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {awarded.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Incentive Cards */}
      {incentives.length === 0 ? (
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <GiftIcon className="mb-4 size-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">
              No incentives found
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Incentives will appear here once created.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {incentives.map((incentive: any) => {
            const user = incentive.user;
            const vendor = incentive.vendor;
            const recipientName =
              user?.name || vendor?.name || "Unknown";
            const isVendor = !!vendor;

            return (
              <Card
                key={incentive.id}
                className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">
                        {incentive.title}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                        {isVendor ? (
                          <BuildingIcon className="size-3" />
                        ) : (
                          <UserIcon className="size-3" />
                        )}
                        <span className="truncate">{recipientName}</span>
                      </div>
                    </div>
                    <Badge
                      variant={incentive.isAwarded ? "default" : "outline"}
                      className="shrink-0"
                    >
                      {incentive.isAwarded ? "Awarded" : "Pending"}
                    </Badge>
                  </div>

                  {incentive.description && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {incentive.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <Badge variant="secondary">
                      Period: {incentive.period}
                    </Badge>
                    {incentive.points > 0 && (
                      <span className="text-muted-foreground">
                        {incentive.points} pts
                      </span>
                    )}
                    {incentive.bonusAmount != null &&
                      Number(incentive.bonusAmount) > 0 && (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {Number(incentive.bonusAmount).toLocaleString(
                            "en-IN",
                            {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 0,
                            }
                          )}
                        </span>
                      )}
                  </div>

                  {incentive.isAwarded && incentive.awardedAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Awarded on{" "}
                      {new Date(incentive.awardedAt).toLocaleDateString(
                        "en-IN",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </p>
                  )}

                  {!incentive.isAwarded && (
                    <div className="mt-4">
                      <AwardIncentiveButton incentiveId={incentive.id} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
