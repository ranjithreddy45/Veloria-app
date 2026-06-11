import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { getAcqDeals } from "@/actions/acq-deal.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { DealBoard, type AcqDealCard } from "./_components/deal-board";

export const metadata: Metadata = { title: "Deal Board" };

export default async function BdDealsPage() {
  const result = await getAcqDeals();
  const deals = (result.success ? result.data : []) as AcqDealCard[];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Deal Board"
        help={<PageHelp id="bd-deals" />}
        description="Acquisition pipeline — drag-free guarded stages. New deals start as a qualified lead."
      >
        <Button asChild>
          {/* A BD deal is created by qualifying a lead, so "New deal" opens the
              lead capture (the proper entry to a new property acquisition). */}
          <Link href="/bd/leads?new=1">
            <PlusIcon className="size-3.5" strokeWidth={2.5} />
            New deal
          </Link>
        </Button>
      </PageHeader>
      <DealBoard deals={deals} />
    </div>
  );
}
