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

  const detail = await getCandidateDetail(id);
  if (!detail) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <PageHeader
          title={detail.candidate.name || "Candidate"}
          eyebrow="Recruitment · Candidate"
        />
        <Button asChild variant="ghost" size="sm">
          <Link href="/recruitment/candidates">
            <ArrowLeft className="size-4" /> Candidates
          </Link>
        </Button>
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
