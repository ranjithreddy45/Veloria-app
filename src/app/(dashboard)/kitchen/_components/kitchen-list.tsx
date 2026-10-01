"use client";

import Link from "next/link";
import { ChefHat, IndianRupee, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINR } from "@/lib/utils";
import type { KitchenPlanRowDTO } from "@/actions/kitchen.actions";
import { STATUS_LABEL, statusHue, fmtEventDate } from "./kitchen-format";

// The "New plan" create action lives in the page header's action cluster
// (kitchen/page.tsx, NewKitchenPlanDialog); this component is the list.
export function KitchenList({
  plans,
  canWrite,
}: {
  plans: KitchenPlanRowDTO[];
  /** kitchen:write. Only changes the empty-state copy here. */
  canWrite: boolean;
}) {
  const active = plans.filter((p) => p.status !== "COMPLETED").length;
  const totalEst = plans.reduce((a, p) => a + p.estFoodCost, 0);
  const coversTotal = plans.reduce((a, p) => a + p.covers, 0);
  const avgPerCover = coversTotal > 0 ? totalEst / coversTotal : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Active plans"
          value={active}
          accent="amber"
          icon={<ChefHat className="size-4" />}
        />
        <StatTile label="Total plans" value={plans.length} accent="indigo" />
        <StatTile
          label="Total est. food cost"
          value={formatINR(totalEst)}
          accent="emerald"
          icon={<IndianRupee className="size-4" />}
        />
        <StatTile
          label="Avg cost / cover"
          value={formatINR(avgPerCover)}
          accent="gold"
          icon={<Users className="size-4" />}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Production plans</h2>
          </div>

          {plans.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<ChefHat className="size-6" />}
                title="No kitchen plans yet"
                description={
                  canWrite
                    ? "Create a production plan for a confirmed event to start food-costing."
                    : "No production plans have been created yet."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Event</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 text-right font-medium">Covers</th>
                    <th className="px-4 py-2.5 text-right font-medium">Est. food cost</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cost / cover</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr
                      key={p.id}
                      className="group border-b last:border-0 transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/kitchen/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.eventName ?? "Untitled event"}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.itemCount} item{p.itemCount === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {fmtEventDate(p.eventDate)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{p.covers}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {formatINR(p.estFoodCost)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatINR(p.perCoverCost)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill
                          label={STATUS_LABEL[p.status] ?? p.status}
                          hue={statusHue(p.status)}
                          size="xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
