import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getCandidates } from "@/actions/recruit.actions";
import { Candidates } from "./_components/candidates";

export const metadata: Metadata = { title: "Candidates" };

export default async function CandidatesPage() {
  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "recruit:read")) redirect("/dashboard");
  const canWrite = hasPermission(role, "recruit:write");

  const data = await getCandidates();
  const total = data.rows.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Candidates"
        eyebrow={`Hiring · ${total} candidate${total === 1 ? "" : "s"}`}
        description="Your live talent pool — track rating, stage, and source across the hiring funnel."
      />
      <Candidates data={data} canWrite={canWrite} />
    </div>
  );
}
