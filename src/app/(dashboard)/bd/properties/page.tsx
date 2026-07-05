import type { Metadata } from "next";
import {
  Building2,
  Hammer,
  CheckCircle2,
  CalendarCheck,
  PauseCircle,
  XCircle,
} from "lucide-react";
import { getAcqProperties } from "@/actions/acq-property.actions";
import { getBdUsers } from "@/actions/acq-lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { StatTile } from "@/components/ui/stat-tile";
import { PropertyList, type PropertyListItem } from "./_components/property-list";

export const metadata: Metadata = { title: "Properties" };

export default async function BdPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [propertiesResult] = await Promise.all([getAcqProperties(), getBdUsers()]);
  const { status } = await searchParams;

  const all = (
    propertiesResult.success ? propertiesResult.data : []
  ) as PropertyListItem[];

  // Status counts always reflect the full portfolio, even when a ?status=
  // deep-link narrows the list below.
  const count = (s: string) => all.filter((p) => p.status === s).length;

  // Honour a ?status= deep-link from the dashboard drill-downs (FEAT-005).
  const properties = status ? all.filter((p) => p.status === status) : all;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        aura
        eyebrow="Business Development · Acquisition"
        title="Properties"
        help={<PageHelp id="bd-properties" />}
        description="Acquired venues. Sales sees inventory only when AVAILABLE."
      />

      {/* Status counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total" value={all.length} accent="indigo" icon={<Building2 className="size-4" />} />
        <StatTile label="Onboarding" value={count("ONBOARDING")} accent="amber" icon={<Hammer className="size-4" />} />
        <StatTile label="Available" value={count("AVAILABLE")} accent="emerald" icon={<CheckCircle2 className="size-4" />} />
        <StatTile label="Active" value={count("ACTIVE")} accent="blue" icon={<CalendarCheck className="size-4" />} />
        <StatTile label="Paused" value={count("PAUSED")} accent="violet" icon={<PauseCircle className="size-4" />} />
        <StatTile label="Off-boarded" value={count("OFF_BOARDED")} accent="rose" icon={<XCircle className="size-4" />} />
      </div>

      <PropertyList properties={properties} />
    </div>
  );
}
