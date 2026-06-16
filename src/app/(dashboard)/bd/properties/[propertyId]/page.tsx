import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { getAcqProperty } from "@/actions/acq-property.actions";
import { getPropertyManagerCandidates } from "@/actions/acq-lead.actions";
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

  const [propertyResult, bdUsers, session] = await Promise.all([
    getAcqProperty(propertyId),
    getPropertyManagerCandidates(),
    auth(),
  ]);

  if (!propertyResult.success || !propertyResult.data) {
    notFound();
  }

  const property = propertyResult.data as AcqPropertyDetail;
  const managers = bdUsers as Manager[];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={property.propertyName} />
      <PropertyDetail
        property={property}
        managers={managers}
        userRole={session?.user?.role}
      />
    </div>
  );
}
