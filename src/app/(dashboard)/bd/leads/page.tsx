import type { Metadata } from "next";
import { auth } from "@/../auth";
import { getAcqLeads, getAcqLeadStatusCounts, getBdUsers } from "@/actions/acq-lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { ACQ_LEAD_STATUS } from "@/lib/acq/constants";
import { LeadInbox, type AcqLead, type BdUser } from "./_components/lead-inbox";

export const metadata: Metadata = { title: "Leads" };

export default async function BdLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  // Validate the URL value against the allowed set before it reaches Prisma —
  // an unknown enum string would throw. Unknown → treat as "no filter" so a
  // stale bookmark still renders the list instead of erroring (item 12).
  const status =
    sp.status && (ACQ_LEAD_STATUS as readonly string[]).includes(sp.status) ? sp.status : undefined;

  const [leadsResult, countsResult, bdUsers, session] = await Promise.all([
    getAcqLeads({ status }),
    getAcqLeadStatusCounts(),
    getBdUsers(),
    auth(),
  ]);

  const leads = (leadsResult.success ? leadsResult.data : []) as AcqLead[];
  // Chip totals come from the server so they stay true even while the list is
  // filtered down to a single status.
  const statusCounts = countsResult.success ? countsResult.data : {};
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const total = statusCounts.ALL ?? leads.length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        aura
        eyebrow={`Acquisition · ${total} lead${total === 1 ? "" : "s"}`}
        title="Leads"
        help={<PageHelp id="bd-leads" />}
        description="Owner enquiries — SLA-tracked and de-duplicated. Tap a lead to view, call, message and qualify."
      />
      <LeadInbox
        leads={leads}
        bdUsers={bdUsers as BdUser[]}
        userRole={userRole}
        activeStatus={status}
        statusCounts={statusCounts}
      />
    </div>
  );
}
