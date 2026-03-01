import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, ArrowLeftIcon } from "lucide-react";

import { getRatePlans } from "@/actions/pricing.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { RatePlansTable } from "../_components/rate-plans-table";

export const metadata: Metadata = { title: "Rate Plans" };

// ============================================================
// Rate Plans List Page
// ============================================================

export default async function RatePlansPage() {
  const result = await getRatePlans();

  const plans = result.success ? result.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate Plans"
        description="Manage base rates and per-guest pricing for your venues."
      >
        <Button variant="outline" asChild>
          <Link href="/pricing">
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to Pricing
          </Link>
        </Button>
        <Button asChild>
          <Link href="/pricing/rate-plans/new">
            <PlusIcon className="mr-2 size-4" />
            New Rate Plan
          </Link>
        </Button>
      </PageHeader>
      <RatePlansTable data={plans} />
    </div>
  );
}
