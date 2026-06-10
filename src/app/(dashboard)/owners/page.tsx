import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, Building2 } from "lucide-react";
import { getHallOwners } from "@/actions/hall-owner.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DotAvatar } from "@/components/shared/dot-avatar";

export const metadata: Metadata = { title: "Hall Owners" };

// Funnel stages (spec §13) with display metadata.
const STAGES: { key: string; label: string; dot: string }[] = [
  { key: "PROSPECT", label: "Prospect", dot: "bg-slate-400" },
  { key: "CONTACT_MADE", label: "Contact Made", dot: "bg-blue-500" },
  { key: "SITE_INSPECTION", label: "Site Inspection", dot: "bg-violet-500" },
  { key: "NEGOTIATION", label: "Negotiation", dot: "bg-amber-500" },
  { key: "CONTRACT_DRAFTED", label: "Contract Drafted", dot: "bg-orange-500" },
  { key: "SIGNED", label: "Signed", dot: "bg-teal-500" },
  { key: "ONBOARDED", label: "Onboarded", dot: "bg-emerald-500" },
  { key: "RENEWAL", label: "Renewal", dot: "bg-cyan-500" },
  { key: "CHURNED", label: "Churned", dot: "bg-rose-500" },
];

const MODEL_LABELS: Record<string, string> = {
  REVENUE_SHARE: "Revenue Share",
  FIXED_LEASE: "Fixed Lease",
  HYBRID: "Hybrid",
  MANAGEMENT_FEE: "Management Fee",
};

function fmtCr(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default async function HallOwnersPage() {
  const result = await getHallOwners();
  const owners = result.success && result.data ? result.data : [];

  const byStage = STAGES.map((s) => ({
    ...s,
    items: owners.filter((o) => o.contractStatus === s.key),
  }));

  const pipelineValue = owners
    .filter((o) => !["CHURNED"].includes(o.contractStatus))
    .reduce((sum, o) => sum + Number(o.minimumMonthlyGuarantee ?? 0) * 12, 0);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-5">
      <PageHeader
        title="Hall Owners"
        eyebrow={
          <div className="flex items-center gap-3">
            <span>Business Development · Acquisition Funnel</span>
            <span className="h-3 w-px bg-border" />
            <span className="text-foreground/80">
              <span className="font-semibold tabular-nums">{owners.length}</span> owners
            </span>
            {pipelineValue > 0 && (
              <>
                <span className="h-3 w-px bg-border" />
                <span className="text-foreground/80">
                  <span className="font-semibold tabular-nums">{fmtCr(pipelineValue)}</span> annual lease pipeline
                </span>
              </>
            )}
          </div>
        }
        description="Acquire and onboard hall owners who partner with Veloria Grand."
      >
        <Button asChild>
          <Link href="/owners/new">
            <PlusIcon className="size-3.5" strokeWidth={2.5} />
            New owner
          </Link>
        </Button>
      </PageHeader>

      {owners.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card py-16 text-center">
          <Building2 className="size-6 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="text-[13.5px] font-medium text-foreground">No hall owners yet</p>
          <p className="max-w-md text-[12px] text-muted-foreground">
            Add prospective hall owners to start building your B2B acquisition pipeline.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto pb-3">
          <div className="flex h-full gap-3">
            {byStage.map((col) => (
              <div
                key={col.key}
                className="flex h-full w-[280px] min-w-[280px] flex-col rounded-lg border border-border bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2 rounded-t-lg border-b border-border bg-card/60 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 shrink-0 rounded-full ${col.dot}`} />
                    <h3 className="text-[12px] font-semibold uppercase tracking-[0.04em] text-foreground">
                      {col.label}
                    </h3>
                    <span className="rounded bg-background px-1 text-[10.5px] font-medium tabular-nums text-muted-foreground ring-1 ring-border">
                      {col.items.length}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {col.items.map((o) => (
                    <Link
                      key={o.id}
                      href={`/owners/${o.id}/edit`}
                      className="block rounded-md border border-border bg-card p-2.5 transition hover:border-primary/40"
                    >
                      <div className="flex items-center gap-2">
                        <DotAvatar seed={o.id} name={o.ownerName} size="xs" />
                        <span className="truncate text-[12.5px] font-medium text-foreground">
                          {o.ownerName}
                        </span>
                      </div>
                      {o.companyName && (
                        <p className="mt-1 truncate text-[11.5px] text-muted-foreground">
                          {o.companyName}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        {o.propertyCity && <span>{o.propertyCity}</span>}
                        {o.numberOfHalls != null && (
                          <span>· {o.numberOfHalls} hall{o.numberOfHalls === 1 ? "" : "s"}</span>
                        )}
                      </div>
                      {o.commercialModel && (
                        <div className="mt-1.5 text-[10.5px] font-medium text-violet-700">
                          {MODEL_LABELS[o.commercialModel] ?? o.commercialModel}
                          {o.revenueSharePercent != null
                            ? ` · ${o.revenueSharePercent}%`
                            : ""}
                        </div>
                      )}
                    </Link>
                  ))}
                  {col.items.length === 0 && (
                    <div className="rounded-md border border-dashed border-border py-6 text-center text-[11px] text-muted-foreground/60">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
