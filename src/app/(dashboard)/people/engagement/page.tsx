import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getActiveSurveysForMe, canCurrentUserManageEngagement } from "@/actions/engagement.actions";
import { EngagementSurface } from "./_components/engagement-surface";

export const metadata: Metadata = { title: "Engagement" };

export default async function Page() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:read")) notFound();

  const [surveysRes, canManage] = await Promise.all([
    getActiveSurveysForMe(),
    canCurrentUserManageEngagement(),
  ]);
  const surveys = surveysRes.success ? surveysRes.data : [];

  return (
    <div className="space-y-8">
      <PageHeader
        aura
        eyebrow="People · HR"
        title="Engagement"
        description="Anonymous pulse surveys — a fast read on how the team is feeling."
      />
      <EngagementSurface surveys={surveys} canManage={canManage} />
    </div>
  );
}
