import type { Metadata } from "next";
import { getAcqLeads, getBdUsers } from "@/actions/acq-lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import { LeadInbox, type AcqLead, type BdUser } from "./_components/lead-inbox";

export const metadata: Metadata = { title: "Lead Inbox" };

export default async function BdLeadsPage() {
  const [leadsResult, bdUsers] = await Promise.all([getAcqLeads(), getBdUsers()]);

  const leads = (leadsResult.success ? leadsResult.data : []) as AcqLead[];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Lead Inbox"
        description="Owner enquiries — SLA-tracked and de-duplicated."
      />
      <LeadInbox leads={leads} bdUsers={bdUsers as BdUser[]} />
    </div>
  );
}
