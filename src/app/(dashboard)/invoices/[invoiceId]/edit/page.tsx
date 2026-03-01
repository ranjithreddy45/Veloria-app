import { notFound, redirect } from "next/navigation";
import {
  getInvoice,
  getContacts,
  getBookingsForInvoice,
} from "@/actions/invoice.actions";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "../../_components/invoice-form";

export const metadata = {
  title: "Edit Invoice | Veloria Grand",
};

interface EditInvoicePageProps {
  params: Promise<{ invoiceId: string }>;
}

export default async function EditInvoicePage({
  params,
}: EditInvoicePageProps) {
  const { invoiceId } = await params;

  const [invoiceResult, contactsResult, bookingsResult] = await Promise.all([
    getInvoice(invoiceId),
    getContacts(),
    getBookingsForInvoice(),
  ]);

  if (!invoiceResult.success || !invoiceResult.data) {
    notFound();
  }

  const invoice = invoiceResult.data;

  if (invoice.status !== "DRAFT") {
    redirect(`/invoices/${invoiceId}`);
  }

  const contacts = contactsResult.success ? contactsResult.data ?? [] : [];
  const bookings = bookingsResult.success ? bookingsResult.data ?? [] : [];

  // Transform invoice data to form input shape
  const initialData = {
    id: invoice.id,
    contactId: invoice.contactId ?? invoice.contact?.id ?? "",
    bookingId: invoice.bookingId ?? invoice.booking?.id ?? "",
    dueDate: new Date(invoice.dueDate),
    lineItems: invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
    discountPercent: Number(invoice.discountPercent) || 0,
    cgstRate: Number(invoice.cgstRate),
    sgstRate: Number(invoice.sgstRate),
    igstRate: Number(invoice.igstRate),
    notes: invoice.notes || "",
    terms: invoice.terms || "",
    gstin: invoice.gstin || "",
    placeOfSupply: invoice.placeOfSupply || "",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit Invoice ${invoice.invoiceNumber}`}
        description="Modify this draft invoice."
      />
      <InvoiceForm
        contacts={contacts}
        bookings={bookings}
        initialData={initialData}
        invoiceId={invoiceId}
      />
    </div>
  );
}
