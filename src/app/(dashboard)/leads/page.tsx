import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { getLeads } from "@/actions/lead.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "./_components/leads-table";

export const metadata: Metadata = { title: "Leads" };

// ============================================================
// Leads List Page
// ============================================================

export default async function LeadsPage() {
  const result = await getLeads();
  const leads = result.success ? result.data.data : [];

  // Total pipeline value (only counting non-lost leads)
  const pipelineValue = leads
    .filter((l) => l.status !== "LOST")
    .reduce((sum, l) => sum + Number(l.estimatedValue ?? 0), 0);

  const fmtCurrency = (n: number) => {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)} K`;
    return `₹${n.toLocaleString("en-IN")}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads"
        eyebrow={
          <div className="flex items-center gap-3">
            <span>CRM · Pipeline</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{leads.length}</span> total
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
        <Button asChild>
          <Link href="/leads/new">
            <PlusIcon className="size-3.5" strokeWidth={2.5} />
            New lead
          </Link>
        </Button>
      </PageHeader>
      <LeadsTable data={leads} />
    </div>
  );
}
