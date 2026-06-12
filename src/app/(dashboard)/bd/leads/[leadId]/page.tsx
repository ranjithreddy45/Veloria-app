import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/../auth";
import { getAcqLead, getBdUsers } from "@/actions/acq-lead.actions";
import { LeadDetail, type AcqLeadFull, type BdUser } from "./_components/lead-detail";

export const metadata: Metadata = { title: "Lead" };

export default async function BdLeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const [res, bdUsers, session] = await Promise.all([
    getAcqLead(leadId),
    getBdUsers(),
    auth(),
  ]);

  if (!res.success) notFound();
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  return (
    <LeadDetail
      lead={res.data as AcqLeadFull}
      bdUsers={bdUsers as BdUser[]}
      userRole={userRole}
    />
  );
}
