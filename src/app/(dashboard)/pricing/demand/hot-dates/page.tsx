import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, FlameIcon } from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getHotDates } from "@/actions/peak-dates.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HotDatesTable } from "../_components/hot-dates-table";

export const metadata: Metadata = { title: "Hot Dates" };

// ============================================================
// Hot-dates report — upcoming premium dates, hottest-first.
// ------------------------------------------------------------
// Every upcoming date (next ~120 days) that carries a premium — peak dates +
// weekends — with its tier, recommended premium %, and how booked it already
// is across all venues. So Sales holds firm on scarce dates and pushes open ones.
// ============================================================

export default async function HotDatesPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!hasPermission(role, "pricing:read")) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You don&apos;t have access to pricing.
      </div>
    );
  }

  const res = await getHotDates({ days: 120 });
  const rows = res.success ? res.data.rows : [];
  const enabled = res.success ? res.data.config.enabled : true;

  const peakCount = rows.filter((r) => r.tier !== "WEEKEND").length;
  const scarceCount = rows.filter((r) => r.bookingsOnDate > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hot dates"
        description="Upcoming premium dates over the next 120 days, hottest-first. Hold firm on scarce dates; push the open ones."
      >
        <Button variant="outline" asChild>
          <Link href="/pricing/demand">
            <ArrowLeftIcon className="mr-2 size-4" />
            Date Demand
          </Link>
        </Button>
      </PageHeader>

      {!enabled && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="py-4 text-sm text-amber-800 dark:text-amber-300">
            Date-demand pricing is currently <strong>disabled</strong>. Premiums below
            are illustrative — enable it on the Date Demand page for Sales to see them on
            quotes.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Hot dates (120d)" value={rows.length} icon />
        <StatTile label="Muhurtham / festival" value={peakCount} />
        <StatTile label="Already filling up" value={scarceCount} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <HotDatesTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-5">
        {icon && (
          <span className="grid size-10 place-items-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
            <FlameIcon className="size-5" />
          </span>
        )}
        <div>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
