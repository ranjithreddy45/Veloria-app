import { notFound } from "next/navigation";
import { getAcqDeal } from "@/actions/acq-deal.actions";
import { PageHeader } from "@/components/layout/page-header";
import { DealDetail, type AcqDealDetail } from "./_components/deal-detail";

export default async function BdDealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  const result = await getAcqDeal(dealId);
  if (!result.success) notFound();

  const deal = result.data as AcqDealDetail;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={deal.name} description={`${deal.propertyName} · ${deal.locality}`} />
      <DealDetail deal={deal} />
    </div>
  );
}
