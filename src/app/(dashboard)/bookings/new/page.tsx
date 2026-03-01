import type { Metadata } from "next";
import { getVenues } from "@/actions/booking.actions";
import { getContacts } from "@/actions/contact.actions";
import { PageHeader } from "@/components/layout/page-header";
import { BookingForm } from "../_components/booking-form";

export const metadata: Metadata = { title: "New Booking" };

// ============================================================
// Create Booking Page
// ============================================================

interface NewBookingPageProps {
  searchParams: Promise<{ date?: string; timeSlot?: string }>;
}

export default async function NewBookingPage({
  searchParams,
}: NewBookingPageProps) {
  const params = await searchParams;

  const [venuesResult, contactsResult] = await Promise.all([
    getVenues(),
    getContacts({ limit: 200 }),
  ]);

  const venues = venuesResult.success
    ? venuesResult.data.map((v) => ({ ...v, pricePerSlot: Number(v.pricePerSlot) }))
    : [];
  const contacts = contactsResult.success ? contactsResult.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Booking"
        description="Create a new event booking."
      />
      <div className="mx-auto max-w-3xl">
        <BookingForm
          venues={venues}
          contacts={contacts}
          defaultDate={params.date}
          defaultTimeSlot={params.timeSlot}
        />
      </div>
    </div>
  );
}
