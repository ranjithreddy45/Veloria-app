import { notFound, redirect } from "next/navigation";
import {
  getQuote,
  getContacts,
  getLeadsForQuote,
} from "@/actions/quote.actions";
import { PageHeader } from "@/components/layout/page-header";
import { QuoteForm } from "../../_components/quote-form";

export const metadata = {
  title: "Edit Quote | Veloria Grand",
};

interface EditQuotePageProps {
  params: Promise<{ quoteId: string }>;
}

export default async function EditQuotePage({
  params,
}: EditQuotePageProps) {
  const { quoteId } = await params;

  const [quoteResult, contactsResult, leadsResult] = await Promise.all([
    getQuote(quoteId),
    getContacts(),
    getLeadsForQuote(),
  ]);

  if (!quoteResult.success || !quoteResult.data) {
    notFound();
  }

  const quote = quoteResult.data;

  if (quote.status !== "DRAFT") {
    redirect(`/quotes/${quoteId}`);
  }

  const contacts = contactsResult.success ? contactsResult.data ?? [] : [];
  const leads = leadsResult.success ? leadsResult.data ?? [] : [];

  // Transform quote data to form input shape
  const initialData = {
    id: quote.id,
    title: quote.title,
    contactId: quote.contactId ?? quote.contact?.id ?? "",
    leadId: quote.leadId ?? quote.lead?.id ?? "",
    packageId: quote.packageId ?? quote.package?.id ?? "",
    validUntil: new Date(quote.validUntil),
    lineItems: quote.lineItems.map((item: { description: string; quantity: number | string; unitPrice: number | string; category?: string | null }) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      category: item.category || "",
    })),
    discountPercent: Number(quote.discountPercent) || 0,
    taxRate: Number(quote.taxRate),
    notes: quote.notes || "",
    terms: quote.terms || "",
    coverLetter: quote.coverLetter || "",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit Quote ${quote.quoteNumber}`}
        description="Modify this draft quotation."
      />
      <QuoteForm
        contacts={contacts}
        leads={leads}
        initialData={initialData}
        quoteId={quoteId}
      />
    </div>
  );
}
