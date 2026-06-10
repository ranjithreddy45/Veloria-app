import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { getQuotes } from "@/actions/quote.actions";
import { PageHeader } from "@/components/layout/page-header";
import { PageHelp } from "@/lib/page-help";
import { Button } from "@/components/ui/button";
import { QuotesTable } from "./_components/quotes-table";

export const metadata = {
  title: "Quotes | Veloria Grand",
};

export default async function QuotesPage() {
  const result = await getQuotes();

  const quotes = result.success ? result.data?.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        help={<PageHelp id="quotes" />}
        description="Create and manage quotations for clients. Track status, send proposals, and convert to invoices."
      >
        <Button asChild>
          <Link href="/quotes/new">
            <PlusIcon className="mr-2 size-4" />
            New Quote
          </Link>
        </Button>
      </PageHeader>

      <QuotesTable data={quotes} />
    </div>
  );
}
