import { getContacts, getBookingsForInvoice } from "@/actions/invoice.actions";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "../_components/invoice-form";

export const metadata = {
  title: "New Invoice | Veloria Grand",
};

export default async function NewInvoicePage() {
  const [contactsResult, bookingsResult] = await Promise.all([
    getContacts(),
    getBookingsForInvoice(),
  ]);

  const contacts = contactsResult.success ? contactsResult.data ?? [] : [];
  const bookings = bookingsResult.success ? bookingsResult.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Invoice"
        description="Create a new GST-compliant invoice."
      />
      <InvoiceForm contacts={contacts} bookings={bookings} />
    </div>
  );
}
