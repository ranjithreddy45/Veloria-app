import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, UploadCloud as UploadCloudIcon, Sparkles as SparklesIcon } from "lucide-react";

import { getLeads, getLeadStats } from "@/actions/lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import { HelpHint } from "@/components/layout/help-hint";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadsTable } from "./_components/leads-table";
import { LeadsStatStrip } from "./_components/leads-stat-strip";

export const metadata: Metadata = { title: "Leads" };

// ============================================================
// Leads List Page
// ============================================================

export default async function LeadsPage() {
  // Ceiling lets the client-side table page through records without the
  // default-50 cutoff, while keeping the payload far lighter than 1000.
  const [result, statsResult] = await Promise.all([
    getLeads({ limit: 500 }),
    getLeadStats(),
  ]);
  const leads = result.success ? result.data.data : [];

  // KPIs come from a dedicated DB aggregate, NOT the paginated rows above —
  // otherwise both counts would silently undercount past the 500-row ceiling.
  // total = all active leads; pipelineValue = Σ estimatedValue over open
  // statuses (excludes Won/Lost), matching the Pipeline value definition (S-1).
  const totalLeads = statsResult.success ? statsResult.data.total : leads.length;
  const pipelineValue = statsResult.success ? statsResult.data.pipelineValue : 0;

  const fmtCurrency = (n: number) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)} K`;
    return `₹${n.toLocaleString("en-IN")}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        aura
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
              <span className="font-semibold tabular-nums">{totalLeads}</span> total
            </span>
            {pipelineValue > 0 && (
              <>
                <span className="h-3 w-px bg-border" />
                <span className="text-foreground/80">
                  <span className="font-semibold tabular-nums">{fmtCurrency(pipelineValue)}</span> pipeline value
                </span>
              </>
            )}
          </div>
        }
        description="Track and qualify every inbound opportunity — from first contact to close."
      >
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
      {leads.length === 0 ? (
        <div className="animate-rise-in animate-stagger-1 rounded-xl border border-dashed bg-card shadow-premium">
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
        </div>
      ) : (
        <>
          <div className="animate-rise-in animate-stagger-1">
            <LeadsStatStrip data={leads} />
          </div>
          <div className="animate-rise-in animate-stagger-2">
            <LeadsTable data={leads} />
          </div>
        </>
      )}
    </div>
  );
}
