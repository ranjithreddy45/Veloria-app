import Link from "next/link";
import { requireGuest } from "@/lib/guest-session";
import { getPublishedPolicy, policyPath, POLICY_KEYS, type PublishedPolicy } from "@/lib/public/policies";
import {
  BOOKING_STATUS_LABEL,
  COLLABORATOR_ROLE_LABEL,
  CUSTOMER_REQUEST_STATUS_LABEL,
  customerLabel,
} from "@/lib/customer-app/status-labels";
import { PRIVACY_REQUEST_KIND_LABEL, type PrivacyRequestKind } from "@/lib/privacy/policy";
import {
  cancelGuestEmailChange,
  getGuestAccountDetails,
  requestGuestDataDeletion,
  requestGuestEmailChange,
  updateGuestName,
  updateGuestNotificationPreferences,
  type GuestAccountDetails,
} from "@/actions/guest-account.actions";
import { Screen, Title, Card, Row, Pill, SectionTitle, EmptyNote, type Tone } from "../../_components/ui";
import { fmtDate, initials, inr } from "../../_components/format";
import { ShortlistCount } from "../../_components/shortlist";
import { ContactChip } from "../../_components/contact-chip";
import { PushOptIn } from "../../_components/push-opt-in";
import { tierName } from "../rewards/_lib/perks";
import { privacyStatusForCustomer } from "./_lib/account-rules";
import { SignOutButton } from "./_components/sign-out";
import { NameEditor } from "./_components/name-editor";
import { EmailEditor } from "./_components/email-editor";
import { DeleteMyData } from "./_components/delete-my-data";
import { NotificationPreferences } from "./_components/notification-preferences";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, Tone> = {
  HOLD: "amber",
  TENTATIVE: "amber",
  CONFIRMED: "plum",
  IN_PROGRESS: "gold",
  COMPLETED: "green",
  CANCELLED: "grey",
};

/** "Settled" only once something has been billed: issued invoices exist and nothing is left to pay. */
function paymentsDetail(p: GuestAccountDetails["payments"]): string | undefined {
  if (!p) return undefined;
  if (p.invoicesIssued === 0) return "Nothing billed yet";
  return p.balanceDue > 0 ? `${inr(p.balanceDue)} due` : "Settled";
}

function noBookingsCopy(a: GuestAccountDetails): string {
  if (a.preview) return "No booking is selected for this preview.";
  if (!a.emailVerified) {
    return "No bookings are linked to this sign-in yet. We only show a booking once we know the sign-in is really yours: sign in with the WhatsApp number on the booking, or ask the team to link it.";
  }
  return "No bookings are linked to this sign-in yet. Hold a date, or ask the team to link an existing booking.";
}

async function publishedPolicies(): Promise<PublishedPolicy[]> {
  const rows = await Promise.all(POLICY_KEYS.map((key) => getPublishedPolicy(key)));
  return rows.filter((p): p is PublishedPolicy => p !== null);
}

