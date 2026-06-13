import { notFound } from "next/navigation";
import Link from "next/link";
import { PencilIcon } from "lucide-react";
import { getContract } from "@/actions/contract.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { CONTRACT_STATUS_COLORS } from "@/lib/constants";
import { ContractDetail } from "../_components/contract-detail";

export const metadata = {
  title: "Contract Details",
};

interface ContractDetailPageProps {
  params: Promise<{ contractId: string }>;
}

export default async function ContractDetailPage({
  params,
}: ContractDetailPageProps) {
  const { contractId } = await params;
  const result = await getContract(contractId);

  if (!result.success || !result.data) {
    notFound();
  }

  const contract = result.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={contract.title}
        description={`${contract.contact.firstName} ${contract.contact.lastName}${contract.contact.company ? ` - ${contract.contact.company}` : ""}`}
      >
        <StatusBadge
          status={contract.status}
          colorMap={CONTRACT_STATUS_COLORS}
          className="text-sm"
        />
        {contract.status === "DRAFT" && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/contracts/${contractId}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </Button>
        )}
      </PageHeader>

      <ContractDetail contract={contract} />
    </div>
  );
}
