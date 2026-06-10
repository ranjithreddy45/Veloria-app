import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, ReceiptTextIcon } from "lucide-react";

import { getPricingRules, getRatePlans } from "@/actions/pricing.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingRulesTable } from "./_components/pricing-rules-table";
import { RatePlansTable } from "./_components/rate-plans-table";

export const metadata: Metadata = { title: "Pricing" };

// ============================================================
// Pricing Dashboard Page
// ============================================================

export default async function PricingPage() {
  const [rulesResult, plansResult] = await Promise.all([
    getPricingRules(),
    getRatePlans(),
  ]);

  const rules = rulesResult.success ? rulesResult.data.data : [];
  const plans = plansResult.success ? plansResult.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing Engine"
        help={<PageHelp id="pricing" />}
        description="Manage dynamic pricing rules and rate plans for your venues."
      >
        <Button variant="outline" asChild>
          <Link href="/pricing/rate-plans">
            <ReceiptTextIcon className="mr-2 size-4" />
            Rate Plans
          </Link>
        </Button>
        <Button asChild>
          <Link href="/pricing/new">
            <PlusIcon className="mr-2 size-4" />
            New Rule
          </Link>
        </Button>
      </PageHeader>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">
            Pricing Rules ({rules.length})
          </TabsTrigger>
          <TabsTrigger value="rate-plans">
            Rate Plans ({plans.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          <PricingRulesTable data={rules} />
        </TabsContent>

        <TabsContent value="rate-plans" className="mt-4">
          <RatePlansTable data={plans} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
