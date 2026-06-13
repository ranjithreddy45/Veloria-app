import type { Metadata } from "next";
import Link from "next/link";
import {
  PlusIcon,
  SettingsIcon,
  PencilIcon,
  ZapIcon,
  BanknoteIcon,
  PercentIcon,
  CoinsIcon,
} from "lucide-react";

import { getReferralRewardRules } from "@/actions/referral-engine.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Referral Reward Rules | Settings",
};

// ============================================================
// Trigger Event Config
// ============================================================

const TRIGGER_EVENT_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  BOOKING_CONFIRMED: {
    label: "Booking Confirmed",
    color:
      "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400",
  },
  HIGH_VALUE_BOOKING: {
    label: "High-Value Booking",
    color:
      "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400",
  },
  REPEAT_REFERRAL: {
    label: "Repeat Referral",
    color:
      "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400",
  },
};

const REWARD_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode }
> = {
  POINTS: {
    label: "Points",
    icon: <CoinsIcon className="size-3" />,
  },
  CASH: {
    label: "Cash",
    icon: <BanknoteIcon className="size-3" />,
  },
  DISCOUNT: {
    label: "Discount",
    icon: <PercentIcon className="size-3" />,
  },
};

// ============================================================
// Referral Reward Rules Page
// ============================================================

export default async function ReferralRewardRulesPage() {
  const result = await getReferralRewardRules();
  const rules = result.success ? result.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referral Reward Rules"
        help={<PageHelp id="referral-rules" />}
        description="Define how referral rewards are calculated and distributed."
      >
        <Button asChild>
          <Link href="/settings/referral-rules/new">
            <PlusIcon className="mr-2 size-4" />
            New Rule
          </Link>
        </Button>
      </PageHeader>

      {rules.length === 0 ? (
        <Card className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <SettingsIcon className="mb-4 size-12 text-muted-foreground/40" />
            <p className="text-lg font-medium text-muted-foreground">
              No reward rules defined
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Create rules to automatically reward referrers when conditions are
              met.
            </p>
            <Button asChild className="mt-4">
              <Link href="/settings/referral-rules/new">
                <PlusIcon className="mr-2 size-4" />
                Create First Rule
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {rules.map((rule: any) => {
            const triggerConfig = TRIGGER_EVENT_CONFIG[rule.triggerEvent] || {
              label: rule.triggerEvent,
              color: "",
            };
            const rewardConfig = REWARD_TYPE_CONFIG[rule.rewardType] || {
              label: rule.rewardType,
              icon: null,
            };
            const rewardsCount = rule._count?.rewards ?? 0;

            return (
              <Card
                key={rule.id}
                className="border-zinc-200/80 dark:border-zinc-700/80 shadow-sm"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base truncate">
                        {rule.name}
                      </CardTitle>
                      {rule.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {rule.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={rule.isActive ? "default" : "secondary"}
                      className="shrink-0 ml-2"
                    >
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Trigger Event */}
                    <div className="flex items-center gap-2">
                      <ZapIcon className="size-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Trigger:
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${triggerConfig.color}`}
                      >
                        {triggerConfig.label}
                      </Badge>
                    </div>

                    {/* Reward */}
                    <div className="flex items-center gap-2">
                      {rewardConfig.icon}
                      <span className="text-sm text-muted-foreground">
                        Reward:
                      </span>
                      <span className="text-sm font-medium">
                        {rule.rewardType === "CASH"
                          ? Number(rule.rewardValue).toLocaleString("en-IN", {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 0,
                            })
                          : rule.rewardType === "DISCOUNT"
                          ? `${Number(rule.rewardValue)}%`
                          : `${Number(rule.rewardValue)} pts`}{" "}
                        ({rewardConfig.label})
                      </span>
                    </div>

                    {/* Min Booking Value */}
                    {rule.minBookingValue != null && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Min Booking:</span>
                        <span className="font-medium text-foreground">
                          {Number(rule.minBookingValue).toLocaleString(
                            "en-IN",
                            {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 0,
                            }
                          )}
                        </span>
                      </div>
                    )}

                    {/* Tier & Multiplier */}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Tier: <span className="font-medium text-foreground">{rule.tierLevel}</span>
                      </span>
                      {rule.bonusMultiplier != null && (
                        <span className="text-muted-foreground">
                          Multiplier:{" "}
                          <span className="font-medium text-foreground">
                            {Number(rule.bonusMultiplier)}x
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Rewards Count */}
                    <div className="text-xs text-muted-foreground">
                      {rewardsCount} reward{rewardsCount !== 1 ? "s" : ""}{" "}
                      generated
                    </div>

                    {/* Edit Link */}
                    <div className="pt-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/settings/referral-rules/${rule.id}/edit`}>
                          <PencilIcon className="mr-2 size-3" />
                          Edit
                        </Link>
                      </Button>
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
