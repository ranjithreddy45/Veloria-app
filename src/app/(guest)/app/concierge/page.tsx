import { requireGuest } from "@/lib/guest-session";
import { getMyConversation } from "@/actions/guest-concierge.actions";
import { getPublicContact } from "@/lib/public/business-contact";
import { ConciergeChat } from "./_components/concierge-chat";

export const dynamic = "force-dynamic";

// Concierge: one real conversation with the team about the customer's booking
// (or their enquiry, before a booking exists). The team reads and answers the
// very same messages in the concierge inbox. Call / WhatsApp numbers and team
// hours come from Settings → Business contact (getPublicContact).
export default async function ConciergePage({ searchParams }: { searchParams: Promise<{ booking?: string | string[] }> }) {
  const user = await requireGuest("/app/concierge");
  const sp = await searchParams;
  const bookingId = typeof sp.booking === "string" && sp.booking ? sp.booking : null;
  const [conversation, contact] = await Promise.all([getMyConversation(bookingId), getPublicContact()]);
  const firstName = (user.name ?? "").trim().split(/\s+/)[0] || null;
  const contactContext = `Hi, this is ${firstName ?? "a Veloria guest"}${conversation.booking ? ` (${conversation.booking.eventName})` : ""}.`;

  return (
    <ConciergeChat
      key={conversation.booking?.id ?? "no-booking"}
      initial={conversation}
      contact={contact}
      contactContext={contactContext}
    />
  );
}
