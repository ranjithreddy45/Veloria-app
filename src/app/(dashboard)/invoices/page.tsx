import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { getInvoices } from "@/actions/invoice.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { InvoicesTable } from "./_components/invoices-table";

export const metadata = {
  title: "Invoices",
};

export default async function InvoicesPage() {
  const result = await getInvoices();

  const invoices = result.success ? result.data?.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        help={<PageHelp id="invoices" />}
        description="Manage invoices, track payments and generate GST-compliant documents."
      >
        <Button asChild>
          <Link href="/invoices/new">
            <PlusIcon className="mr-2 size-4" />
            New Invoice
          </Link>
        </Button>
      </PageHeader>

      <InvoicesTable data={invoices} />
    </div>
  );
}
