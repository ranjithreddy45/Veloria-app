import type { Metadata } from "next";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getApplications, getRecruitFormOptions } from "@/actions/recruit.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Applications } from "./_components/applications";

export const metadata: Metadata = { title: "Applications" };

export default async function ApplicationsPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !hasPermission(role, "recruit:read")) redirect("/dashboard");

  const canWrite = hasPermission(role, "recruit:write");
  const [apps, options] = await Promise.all([getApplications(), getRecruitFormOptions()]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Applications"
        eyebrow={`Hiring · ${apps.length} application${apps.length === 1 ? "" : "s"}`}
        description="Every candidate moving through the hiring pipeline — from screening to hire. Advance a stage inline or open a new application."
      />
      <Applications apps={apps} options={options} canWrite={canWrite} />
    </div>
  );
}
