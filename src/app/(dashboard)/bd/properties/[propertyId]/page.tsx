import { notFound } from "next/navigation";
import { getAcqProperty } from "@/actions/acq-property.actions";
import { getBdUsers } from "@/actions/acq-lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import {
  PropertyDetail,
  type AcqPropertyDetail,
  type Manager,
} from "./_components/property-detail";

interface PageProps {
  params: Promise<{ propertyId: string }>;
}

export default async function BdPropertyDetailPage({ params }: PageProps) {
  const { propertyId } = await params;

  const [propertyResult, bdUsers] = await Promise.all([
    getAcqProperty(propertyId),
    getBdUsers(),
  ]);

  if (!propertyResult.success || !propertyResult.data) {
    notFound();
  }

  const property = propertyResult.data as AcqPropertyDetail;
  const managers = bdUsers as Manager[];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={property.propertyName} />
      <PropertyDetail property={property} managers={managers} />
    </div>
  );
}
