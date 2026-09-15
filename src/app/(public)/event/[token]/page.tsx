import type { Metadata } from "next";
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  UtensilsCrossed,
  Phone,
  Sparkles,
  Heart,
} from "lucide-react";
import { getPublicEventPlan } from "@/actions/public-event-plan.actions";
import { HelpChip, helpChipChannels } from "@/components/public/help-chip";
import { getPublicContact, type PublicContact } from "@/lib/public/business-contact";
import { prisma } from "@/lib/prisma";
import { EventCountdown } from "./_components/event-countdown";
import { helpLine, helpRoute, nextSteps } from "./_lib/event-copy";

// ============================================================
// PUBLIC tokenized client event-plan page — /event/[token] (no auth, noindex).
// ------------------------------------------------------------
// After a customer pays, they get this polished branded page showing their
// event coming together: a hero with a live countdown, the confirmed menu, a
// client-friendly run-of-show (time + activity, NO internal owners), their
// point-of-contact, and a warm "what to expect" note.
//
// SECURITY: every field comes ONLY from getPublicEventPlan's client-safe
// projection — never money/costs, internal notes, vendor data, or other
// bookings. The unguessable EventOperation.clientToken is the sole access
// control (mirrors /q, /visit, /hold). A bad/expired token shows a friendly
// card that leaks NO data.
// ============================================================

export const metadata: Metadata = {
  title: "Your event — Veloria Grand",
  robots: { index: false, follow: false }, // tokenized page; keep out of search
};

// Friendly, lowercase occasion noun for the countdown ("Your wedding is in…").
function occasionNoun(eventType: string): string {
  const t = (eventType || "").trim().toLowerCase();
  return t.length > 0 ? t : "event";
}

// The booking's real status, for what the page may promise. getPublicEventPlan has
// already checked this token (format, rate limit) and found the event, but its
// projection doesn't carry the status, so it is read here. null when it can't be
// read: the page then promises nothing about the date.
async function bookingStatusFor(token: string): Promise<string | null> {
  try {
    const op = await prisma.eventOperation.findFirst({
      where: { clientToken: token },
      select: { booking: { select: { status: true } } },
    });
    return op?.booking?.status ?? null;
  } catch {
    return null;
  }
}

// Promises nothing: says what may have happened and offers the numbers the team
// keeps in Settings → Business contact (HelpChip hides itself when none are set).
function NotFoundCard({ contact }: { contact: PublicContact }) {
  return (
    <div className="bg-card shadow-card mx-auto max-w-lg rounded-2xl border p-10 text-center">
      <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-2xl">
        <Sparkles className="size-6" />
      </div>
      <h1 className="text-foreground mt-5 text-h2">
        We couldn&apos;t find this event
      </h1>
      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
        This link may have expired, or your event page isn&apos;t ready yet.
        Please check with the Veloria Grand team.
      </p>
      <HelpChip variant="banner" className="mt-6" contact={contact} />
    </div>
  );
}

