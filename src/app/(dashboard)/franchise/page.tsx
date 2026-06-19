import type { Metadata } from "next";
import Link from "next/link";
import { Building2, PlusIcon, Network, IndianRupee, Clock } from "lucide-react";

import { getFranchisePartners } from "@/actions/franchise.actions";
import { getRevenueSharePayouts } from "@/actions/franchise-revshare.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { formatINR } from "@/lib/utils";
import { computeVenuePnl, currentPeriod } from "@/lib/franchise/pnl";
import { prisma } from "@/lib/prisma";
import { PartnerList } from "./_components/partner-list";

export const metadata: Metadata = { title: "Franchise" };

// ============================================================
// Franchise home — partner list + franchise-wide P&L summary
// Gated by franchise:read (middleware + ROUTE_PERMISSIONS).
// ============================================================

export default async function FranchisePage() {
  const partnersResult = await getFranchisePartners();
  const partners = partnersResult.success ? partnersResult.data : [];

  // Franchise-wide MTD gross across all attached venues (cash-basis).
  const period = currentPeriod();
  let mtdGross = 0;
  let venueCount = 0;
  let pendingPayouts = 0;

  if (partnersResult.success) {
    const [franchiseVenues, pendingResult] = await Promise.all([
      prisma.franchiseVenue.findMany({ select: { venueId: true } }),
      getRevenueSharePayouts({ status: "PENDING" }),
    ]);
    venueCount = franchiseVenues.length;
    pendingPayouts = pendingResult.success ? pendingResult.data.length : 0;

    const uniqueVenueIds = Array.from(
      new Set(franchiseVenues.map((v) => v.venueId))
    );
    const pnls = await Promise.all(
      uniqueVenueIds.map((vid) =>
        computeVenuePnl(vid, period).catch(() => null)
      )
    );
    mtdGross = pnls.reduce((sum, p) => sum + (p?.grossRevenue ?? 0), 0);
  }

  const activePartners = partners.filter(
    (p: { status: string }) => p.status === "ACTIVE"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Franchise"
        description="Onboard partners, run per-venue P&L, and accrue revenue-share payouts."
      >
        <Button asChild>
          <Link href="/franchise/new">
            <PlusIcon className="mr-2 size-4" />
            New Partner
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Active partners"
          value={activePartners}
          accent="indigo"
          icon={<Network />}
          sub={`${partners.length} total`}
        />
        <StatTile
          label="Venues under franchise"
          value={venueCount}
          accent="violet"
          icon={<Building2 />}
        />
        <StatTile
          label="MTD gross (franchise)"
          value={formatINR(mtdGross)}
          accent="emerald"
          icon={<IndianRupee />}
          sub={period}
        />
        <StatTile
          label="Pending payouts"
          value={pendingPayouts}
          accent="amber"
          icon={<Clock />}
          sub="awaiting approval"
        />
      </div>

      <PartnerList data={partners} />
    </div>
  );
}
