import type { Metadata } from "next";
import { getAcqDeals } from "@/actions/acq-deal.actions";
import { PageHeader } from "@/components/layout/page-header";
import { DealBoard, type AcqDealCard } from "./_components/deal-board";

export const metadata: Metadata = { title: "Deal Board" };

export default async function BdDealsPage() {
  const result = await getAcqDeals();
  const deals = (result.success ? result.data : []) as AcqDealCard[];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Deal Board"
        description="Acquisition pipeline — drag-free guarded stages."
      />
      <DealBoard deals={deals} />
    </div>
  );
}
