import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/../auth";
import { PageHeader } from "@/components/layout/page-header";
import { getPortalGuestList } from "@/actions/portal-guest.actions";
import { PortalGuestManager, type PortalGuest } from "../_components/portal-guest-manager";

export const metadata: Metadata = { title: "Guest List" };

export default async function PortalGuestBookingPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const { bookingId } = await params;

  const res = await getPortalGuestList(bookingId);
  if (!res.success) notFound(); // not the host's booking → 404 (never leak existence)

  const { booking, guests, stats } = res.data as {
    booking: { id: string; eventName: string; date: string; venueName: string };
    guests: PortalGuest[];
    stats: { total: number; invited: number; accepted: number; declined: number; pending: number; sent: number };
  };
  const when = new Date(booking.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-10">
      <Link
        href="/portal/guests"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[13px] transition-colors"
      >
        <ArrowLeft className="size-3.5" /> All events
      </Link>
      <PageHeader
        eyebrow="Your account"
        title={`Guests — ${booking.eventName}`}
        description={`${booking.venueName} · ${when}. Invite the people you love and watch the replies come in.`}
      />
      <PortalGuestManager bookingId={booking.id} eventName={booking.eventName} guests={guests} stats={stats} />
    </div>
  );
}
