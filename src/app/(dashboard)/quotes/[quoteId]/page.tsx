import { notFound } from "next/navigation";
import { getQuote } from "@/actions/quote.actions";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { QUOTE_STATUS_COLORS } from "@/lib/constants";
import { QuoteDetail } from "../_components/quote-detail";

export const metadata = {
  title: "Quote Details | Veloria Grand",
};

interface QuoteDetailPageProps {
  params: Promise<{ quoteId: string }>;
}

export default async function QuoteDetailPage({
  params,
}: QuoteDetailPageProps) {
  const { quoteId } = await params;
  const result = await getQuote(quoteId);

  if (!result.success || !result.data) {
    notFound();
  }

  const quote = result.data;
  const statusColors = QUOTE_STATUS_COLORS[quote.status] || "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Quote ${quote.quoteNumber}`}
        description={`${quote.contact.firstName} ${quote.contact.lastName}${quote.contact.company ? ` - ${quote.contact.company}` : ""} | ${quote.title}`}
      >
        <Badge variant="outline" className={`${statusColors} border text-sm`}>
          {quote.status.replace("_", " ")}
        </Badge>
      </PageHeader>

      <QuoteDetail quote={quote} />
    </div>
  );
}