export default async function AccountPage() {
  await requireGuest("/app/account");
  const [a, policies] = await Promise.all([getGuestAccountDetails(), publishedPolicies()]);
  if (!a) return null;
  const locked = a.preview;
  const requests = a.privacyRequests.map((r) => ({
    id: r.id,
    kind: PRIVACY_REQUEST_KIND_LABEL[r.kind as PrivacyRequestKind] ?? "Privacy request",
    status: customerLabel(CUSTOMER_REQUEST_STATUS_LABEL, privacyStatusForCustomer(r.status)),
    open: r.open,
    date: fmtDate(r.createdAt, { day: "numeric", month: "short", year: "numeric" }),
  }));

  return (
    <Screen className="vg-gutter pt-[calc(var(--sat)+1rem)]">
      <Title>Account</Title>

      {a.preview && (
        <p className="rounded-2xl bg-[#fdf3e1] px-4 py-3 text-detail leading-[1.5] text-[#8a5a00]">
          Staff preview. The name, email and phone below are your own sign-in. Bookings, points and payments are the host&apos;s for the
          booking you&apos;re previewing, as far as your role can see them in the team app. Changes are switched off.
        </p>
      )}

      <Card className="flex items-center gap-3.5 rounded-[18px] p-4">
        <span className="flex size-[54px] shrink-0 items-center justify-center rounded-full bg-[#6d1b52] text-copy font-semibold text-[#fdf5f3] shadow-[0_0_0_1.5px_rgba(232,182,49,.6)]">
          {initials(a.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-copy font-semibold">{a.name ?? "Guest"}</div>
          {a.loyalty && <div className="truncate text-detail font-semibold text-[#b88513]">{tierName(a.loyalty.tier)} member</div>}
        </div>
        {a.loyalty && (
          <Link href="/app/rewards" className="numeric shrink-0 rounded-full bg-[#faf3e1] px-3 py-2 text-meta font-semibold text-[#8a6a1a]">
            {a.loyalty.points.toLocaleString("en-IN")} pts
          </Link>
        )}
      </Card>

      <div>
        <SectionTitle title="Your details" />
        <Card className="vg-divide mt-2.5 overflow-hidden">
          <NameEditor name={a.name} disabled={locked} action={updateGuestName} />
          <EmailEditor
            email={a.email}
            verified={a.emailVerified}
            pending={a.pendingEmail}
            deliveryConfigured={a.emailDeliveryConfigured}
            disabled={locked}
            requestAction={requestGuestEmailChange}
            cancelAction={cancelGuestEmailChange}
          />
          <div className="px-4 py-3.5">
            <div className="text-meta text-[#6e6e73]">Phone</div>
            {a.phone ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <span className="numeric text-copy">{a.phone}</span>
                {a.phoneSource === "ACCOUNT" ? (
                  <Pill tone={a.phoneVerified ? "green" : "amber"}>{a.phoneVerified ? "Verified" : "Not verified"}</Pill>
                ) : (
                  <Pill tone="grey">On your booking</Pill>
                )}
              </div>
            ) : (
              <div className="mt-0.5 text-copy text-[#6e6e73]">No number on file</div>
            )}
            <p className="mt-1.5 text-meta leading-[1.5] text-[#6e6e73]">
              {a.phoneSource === "ACCOUNT" && a.phoneVerified
                ? "Proven with a WhatsApp code. To change it, ask the team."
                : "To change or verify your number, ask the team."}
            </p>
          </div>
        </Card>
      </div>

      <div>
        <SectionTitle title="Your bookings" />
        {a.bookings.length === 0 ? (
          <EmptyNote className="mt-2.5">{noBookingsCopy(a)}</EmptyNote>
        ) : (
          <Card className="vg-divide mt-2.5 overflow-hidden">
            {a.bookings.map((b) => (
              <Row
                key={b.id}
                href={`/app/event?b=${b.id}`}
                detail={<Pill tone={STATUS_TONE[b.status] ?? "grey"}>{customerLabel(BOOKING_STATUS_LABEL, b.status)}</Pill>}
              >
                <span className="block truncate font-medium">{b.eventName}</span>
                <span className="block truncate text-meta text-[#6e6e73]">
                  {fmtDate(b.date, { day: "numeric", month: "short", year: "numeric" })}
                  {b.venueName ? ` · ${b.venueName}` : ""}
                  {b.sharedRole ? ` · Shared with you: ${customerLabel(COLLABORATOR_ROLE_LABEL, b.sharedRole)}` : ""}
                </span>
              </Row>
            ))}
          </Card>
        )}
      </div>

      <Card className="vg-divide overflow-hidden">
        <Row href="/app/notifications" detail={a.unreadNotifications > 0 ? `${a.unreadNotifications} new` : undefined}>Notifications</Row>
        <Row href="/app/payments" detail={paymentsDetail(a.payments)}>Payments</Row>
        <Row href="/app/event/documents">Documents</Row>
        <Row href="/app/venues" detail={<ShortlistCount />}>Saved halls</Row>
        <Row href="/app/rewards">Rewards</Row>
        <Row href="/app/rate">Rate your experience</Row>
        <Row href="/get-app">Install the app</Row>
      </Card>

      <div>
        <SectionTitle title="Help and policies" />
        <Card className="vg-divide mt-2.5 overflow-hidden">
          <Row href="/app/help">Help</Row>
          {policies.map((p) => (
            <Row key={p.key} href={policyPath(p.key)}>
              {p.title}
            </Row>
          ))}
          <Row href="/privacy">Privacy policy</Row>
        </Card>
        <ContactChip className="mt-2.5" context="Hello Veloria team, I have a question about my account." />
      </div>

      {a.notificationPreferencesEnforced && (
        <div>
          <SectionTitle title="Email and text updates" />
          <NotificationPreferences rows={a.notificationPreferences} disabled={locked} action={updateGuestNotificationPreferences} />
        </div>
      )}

      {!a.preview && (
        <div>
          <SectionTitle title="Your data" />
          <DeleteMyData requests={requests} hasOpenRequest={a.hasOpenDeletionRequest} retentionYears={a.retentionYears} action={requestGuestDataDeletion} />
        </div>
      )}

      <PushOptIn className="mb-3" />
      <SignOutButton />
    </Screen>
  );
}
