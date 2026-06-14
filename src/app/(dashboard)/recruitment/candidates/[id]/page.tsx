import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getCandidateDetail } from "@/actions/recruit-candidate.actions";

import { CandidateProfile } from "./_components/candidate-profile";
import { CandidateActivity } from "./_components/candidate-activity";
import { CreateEmployeeButton } from "./_components/hire-button";

export const metadata: Metadata = { title: "Candidate" };

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  const role = session?.user?.role ?? "";
  if (!hasPermission(role, "recruit:read")) redirect("/dashboard");
  const canWrite = hasPermission(role, "recruit:write");
  const canHrWrite = hasPermission(role, "hr:write") || hasPermission(role, "hr:admin");

  const detail = await getCandidateDetail(id);
  if (!detail) notFound();

  // Recruitment → HR handoff is offered once the candidate is hired:
  // stage HIRED, a HIRED application, or an accepted offer.
  const isHired =
    detail.candidate.stage === "HIRED" ||
    detail.applications.some((a) => a.stage === "HIRED") ||
    detail.offers.some((o) => o.status === "ACCEPTED");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <PageHeader
          title={detail.candidate.name || "Candidate"}
          eyebrow="Recruitment · Candidate"
        />
        <div className="flex items-center gap-2">
          {isHired && canHrWrite && (
            <CreateEmployeeButton candidateId={detail.candidate.id} />
          )}
          <Button asChild variant="ghost" size="sm">
            <Link href="/recruitment/candidates">
              <ArrowLeft className="size-4" /> Candidates
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <CandidateProfile candidate={detail.candidate} canWrite={canWrite} />
        <CandidateActivity
          candidateId={detail.candidate.id}
          applications={detail.applications}
          interviews={detail.interviews}
          offers={detail.offers}
          jobOptions={detail.jobOptions}
          canWrite={canWrite}
        />
      </div>
    </div>
  );
}
