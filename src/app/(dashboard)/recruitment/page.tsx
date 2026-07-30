import type { Metadata } from "next";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { UserSearchIcon } from "lucide-react";
import { getRecruitDashboard } from "@/actions/recruit.actions";
import { PageHeader } from "@/components/layout/page-header";
import { RecruitOverview } from "./_components/recruit-overview";

export const metadata: Metadata = { title: "Recruitment" };

export default async function RecruitmentPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !hasPermission(role, "recruit:read")) redirect("/dashboard");

  const canWrite = hasPermission(role, "recruit:write");
  const data = await getRecruitDashboard();

  return (
    <div className="space-y-5">
      <PageHeader
        aura
        icon={UserSearchIcon}
        accent="gold"
        title="Recruitment"
        eyebrow="Hiring · Overview"
        description="Track every opening through the hiring pipeline — screening to hire — with time-to-fill and time-to-hire at a glance."
      />
      <RecruitOverview data={data} canWrite={canWrite} />
    </div>
  );
}
