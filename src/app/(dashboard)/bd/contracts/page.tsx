import type { Metadata } from "next";
import { auth } from "@/../auth";
import {
  getAcqContracts,
  getAcqContractStats,
  getContractableDeals,
} from "@/actions/acq-contract.actions";
import { PageHeader } from "@/components/layout/page-header";
import {
  ContractsDashboard,
  type ContractRow,
  type ContractStatsData,
  type DealOption,
} from "./_components/contracts-dashboard";

export const metadata: Metadata = { title: "Acquisition Contracts" };

export default async function BdContractsPage() {
  const [listRes, statsRes, deals, session] = await Promise.all([
    getAcqContracts(),
    getAcqContractStats(),
    getContractableDeals(),
    auth(),
  ]);

  const contracts = (listRes.success ? listRes.data : []) as ContractRow[];
  const stats = (statsRes.success ? statsRes.data : null) as ContractStatsData | null;
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Acquisition Contracts"
        description="Authoring → Approval → Negotiation → Execution → Post-Execution. Track value, signings and gain/loss."
      />
      <ContractsDashboard
        contracts={contracts}
        stats={stats}
        deals={deals as DealOption[]}
        userRole={userRole}
      />
    </div>
  );
}
