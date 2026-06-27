import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, FlameIcon } from "lucide-react";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getDemandConfig } from "@/actions/date-demand.actions";
import { listPeakDates } from "@/actions/peak-dates.actions";
import { DEFAULT_DEMAND_CONFIG } from "@/lib/pricing/date-demand";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DemandConfigForm } from "./_components/demand-config-form";
import { PeakDatesManager } from "./_components/peak-dates-manager";

export const metadata: Metadata = { title: "Date Demand Pricing" };

// ============================================================
// Date-Demand Pricing admin — Muhurtham / festival / weekend premiums.
// ------------------------------------------------------------
// Gated by the /pricing route prefix (pricing:read). Two sections:
//   (a) the singleton demand CONFIG (enabled + 6 premium/scarcity numbers), and
//   (b) the PEAK-DATE CALENDAR (add / edit / delete + bulk paste).
// Plus a link out to the "Hot dates" report.
// ============================================================

export default async function DateDemandPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!hasPermission(role, "pricing:read")) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        You don&apos;t have access to pricing.
      </div>
    );
  }
  const canManage = hasPermission(role, "pricing:manage");

  const [config, peakRes, venues] = await Promise.all([
    getDemandConfig(),
    listPeakDates(),
    prisma.venue.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const peakDates = peakRes.success ? peakRes.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Date Demand Pricing"
        description="Muhurtham, festival and weekend premiums. Set the demand knobs and curate the peak-date calendar so Sales holds firm on scarce dates."
      >
        <Button variant="outline" asChild>
          <Link href="/pricing">
            <ArrowLeftIcon className="mr-2 size-4" />
            Pricing
          </Link>
        </Button>
        <Button asChild>
          <Link href="/pricing/demand/hot-dates">
            <FlameIcon className="mr-2 size-4" />
            Hot dates report
          </Link>
        </Button>
      </PageHeader>

      <DemandConfigForm
        config={config}
        defaults={DEFAULT_DEMAND_CONFIG}
        canManage={canManage}
      />

      <PeakDatesManager
        initialPeakDates={peakDates}
        venues={venues}
        canManage={canManage}
      />
    </div>
  );
}
