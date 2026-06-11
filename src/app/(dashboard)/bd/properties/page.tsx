import type { Metadata } from "next";
import { getAcqProperties } from "@/actions/acq-property.actions";
import { getBdUsers } from "@/actions/acq-lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PropertyList, type PropertyListItem } from "./_components/property-list";

export const metadata: Metadata = { title: "Properties" };

export default async function BdPropertiesPage() {
  const [propertiesResult] = await Promise.all([getAcqProperties(), getBdUsers()]);

  const properties = (
    propertiesResult.success ? propertiesResult.data : []
  ) as PropertyListItem[];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Properties"
        description="Acquired venues. Sales sees inventory only when AVAILABLE."
      />
      <PropertyList properties={properties} />
    </div>
  );
}
