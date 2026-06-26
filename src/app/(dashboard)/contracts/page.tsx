import Link from "next/link";
import {
  PlusIcon,
  FileSignatureIcon,
  SendIcon,
  CheckCircle2Icon,
  PencilIcon,
} from "lucide-react";
import { getContracts } from "@/actions/contract.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { ContractsTable } from "./_components/contracts-table";

export const metadata = {
  title: "Sales Contracts",
};

export default async function ContractsPage() {
  const result = await getContracts();

  const contracts = result.success ? result.data?.data ?? [] : [];

  // ---- Headline counts derived from existing status field (presentation only) ----
  const total = contracts.length;
  const draftCount = contracts.filter((c) => c.status === "DRAFT").length;
  const sentCount = contracts.filter((c) => c.status === "SENT").length;
  const signedCount = contracts.filter((c) => c.status === "SIGNED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        aura
        eyebrow={`SALES · ${total} contract${total === 1 ? "" : "s"} · ${signedCount} signed`}
        title="Sales Contracts"
        help={<PageHelp id="contracts" />}
        description="Manage contracts, send for signatures, and track signing status."
      >
        <Button asChild className="hover-lift">
          <Link href="/contracts/new">
            <PlusIcon className="mr-2 size-4" />
            New Contract
          </Link>
        </Button>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="Total"
          value={total}
          accent="violet"
          icon={<FileSignatureIcon className="size-4" />}
          sub="All contracts"
        />
        <StatTile
          label="Drafts"
          value={draftCount}
          accent="amber"
          icon={<PencilIcon className="size-4" />}
          sub="Not yet sent"
        />
        <StatTile
          label="Sent"
          value={sentCount}
          accent="blue"
          icon={<SendIcon className="size-4" />}
          sub="Awaiting signature"
        />
        <StatTile
          label="Signed"
          value={signedCount}
          accent="emerald"
          icon={<CheckCircle2Icon className="size-4" />}
          sub="Completed"
        />
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState
            icon={<FileSignatureIcon className="size-5" />}
            title="No contracts yet"
            description="Create your first contract to send for signatures and track signing status."
            action={
              <Button asChild className="hover-lift">
                <Link href="/contracts/new">
                  <PlusIcon className="mr-2 size-4" />
                  New Contract
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ContractsTable data={contracts} />
      )}
    </div>
  );
}
