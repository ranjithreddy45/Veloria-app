import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { getPricingRules } from "@/actions/pricing.actions";
import { getVenueDemandSignals } from "@/actions/yield-pricing.actions";
import { getVenues } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YieldRulesTable } from "./_components/yield-rules-table";
import { DemandSignalsTable } from "./_components/demand-signals-table";
import { PriceSimulator } from "./_components/price-simulator";

export const metadata: Metadata = { title: "Yield Pricing" };

// ============================================================
// Yield / Dynamic Pricing config page
// ------------------------------------------------------------
// Internal, gated by the /pricing route prefix (pricing:read). Lists yield
// rules (OCCUPANCY/DEMAND/LEAD_TIME), the per-venue/date/slot demand signals,
// and a live Price Simulator that previews the full applied-rule breakdown.
// ============================================================

export default async function YieldPricingPage() {
  const [occupancyRes, demandRes, leadTimeRes, signalsRes, venuesRes] =
    await Promise.all([
      getPricingRules({ ruleType: "OCCUPANCY", limit: 100 }),
      getPricingRules({ ruleType: "DEMAND", limit: 100 }),
      getPricingRules({ ruleType: "LEAD_TIME", limit: 100 }),
      getVenueDemandSignals({ limit: 100 }),
      getVenues(),
    ]);

  const rules = [
    ...(occupancyRes.success ? occupancyRes.data.data : []),
    ...(demandRes.success ? demandRes.data.data : []),
    ...(leadTimeRes.success ? leadTimeRes.data.data : []),
  ].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  const signals = signalsRes.success ? signalsRes.data.data : [];

  const venues = venuesRes.success
    ? venuesRes.data
        .filter((v) => v.isActive)
        .map((v) => ({ id: v.id, name: v.name }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Yield Pricing"
        help={<PageHelp id="pricing" />}
        description="Dynamic occupancy-, demand-, and lead-time-based pricing on top of your base rules."
      >
        <Button variant="outline" asChild>
          <Link href="/pricing">
            <ArrowLeftIcon className="mr-2 size-4" />
            Pricing
          </Link>
        </Button>
        <Button asChild>
          <Link href="/pricing/yield/new">New Yield Rule</Link>
        </Button>
      </PageHeader>

      <PriceSimulator venues={venues} />

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Yield Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="signals">
            Demand Signals ({signals.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          <YieldRulesTable data={rules} />
        </TabsContent>

        <TabsContent value="signals" className="mt-4">
          <DemandSignalsTable data={signals} venues={venues} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
