import { requireGuest } from "@/lib/guest-session";
import { getGuestEvent, getGuestRequests } from "@/actions/guest-host.actions";
import { COMPANY_WHATSAPP, COMPANY_PHONE, HAS_PUBLIC_CONTACT } from "@/lib/constants";
import { ConciergeChat } from "./_components/concierge-chat";

export const dynamic = "force-dynamic";

export default async function ConciergePage() {
  const user = await requireGuest("/app/concierge");
  const ev = await getGuestEvent();
  const requests = ev ? await getGuestRequests(ev.booking.id) : [];
  return (
    <ConciergeChat
      bookingId={ev?.booking.id ?? null}
      eventName={ev?.booking.eventName ?? null}
      coordinator={ev?.team[0] ?? null}
      initial={requests}
      firstName={(user.name ?? "").split(" ")[0] || null}
      whatsapp={HAS_PUBLIC_CONTACT && COMPANY_WHATSAPP ? COMPANY_WHATSAPP : null}
      phone={HAS_PUBLIC_CONTACT && COMPANY_PHONE ? COMPANY_PHONE : null}
    />
  );
}
