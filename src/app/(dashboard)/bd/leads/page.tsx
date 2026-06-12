import type { Metadata } from "next";
import { auth } from "@/../auth";
import { getAcqLeads, getBdUsers } from "@/actions/acq-lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { LeadInbox, type AcqLead, type BdUser } from "./_components/lead-inbox";

export const metadata: Metadata = { title: "Leads" };

export default async function BdLeadsPage() {
  const [leadsResult, bdUsers, session] = await Promise.all([
    getAcqLeads(),
    getBdUsers(),
    auth(),
  ]);

  const leads = (leadsResult.success ? leadsResult.data : []) as AcqLead[];
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Leads"
        help={<PageHelp id="bd-leads" />}
        description="Owner enquiries — SLA-tracked and de-duplicated. Tap a lead to view, call, message and qualify."
      />
      <LeadInbox leads={leads} bdUsers={bdUsers as BdUser[]} userRole={userRole} />
    </div>
  );
}
