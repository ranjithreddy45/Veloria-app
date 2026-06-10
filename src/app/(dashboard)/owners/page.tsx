import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, Building2 } from "lucide-react";
import { getHallOwners } from "@/actions/hall-owner.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { OwnersWorkspace, type OwnerItem } from "./_components/owners-workspace";

export const metadata: Metadata = { title: "BD CRM" };

function fmtCr(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default async function HallOwnersPage() {
  const result = await getHallOwners();
  const owners = (result.success && result.data ? result.data : []) as OwnerItem[];

  const pipelineValue = owners
    .filter((o) => o.contractStatus !== "CHURNED")
    .reduce((sum, o) => sum + Number(o.minimumMonthlyGuarantee ?? 0) * 12, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="BD CRM"
        help={<PageHelp id="owners" />}
        eyebrow={
          <div className="flex items-center gap-3">
            <span>Business Development · Hall Owner Acquisition</span>
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
        <OwnersWorkspace owners={owners} />
      )}
    </div>
  );
}
