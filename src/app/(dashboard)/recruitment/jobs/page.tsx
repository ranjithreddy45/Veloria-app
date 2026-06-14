import type { Metadata } from "next";
import { auth } from "@/../auth";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { getJobOpenings, getRecruitFormOptions } from "@/actions/recruit.actions";
import { PageHeader } from "@/components/layout/page-header";
import { JobOpenings } from "./_components/job-openings";

export const metadata: Metadata = { title: "Job Openings" };

export default async function JobOpeningsPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !hasPermission(role, "recruit:read")) redirect("/dashboard");

  const canWrite = hasPermission(role, "recruit:write");
  const [openings, options] = await Promise.all([
    getJobOpenings(),
    getRecruitFormOptions(),
  ]);

  const total = openings.length;
  const active = openings.filter((o) => o.status === "IN_PROGRESS").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Job Openings"
        eyebrow={`Hiring · ${total} openings · ${active} active`}
        description="Every role you're hiring for — owners, target dates and live application counts, filterable by status, department and city."
      />
      <JobOpenings openings={openings} options={options} canWrite={canWrite} />
    </div>
  );
}
