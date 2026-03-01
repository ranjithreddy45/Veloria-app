import { getContacts, getLeadsForQuote } from "@/actions/quote.actions";
import { PageHeader } from "@/components/layout/page-header";
import { QuoteForm } from "../_components/quote-form";

export const metadata = {
  title: "New Quote | Veloria Grand",
};

export default async function NewQuotePage() {
  const [contactsResult, leadsResult] = await Promise.all([
    getContacts(),
    getLeadsForQuote(),
  ]);

  const contacts = contactsResult.success ? contactsResult.data ?? [] : [];
  const leads = leadsResult.success ? leadsResult.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Quote"
        description="Create a new quotation for a client."
      />
      <QuoteForm contacts={contacts} leads={leads} />
    </div>
  );
}
