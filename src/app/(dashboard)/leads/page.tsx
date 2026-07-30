import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, UploadCloud as UploadCloudIcon, Sparkles as SparklesIcon, UserPlus as UserPlusIcon, FilterX as FilterXIcon } from "lucide-react";

import { getLeads, getLeadStats, getTestLeadsCount, type LeadListFilters } from "@/actions/lead.actions";
import { getVenues } from "@/actions/booking.actions";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { CleanupTestLeadsButton } from "./_components/cleanup-test-leads-button";
import { PageHeader } from "@/components/layout/page-header";
import { HelpHint } from "@/components/layout/help-hint";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadsViews } from "./_components/leads-views";
import { LeadsFilterBar } from "./_components/leads-filter-bar";

export const metadata: Metadata = { title: "Leads" };
// Filters live in the URL, so this page always renders per-request.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// ============================================================
// Leads List Page
// ============================================================

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // Filter/scope input straight from the URL. Every value is re-validated
  // server-side in getLeads — including `scope`, which is downgraded to "mine"
  // unless the viewer actually holds the manager permission.
  const filters: LeadListFilters = {
    scope: first(sp.scope) === "all" ? "all" : "mine",
    status: first(sp.status),
    venueId: first(sp.venue),
    eventFrom: first(sp.eventFrom),
    eventTo: first(sp.eventTo),
    createdFrom: first(sp.createdFrom),
    createdTo: first(sp.createdTo),
  };

  // Ceiling lets the client-side table page through records without the
  // default-50 cutoff, while keeping the payload far lighter than 1000.
  const [result, statsResult, testCountResult, venuesResult, session] = await Promise.all([
    getLeads({ ...filters, limit: 500 }),
    getLeadStats(filters),
    getTestLeadsCount(),
    getVenues({ activeOnly: true }),
    auth(),
  ]);
  const venues = venuesResult.success
    ? venuesResult.data.map((v) => ({ id: v.id, name: v.name }))
    : [];
  const leads = result.success ? result.data.data : [];
  const canDeleteLeads = hasPermission(session?.user?.role ?? "", "leads:delete");
  const testLeadCount = testCountResult.success ? testCountResult.count : 0;

  // Scope/permission are whatever the SERVER resolved, not what the URL asked for.
  const canViewAll = result.success ? result.data.canViewAll : false;
  const scope = result.success ? result.data.scope : "mine";
  const statusFilter = first(sp.status);
  const filtersActive = Boolean(
    statusFilter ||
      filters.venueId ||
      filters.eventFrom ||
      filters.eventTo ||
      filters.createdFrom ||
      filters.createdTo
  );

  // KPIs come from a dedicated DB aggregate, NOT the paginated rows above —
  // otherwise both counts would silently undercount past the 500-row ceiling.
  // The aggregate takes the SAME scope + filters as the list, so the header can
  // never claim a total the rows below don't cover. total = active leads in
  // scope; pipelineValue = Σ estimatedValue over open statuses (excludes
  // Won/Lost), matching the Pipeline value definition (S-1).
  const totalLeads = statsResult.success ? statsResult.data.total : leads.length;
  const pipelineValue = statsResult.success ? statsResult.data.pipelineValue : 0;

  const fmtCurrency = (n: number) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)} K`;
    return `₹${n.toLocaleString("en-IN")}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        icon={UserPlusIcon}
        accent="blue"
        title="Leads"
        help={
          <HelpHint title="What is a Lead?">
            <p>
              A <strong>Lead</strong> is a specific <em>enquiry</em> — one event
              someone is asking about (e.g. &ldquo;Dec wedding, 300 guests&rdquo;).
              It carries the event date, guest count, budget, a score, and a
              status from New → Won/Lost.
            </p>
            <p>
              Every Lead is attached to a <strong>Contact</strong> (the person).
              One contact can have many leads over time. When a Lead gets
              serious, you convert it into a <strong>Deal</strong> in the
              pipeline.
            </p>
            <p className="text-foreground/70">
              Rule of thumb: <em>the person</em> → Contact; <em>what they want
              right now</em> → Lead.
            </p>
          </HelpHint>
        }
        eyebrow={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>CRM · Pipeline</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold numeric">{totalLeads}</span>{" "}
              {scope === "all" ? "total" : "assigned to you"}
            </span>
            {pipelineValue > 0 && (
              <>
                <span className="h-3 w-px bg-border" />
                <span className="text-foreground/80">
                  <span className="font-semibold numeric">{fmtCurrency(pipelineValue)}</span> pipeline value
                </span>
              </>
            )}
          </div>
        }
        description="Track and qualify every inbound opportunity — from first contact to close."
      >
        {canDeleteLeads && <CleanupTestLeadsButton count={testLeadCount} />}
        <Button variant="outline" asChild>
          <Link href="/leads/import">
            <UploadCloudIcon className="size-3.5" strokeWidth={2.5} />
            Import
          </Link>
        </Button>
        <Button asChild>
          <Link href="/leads/new">
            <PlusIcon className="size-3.5" strokeWidth={2.5} />
            New lead
          </Link>
        </Button>
      </PageHeader>
      {/* The filter bar renders even on an empty result — otherwise a filter that
          matches nothing would hide the only control that can clear it. */}
      <div className="animate-rise-in animate-stagger-1 space-y-4">
        <LeadsFilterBar canViewAll={canViewAll} scope={scope} venues={venues} />

        {leads.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card shadow-card">
            {filtersActive ? (
              <EmptyState
                icon={<FilterXIcon className="size-6" />}
                title="No leads match these filters"
                description={
                  scope === "mine" && canViewAll
                    ? "Nothing in your own book matches this period or status. Widen the dates, clear the filters — or switch to All leads."
                    : scope === "mine"
                      ? "Nothing assigned to you matches this period or status. Try widening the dates or clearing the filters."
                      : "No leads match this period or status. Try widening the dates or clearing the filters."
                }
              />
            ) : scope === "mine" ? (
              <EmptyState
                icon={<SparklesIcon className="size-6" />}
                title="No leads assigned to you"
                description="Leads land here once they're assigned to you. Create one yourself, or ask your manager to route enquiries your way."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button asChild>
                      <Link href="/leads/new">
                        <PlusIcon className="size-3.5" strokeWidth={2.5} />
                        New lead
                      </Link>
                    </Button>
                    {canViewAll && (
                      <Button variant="outline" asChild>
                        <Link href="/leads?scope=all">View all leads</Link>
                      </Button>
                    )}
                  </div>
                }
              />
            ) : (
              <EmptyState
                icon={<SparklesIcon className="size-6" />}
                title="No enquiries yet"
                description="Every event opportunity starts here. Add your first lead — or import a list — to begin tracking and qualifying enquiries from first contact to close."
                action={
                  <Button asChild>
                    <Link href="/leads/new">
                      <PlusIcon className="size-3.5" strokeWidth={2.5} />
                      New lead
                    </Link>
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          // KPI strip is rendered inside LeadsTable (co-located with its status
          // tabs + facets) so it must NOT be duplicated here. LeadsViews wraps
          // the List (table) + Board (kanban) switcher.
          // `statusFiltered` hides the table's client-side status tabs when the
          // SERVER already narrowed to one status — otherwise every other tab
          // would read 0 and click through to an empty list.
          <LeadsViews data={leads} statusFiltered={Boolean(statusFilter)} />
        )}
      </div>
    </div>
  );
}
