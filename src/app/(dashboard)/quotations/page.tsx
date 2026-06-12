import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getSalesQuotations } from "@/actions/sales-quotation.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { QuotationsTable, type QuotationListRow } from "./_components/quotations-table";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage() {
  const res = await getSalesQuotations();
  const rows = (res.success ? (res.data as QuotationListRow[]) : []) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quotations"
        description="Event quotations built with the calculator — submit for approval, then send to the customer."
      >
        <Button asChild>
          <Link href="/quotations/new">
            <Plus className="h-4 w-4" /> New Quotation
          </Link>
        </Button>
      </PageHeader>
      <QuotationsTable rows={rows} />
    </div>
  );
}
