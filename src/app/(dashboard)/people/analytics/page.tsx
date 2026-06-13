import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getHrAnalytics } from "@/actions/hr-analytics.actions";
import { AnalyticsDashboard } from "./_components/analytics-dashboard";

export const metadata: Metadata = { title: "HR Analytics" };

interface PageProps { searchParams: Promise<{ entity?: string; vertical?: string }> }

export default async function HrAnalyticsPage({ searchParams }: PageProps) {
  if (!FEATURES.hr || !FEATURES.hrAnalytics) notFound();
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "hr:read") && !hasPermission(role, "analytics:read")) redirect("/people");

  const sp = await searchParams;
  const data = await getHrAnalytics({ legalEntityId: sp.entity, businessVerticalId: sp.vertical });
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <PageHeader
        title="HR Analytics"
        description="The C-suite view — headcount, attrition, attendance, leave and appraisal completion across every legal entity and vertical."
      />
      <AnalyticsDashboard data={data as never} />
    </div>
  );
}
