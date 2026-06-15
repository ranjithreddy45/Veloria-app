import { getContacts, getBookingsForInvoice } from "@/actions/invoice.actions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InvoiceForm } from "../_components/invoice-form";

export const metadata = {
  title: "New Invoice",
};

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>;
}) {
  const { bookingId } = await searchParams;

  const [contactsResult, bookingsResult] = await Promise.all([
    getContacts(),
    getBookingsForInvoice(),
  ]);

  const contacts = contactsResult.success ? contactsResult.data ?? [] : [];
  const bookings = bookingsResult.success ? bookingsResult.data ?? [] : [];

  // Optional prefill from ?bookingId= ("Generate Invoice" on a booking). We
  // preselect the customer + booking and seed a single line item from the
  // event so the team isn't re-keying the lookup. The amount is the agreed
  // event total — the GST treatment stays in the form for the user to confirm
  // against the live total before saving.
  let initialData;
  if (bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        eventName: true,
        bookingNumber: true,
        totalAmount: true,
        contactId: true,
        status: true,
      },
    });
    if (booking && booking.status !== "CANCELLED") {
      initialData = {
        contactId: booking.contactId,
        bookingId: booking.id,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lineItems: [
          {
            description: `${booking.eventName} (Booking ${booking.bookingNumber})`,
            quantity: 1,
            unitPrice: Number(booking.totalAmount),
          },
        ],
        discountPercent: 0,
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 0,
        notes: "",
        terms:
          "1. Payment is due within 30 days of invoice date.\n2. Late payments may attract interest at 18% per annum.\n3. All disputes are subject to local jurisdiction.",
        gstin: "",
        placeOfSupply: "",
      };
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Invoice"
        description="Create a new GST-compliant invoice."
      />
      <InvoiceForm contacts={contacts} bookings={bookings} initialData={initialData} />
    </div>
  );
}
