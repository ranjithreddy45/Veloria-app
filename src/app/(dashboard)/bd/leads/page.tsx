import type { Metadata } from "next";
import { auth } from "@/../auth";
import {
  getAcqLeads,
  getAcqLeadStatusCounts,
  getBdPipelineCounts,
  getBdUsers,
} from "@/actions/acq-lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { ACQ_LEAD_STATUS, ACQ_PROPERTY_TYPE } from "@/lib/acq/constants";
import { BD_PIPELINE_KEYS } from "@/lib/bd/pipeline";
import { LeadInbox, type AcqLead, type BdUser } from "./_components/lead-inbox";
import { BdWorkStrip } from "./_components/bd-work-strip";

export const metadata: Metadata = { title: "Leads" };

export default async function BdLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    view?: string;
    due?: string;
    stage?: string;
    stMin?: string;
    stMax?: string;
    sfMin?: string;
    sfMax?: string;
    ptype?: string;
    parking?: string;
    exec?: string;
  }>;
}) {
  const sp = await searchParams;
  // Validate the URL value against the allowed set before it reaches Prisma —
  // an unknown enum string would throw. Unknown → treat as "no filter" so a
  // stale bookmark still renders the list instead of erroring (item 12).
  const status =
    sp.status && (ACQ_LEAD_STATUS as readonly string[]).includes(sp.status) ? sp.status : undefined;

  // The old /bd/followups page, folded in as a view. Its URL still works and
  // redirects here, so links and bookmarks survive the consolidation.
  const dueFollowup = sp.view === "followup";
  // ?due=overdue narrows the follow-up view to what's already late — the
  // work-strip's "overdue" tile deep-links here.
  const due = dueFollowup && sp.due === "overdue" ? ("overdue" as const) : undefined;

  // Unified pipeline stage + property particulars — same unknown-→-undefined
  // treatment as status, and numbers parsed defensively (NaN → no bound).
  const pipelineStage =
    sp.stage && (BD_PIPELINE_KEYS as readonly string[]).includes(sp.stage) ? sp.stage : undefined;
  const num = (v: string | undefined) => {
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
  };
  const particulars = {
    seatingTheatreMin: num(sp.stMin),
    seatingTheatreMax: num(sp.stMax),
    seatingFloatingMin: num(sp.sfMin),
    seatingFloatingMax: num(sp.sfMax),
    propertyType:
      sp.ptype && (ACQ_PROPERTY_TYPE as readonly string[]).includes(sp.ptype)
        ? sp.ptype
        : undefined,
    parkingAvailable: sp.parking === "1" ? true : undefined,
  };
  // Lead-owner filter: a plain id equality on the server — an unknown id just
  // matches nothing, so no validation round-trip is needed before the query.
  const bdExecutiveId = sp.exec?.trim() || undefined;

  const [leadsResult, countsResult, pipelineCountsResult, bdUsers, session] = await Promise.all([
    getAcqLeads({ status, dueFollowup, due, pipelineStage, bdExecutiveId, ...particulars }),
    getAcqLeadStatusCounts(),
    getBdPipelineCounts(),
    getBdUsers(),
    auth(),
  ]);

  const leads = (leadsResult.success ? leadsResult.data : []) as AcqLead[];
  // The list is capped. When rows were left behind, say so instead of
  // presenting a subset as the whole inbox.
  const leadsTruncated = leadsResult.success && leadsResult.truncated === true;
  const leadsTotal = leadsResult.success && typeof leadsResult.total === "number" ? leadsResult.total : leads.length;
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
        description={
          leadsTruncated
            ? `Showing the ${leads.length} newest of ${leadsTotal} leads. Narrow the filters to see the rest.`
            : "Owner enquiries — SLA-tracked and de-duplicated. Tap a lead to view, call, message and qualify."
        }
      />
      <BdWorkStrip />
      <LeadInbox
        leads={leads}
        bdUsers={bdUsers as BdUser[]}
        userRole={userRole}
        activeStatus={status}
        dueFollowup={dueFollowup}
        statusCounts={statusCounts}
        pipelineCounts={pipelineCountsResult.success ? pipelineCountsResult.data : {}}
        activeStage={pipelineStage}
        activeExec={bdExecutiveId}
        particulars={particulars}
      />
    </div>
  );
}
