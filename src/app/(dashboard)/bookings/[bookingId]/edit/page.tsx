import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getBooking, getVenues } from "@/actions/booking.actions";
import { getContacts } from "@/actions/contact.actions";
import { PageHeader } from "@/components/layout/page-header";
import { BookingForm } from "../../_components/booking-form";

export const metadata: Metadata = { title: "Edit Booking" };

// ============================================================
// Edit Booking Page
// ============================================================

interface EditBookingPageProps {
  params: Promise<{ bookingId: string }>;
}

export default async function EditBookingPage({
  params,
}: EditBookingPageProps) {
  const { bookingId } = await params;

  const [bookingResult, venuesResult, contactsResult] = await Promise.all([
    getBooking(bookingId),
    getVenues({ activeOnly: false }), // editing an existing booking — keep its venue selectable even if retired
    getContacts({ limit: 200 }),
  ]);

  if (!bookingResult.success || !bookingResult.data) {
    notFound();
  }

  const booking = bookingResult.data;
  const venues = venuesResult.success
    ? venuesResult.data.map((v) => ({ ...v, pricePerSlot: Number(v.pricePerSlot) }))
    : [];
  const contacts = contactsResult.success ? contactsResult.data.data : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Booking"
        description={`Editing ${booking.bookingNumber} - ${booking.eventName}`}
      />
      <div className="mx-auto max-w-3xl">
        <BookingForm
          booking={{
            id: booking.id,
            eventName: booking.eventName,
            eventType: booking.eventType,
            venueId: booking.venueId,
            contactId: booking.contactId,
            date: booking.date,
            timeSlot: booking.timeSlot,
            guestCount: booking.guestCount,
            totalAmount: Number(booking.totalAmount),
            hallBooked: booking.hallBooked,
            startTime: booking.startTime,
            endTime: booking.endTime,
            perPlatePrice: booking.perPlatePrice != null ? Number(booking.perPlatePrice) : null,
            hallRental: booking.hallRental != null ? Number(booking.hallRental) : null,
            decorCharges: booking.decorCharges != null ? Number(booking.decorCharges) : null,
            otherServices: booking.otherServices != null ? Number(booking.otherServices) : null,
            specialRequests: booking.specialRequests,
            internalNotes: booking.internalNotes,
          }}
          venues={venues}
          contacts={contacts}
        />
      </div>
    </div>
  );
}
