import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { FEATURES } from "@/config/features";
import { PageHeader } from "@/components/layout/page-header";
import { getPendingChangeRequests } from "@/actions/hr-change-request.actions";
import { RequestsList, type ChangeReq } from "./_components/requests-list";

export const metadata: Metadata = { title: "Change Requests" };

export default async function ChangeRequestsPage() {
  if (!FEATURES.hr) notFound();
  const session = await auth();
  if (!hasPermission(session?.user?.role ?? "", "hr:approve")) redirect("/people");

  const requests = (await getPendingChangeRequests()) as unknown as ChangeReq[];

  return (
    <div className="space-y-5">
      <Link href="/people" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All people
      </Link>
      <PageHeader
        title="Profile change requests"
        description="Employees request changes to their own details; you approve or reject. Approved changes apply instantly and are recorded in the audit log."
      />
      <RequestsList requests={requests} />
    </div>
  );
}
