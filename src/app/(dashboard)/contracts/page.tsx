import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { getContracts } from "@/actions/contract.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { ContractsTable } from "./_components/contracts-table";

export const metadata = {
  title: "Sales Contracts",
};

export default async function ContractsPage() {
  const result = await getContracts();

  const contracts = result.success ? result.data?.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Contracts"
        help={<PageHelp id="contracts" />}
        description="Manage contracts, send for signatures, and track signing status."
      >
        <Button asChild>
          <Link href="/contracts/new">
            <PlusIcon className="mr-2 size-4" />
            New Contract
          </Link>
        </Button>
      </PageHeader>

      <ContractsTable data={contracts} />
    </div>
  );
}
