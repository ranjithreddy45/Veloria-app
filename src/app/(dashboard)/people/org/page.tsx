import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getOrgTree, getHrLookups } from "@/actions/hr-employee.actions";
import { OrgTree } from "./_components/org-tree";

export const metadata: Metadata = { title: "Org Chart" };

interface PageProps {
  searchParams: Promise<{ entity?: string; vertical?: string }>;
}

export default async function OrgChartPage({ searchParams }: PageProps) {
  if (!FEATURES.hr) notFound();
  const sp = await searchParams;

  const [nodes, lookups] = await Promise.all([
    getOrgTree({ legalEntityId: sp.entity, businessVerticalId: sp.vertical }),
    getHrLookups(),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Org Chart"
        description="The whole group in one tree — across every legal entity and vertical. This reporting line is the single source of truth for approval routing everywhere in the platform."
      />
      <OrgTree nodes={nodes} entities={lookups.entities} verticals={lookups.verticals} />
    </div>
  );
}
