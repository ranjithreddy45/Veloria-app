import Link from "next/link";
import { requireGuest } from "@/lib/guest-session";
import { getGuestAccount, getGuestOverview } from "@/actions/guest-host.actions";
import { Screen, Title, Card, Row } from "../../_components/ui";
import { initials, inr } from "../../_components/format";
import { SignOutButton } from "./_components/sign-out";

export const dynamic = "force-dynamic";
const TIER: Record<string, string> = { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum" };

export default async function AccountPage() {
  await requireGuest("/app/account");
  const [a, ov] = await Promise.all([getGuestAccount(), getGuestOverview()]);
  if (!a) return null;

  return (
    <Screen className="pt-[calc(var(--sat)+1rem)]">
      <Title>Account</Title>
      <Card className="flex items-center gap-3.5 rounded-[18px] p-4">
        <span className="flex size-[54px] shrink-0 items-center justify-center rounded-full bg-[#6d1b52] text-copy font-semibold text-[#fdf5f3] shadow-[0_0_0_1.5px_rgba(232,182,49,.6)]">{initials(a.name)}</span>
        <div className="min-w-0 flex-1"><div className="truncate text-copy font-semibold">{a.name ?? "Guest"}</div><div className="truncate text-detail text-[#6e6e73]">{a.phone ?? a.email ?? ""}{a.tier ? <> · <span className="font-semibold text-[#b88513]">{TIER[a.tier] ?? a.tier}</span></> : null}</div></div>
        <Link href="/app/rewards" className="numeric shrink-0 rounded-full bg-[#faf3e1] px-3 py-2 text-meta font-semibold text-[#8a6a1a]">{a.points.toLocaleString("en-IN")} pts</Link>
      </Card>

      <Card className="vg-divide overflow-hidden">
        <Row href="/app/event" detail={ov?.booking ? ov.booking.eventName : "None yet"}>My event</Row>
        <Row href="/app/notifications" detail={ov && ov.unread > 0 ? `${ov.unread} new` : "All read"}>Notifications</Row>
        <Row href="/app/payments" detail={ov && ov.balanceDue > 0 ? `${inr(ov.balanceDue)} due` : "Settled"}>Payments</Row>
        <Row href="/app/event/documents">Documents</Row>
        <Row href="/app/rate">Rate your experience</Row>
        <Row href="/app/concierge">Help &amp; house rules</Row>
        <Row href="/get-app">Install the app</Row>
      </Card>

      <Card className="vg-divide overflow-hidden">
        <div className="flex min-h-[52px] items-center gap-3 px-4 py-3.5"><span className="flex-1 text-copy">Language</span><span className="text-detail text-[#6e6e73]">English</span></div>
        <div className="flex min-h-[52px] items-center gap-3 px-4 py-3.5"><span className="flex-1 text-copy">Bookings with us</span><span className="numeric text-detail text-[#6e6e73]">{a.bookings}</span></div>
      </Card>

      {!a.verified && <p className="text-center text-meta leading-[1.5] text-[#6e6e73]">This sign-in isn&apos;t linked to a booking yet. Hold a date, or ask the concierge to link an existing one.</p>}
      <SignOutButton />
    </Screen>
  );
}
