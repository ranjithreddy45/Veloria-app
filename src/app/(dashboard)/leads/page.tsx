import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, UploadCloud as UploadCloudIcon, Sparkles as SparklesIcon, UserPlus as UserPlusIcon, FilterX as FilterXIcon } from "lucide-react";

import { getLeads, getLeadStats, getTestLeadsCount, getUnassignedLeadsCount, type LeadListFilters } from "@/actions/lead.actions";
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
  const rawScope = first(sp.scope);
  const filters: LeadListFilters = {
    scope: rawScope === "all" ? "all" : rawScope === "unassigned" ? "unassigned" : "mine",
    status: first(sp.status),
    venueId: first(sp.venue),
    eventFrom: first(sp.eventFrom),
    eventTo: first(sp.eventTo),
    createdFrom: first(sp.createdFrom),
    createdTo: first(sp.createdTo),
    // Marketing channel. Pair it with createdFrom/createdTo to reconcile a
    // month against what an ad platform reports (e.g. Google Ads' August count).
    enquirySource: first(sp.channel),
  };

  // Ceiling lets the client-side table page through records without the
  // default-50 cutoff, while keeping the payload far lighter than 1000.
  const [result, statsResult, orgStatsResult, testCountResult, unassignedResult, venuesResult, session] =
    await Promise.all([
      getLeads({ ...filters, limit: 500 }),
      getLeadStats(filters),
      // Unscoped count, so an empty "My leads" can tell the truth about whether
      // the PIPELINE is empty or merely this person's slice of it. getLeadStats
      // is scoped to the same filters, so on its own it always reports 0 here —
      // which is exactly how the page ended up claiming there were no leads
      // while 41 sat in the database.
      getLeadStats({ scope: "all" }),
      getTestLeadsCount(),
      getUnassignedLeadsCount(),
      getVenues({ activeOnly: true }),
      auth(),
    ]);
  const unassignedCount = unassignedResult.success ? unassignedResult.count : 0;
  const orgLeadTotal = orgStatsResult.success ? orgStatsResult.data.total : 0;
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
  const scopeIsMine = filters.scope === "mine";
  const filtersActive = Boolean(
    statusFilter ||
      filters.venueId ||
      filters.eventFrom ||
      filters.eventTo ||
      filters.createdFrom ||
      filters.createdTo ||
      filters.enquirySource
  );

  // KPIs come from a dedicated DB aggregate, NOT the paginated rows above —
  // otherwise both counts would silently undercount past the 500-row ceiling.
  // The aggregate takes the SAME scope + filters as the list, so the header can
  // never claim a total the rows below don't cover. total = active leads in
  // scope; pipelineValue = Σ estimatedValue over open statuses (excludes
  // Won/Lost), matching the Pipeline value definition (S-1).
  // WOULD THESE FILTERS MATCH ANYTHING OUTSIDE MY OWN BOOK?
  //
  // The list defaults to "My leads". Set a date range while nothing is
  // assigned to you and you get an empty table — which reads as "the date
  // filter is broken", not "these leads belong to someone else". The filter
  // was working the whole time; the scope was hiding the answer.
  //
  // Only asked when it can change what we say: manager, own scope, no rows,
  // and a filter actually applied.
  const shouldOfferWiderScope =
    scopeIsMine && canViewAll && leads.length === 0 && filtersActive;
  const matchesInAllScope = shouldOfferWiderScope
    ? await getLeadStats({ ...filters, scope: "all" }).then((r) => (r.success ? r.data.total : 0))
    : 0;

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
              {scope === "all"
                ? "total"
                : scope === "unassigned"
                  ? "awaiting an owner"
                  : "assigned to you"}
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
        <LeadsFilterBar canViewAll={canViewAll} scope={scope} venues={venues} unassignedCount={unassignedCount} />

        {leads.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card shadow-card">
            {filtersActive ? (
              <EmptyState
                icon={<FilterXIcon className="size-6" />}
                title={
                  matchesInAllScope > 0
                    ? `${matchesInAllScope} lead${matchesInAllScope === 1 ? "" : "s"} match — just not yours`
                    : "No leads match these filters"
                }
                description={
                  matchesInAllScope > 0
                    ? `Your filters are working. ${matchesInAllScope === 1 ? "That lead is" : "Those leads are"} assigned to someone else, and this list is showing only your own book.`
                    : scope === "mine" && canViewAll
                      ? "Nothing in your own book matches this period or status. Widen the dates, clear the filters — or switch to All leads."
                      : scope === "mine"
                        ? "Nothing assigned to you matches this period or status. Try widening the dates or clearing the filters."
                        : "No leads match this period or status. Try widening the dates or clearing the filters."
                }
                action={
                  matchesInAllScope > 0 ? (
                    // KEEPS the filters and only widens the scope — the whole
                    // point is to show the rows they already asked for.
                    <Button asChild>
                      <Link
                        href={`/leads?${new URLSearchParams({
                          ...Object.fromEntries(
                            Object.entries({
                              status: filters.status,
                              venue: filters.venueId,
                              eventFrom: filters.eventFrom,
                              eventTo: filters.eventTo,
                              createdFrom: filters.createdFrom,
                              createdTo: filters.createdTo,
                            }).filter(([, v]) => !!v) as [string, string][]
                          ),
                          scope: "all",
                        }).toString()}`}
                      >
                        Show all {matchesInAllScope} with these filters
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : scope === "mine" ? (
              // An empty state must describe the SYSTEM, not just this query.
              // "No leads assigned to you" next to a pipeline holding 41 leads
              // reads as "the app is broken" — and the primary action was
              // "New lead", pushing you to create a 42nd rather than look at
              // the 41 that already exist. When there ARE leads elsewhere, say
              // the number and make viewing them the primary action.
              <EmptyState
                icon={<SparklesIcon className="size-6" />}
                title={
                  canViewAll && orgLeadTotal > 0
                    ? "None of these are yours yet"
                    : "No leads assigned to you"
                }
                description={
                  canViewAll && orgLeadTotal > 0
                    ? `Nothing is assigned to you right now, but there ${orgLeadTotal === 1 ? "is" : "are"} ${orgLeadTotal} lead${orgLeadTotal === 1 ? "" : "s"} in the pipeline${unassignedCount > 0 ? `, ${unassignedCount} of them unassigned` : ""}.`
                    : "Leads land here once they're assigned to you. Create one yourself, or ask your manager to route enquiries your way."
                }
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {canViewAll && orgLeadTotal > 0 ? (
                      <>
                        <Button asChild>
                          <Link href="/leads?scope=all">
                            View all {orgLeadTotal} leads
                          </Link>
                        </Button>
                        {unassignedCount > 0 && (
                          <Button variant="outline" asChild>
                            <Link href="/leads?scope=unassigned">
                              Route {unassignedCount} unassigned
                            </Link>
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                }
              />
            ) : scope === "unassigned" ? (
              <EmptyState
                icon={<SparklesIcon className="size-6" />}
                title="Inbox zero — every lead has an owner"
                description="No leads are waiting to be routed. New enquiries are auto-assigned on arrival; anything that ever lands without an owner will show up here."
                action={
                  <Button variant="outline" asChild>
                    <Link href="/leads">Back to My leads</Link>
                  </Button>
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
          <>
            {/*
              A cap that does not announce itself reads as "this is all of it".
              That is precisely how 141 leads came to be reported in the header
              while the board showed 100 — and, because the default sort is
              score-descending, the 41 it hid were the lowest-scoring ones:
              new, unworked enquiries. The ceiling now sits above what this page
              requests, so this should never fire; it is here so that if it ever
              does, the screen says so instead of quietly lying.
            */}
            {leads.length < totalLeads && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground/80">
                Showing{" "}
                <span className="font-semibold numeric">{leads.length}</span> of{" "}
                <span className="font-semibold numeric">{totalLeads}</span> leads.
                Narrow the filters to see the rest — the hidden ones are the
                lowest-scoring, which usually means newest and unworked.
              </div>
            )}
            <LeadsViews data={leads} statusFiltered={Boolean(statusFilter)} />
          </>
        )}
      </div>
    </div>
  );
}