export default async function EventPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await getPublicEventPlan(token);

  if (!res.success) return <NotFoundCard contact={await getPublicContact()} />;

  const e = res.data;
  const occasion = occasionNoun(e.eventType);
  const [status, contact] = await Promise.all([bookingStatusFor(token), getPublicContact()]);
  const coordinatorPhone = e.pointOfContact.phone?.trim() || null;
  // The business's published WhatsApp / phone (Settings → Business contact), offered when the coordinator has no number.
  const route = helpRoute(coordinatorPhone, helpChipChannels(contact) !== null);
  const steps = nextSteps(status, route);

  return (
    <div className="space-y-6">
      {/* ---- Hero with countdown ---- */}
      <section className="relative overflow-hidden rounded-3xl bg-zinc-950 px-7 py-12 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-4 rounded-2xl border border-white/12"
        />
        <div className="relative">
          <p className="text-meta font-semibold uppercase tracking-[0.24em] text-white/55">
            {e.clientFirstName}, it&apos;s coming together
          </p>
          <h1 className="mt-4 text-h1 text-white sm:text-h1">
            {e.eventName}
          </h1>
          <div aria-hidden className="mx-auto mt-5 h-px w-14 bg-white/25" />
          <div className="mt-6">
            {/* Morning and Full Day have no hours set by the team: count days, never a clock time. */}
            <EventCountdown
              eventAtISO={e.eventAtISO}
              eventDateISO={e.eventDateISO}
              hasHours={e.slotHasHours}
              occasion={occasion}
            />
          </div>
        </div>
      </section>

      {/* ---- At-a-glance details ---- */}
      <section className="grid grid-cols-2 gap-3">
        {/* The booking's own calendar day (eventDateISO), not a time read in UTC. */}
        <Detail
          icon={<CalendarDays className="text-muted-foreground/60 size-4" />}
          label="Date"
          value={new Date(`${e.eventDateISO}T00:00:00.000Z`).toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        />
        <Detail
          icon={<Clock className="text-muted-foreground/60 size-4" />}
          label="Time"
          value={e.slotLabel}
        />
        {e.venueName && (
          <Detail
            icon={<MapPin className="text-muted-foreground/60 size-4" />}
            label="Venue"
            value={e.venueName}
          />
        )}
        <Detail
          icon={<Users className="text-muted-foreground/60 size-4" />}
          label="Guests"
          value={`${e.guestCount}`}
        />
      </section>

      {/* ---- Confirmed menu ---- */}
      {e.menu.items.length > 0 && (
        <section className="bg-card shadow-card rounded-2xl border p-5 sm:p-6">
          <h2 className="font-editorial text-foreground flex items-center gap-2.5 text-title font-semibold">
            <UtensilsCrossed className="text-muted-foreground/60 size-4" />
            Your menu
          </h2>
          {e.menu.note && (
            <p className="text-muted-foreground mt-1.5 text-xs">{e.menu.note}</p>
          )}
          <ul className="mt-5 space-y-3 border-t pt-4">
            {e.menu.items.map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-3">
                <span className="text-foreground text-sm font-medium">
                  {it.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {it.detail}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Run of show (time + activity only — no internal owners) ---- */}
      {e.timeline.length > 0 && (
        <section className="bg-card shadow-card rounded-2xl border p-5 sm:p-6">
          <h2 className="font-editorial text-foreground flex items-center gap-2.5 text-title font-semibold">
            <Clock className="text-muted-foreground/60 size-4" />
            How the day flows
          </h2>
          <ol className="mt-5 space-y-0 border-t pt-5">
            {e.timeline.map((row, i) => (
              <li key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="bg-primary ring-primary/15 mt-1 size-2 shrink-0 rounded-full ring-4" />
                  {i < e.timeline.length - 1 && (
                    <span className="bg-border w-px flex-1" />
                  )}
                </div>
                <div className="pb-5">
                  <p className="numeric text-primary text-xs font-semibold">
                    {row.time}
                  </p>
                  <p className="text-foreground/90 mt-0.5 text-sm">
                    {row.activity}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ---- What to expect ---- */}
      <section className="border-primary/25 bg-primary/[0.06] rounded-2xl border p-5 sm:p-6">
        <h2 className="font-editorial text-foreground flex items-center gap-2.5 text-title font-semibold">
          <Heart className="size-4 text-destructive" />
          {steps.heading}
        </h2>
        {/* Worded from the booking's real status: "locked in" only once it is confirmed. */}
        <p className="text-foreground/80 mt-3 text-sm leading-relaxed">{steps.body}</p>
      </section>

      {/* ---- Point of contact ---- */}
      {/* No round-the-clock promise: the published support hours when set, and a way to reach
          someone only when there is one (the coordinator's number, else the business's channels). */}
      {(e.pointOfContact.name || coordinatorPhone) && (
        <section className="bg-card shadow-card rounded-2xl border p-5 sm:p-6">
          <p className="text-muted-foreground text-meta font-semibold uppercase tracking-[0.16em]">
            Your event coordinator
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              {e.pointOfContact.name && (
                <p className="font-editorial text-foreground text-lede font-semibold">
                  {e.pointOfContact.name}
                </p>
              )}
              {route && (
                <p className="text-muted-foreground text-xs">{helpLine(contact.supportHours)}</p>
              )}
            </div>
            {coordinatorPhone && (
              <a
                href={`tel:${coordinatorPhone}`}
                className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
              >
                <Phone className="size-4" />
                Call
              </a>
            )}
          </div>
          {route === "team" && (
            // The hours are on the line above, so the chip carries only the buttons.
            <HelpChip className="mt-4 justify-start" contact={{ phone: contact.phone, whatsapp: contact.whatsapp }} />
          )}
        </section>
      )}
      {!e.pointOfContact.name && !coordinatorPhone && route === "team" && (
        <HelpChip variant="banner" contact={contact} />
      )}
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card shadow-card rounded-2xl border p-4">
      <span className="text-muted-foreground/80 flex items-center gap-1.5 text-meta font-semibold uppercase tracking-[0.14em]">
        {icon}
        {label}
      </span>
      <p className="text-foreground mt-1.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
