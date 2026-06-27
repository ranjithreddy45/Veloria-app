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
import { EventCountdown } from "./_components/event-countdown";

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

function NotFoundCard() {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
        <Sparkles className="size-6" />
      </div>
      <p className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
        We couldn&apos;t find this event
      </p>
      <p className="mt-1.5 text-sm text-zinc-500">
        This link may have expired or isn&apos;t quite ready yet. Please reach
        out to your event coordinator and they&apos;ll sort it out.
      </p>
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

  if (!res.success) return <NotFoundCard />;

  const e = res.data;
  const occasion = occasionNoun(e.eventType);

  return (
    <div className="space-y-6">
      {/* ---- Hero with countdown ---- */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-rose-500 p-7 text-center shadow-lg shadow-violet-500/20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          Hi {e.clientFirstName} 👋 — it&apos;s coming together
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {e.eventName}
        </h1>
        <div className="mt-5">
          <EventCountdown eventAtISO={e.eventAtISO} occasion={occasion} />
        </div>
      </section>

      {/* ---- At-a-glance details ---- */}
      <section className="grid grid-cols-2 gap-3">
        <Detail
          icon={<CalendarDays className="size-4 text-violet-600" />}
          label="Date"
          value={new Date(e.eventAtISO).toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        />
        <Detail
          icon={<Clock className="size-4 text-violet-600" />}
          label="Time"
          value={e.slotLabel}
        />
        {e.venueName && (
          <Detail
            icon={<MapPin className="size-4 text-violet-600" />}
            label="Venue"
            value={e.venueName}
          />
        )}
        <Detail
          icon={<Users className="size-4 text-violet-600" />}
          label="Guests"
          value={`${e.guestCount}`}
        />
      </section>

      {/* ---- Confirmed menu ---- */}
      {e.menu.items.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            <UtensilsCrossed className="size-4 text-rose-500" />
            Your menu
          </h2>
          {e.menu.note && (
            <p className="mt-1 text-xs text-zinc-500">{e.menu.note}</p>
          )}
          <ul className="mt-4 space-y-3">
            {e.menu.items.map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-3">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {it.name}
                </span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {it.detail}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Run of show (time + activity only — no internal owners) ---- */}
      {e.timeline.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            <Clock className="size-4 text-violet-600" />
            How the day flows
          </h2>
          <ol className="mt-4 space-y-0">
            {e.timeline.map((row, i) => (
              <li key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="mt-0.5 size-2.5 shrink-0 rounded-full bg-violet-500 ring-4 ring-violet-100 dark:ring-violet-950" />
                  {i < e.timeline.length - 1 && (
                    <span className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                  )}
                </div>
                <div className="pb-5">
                  <p className="text-xs font-semibold tabular-nums text-violet-600 dark:text-violet-400">
                    {row.time}
                  </p>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">
                    {row.activity}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ---- What to expect ---- */}
      <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-900 dark:bg-violet-950/30">
        <h2 className="flex items-center gap-2 text-sm font-bold text-violet-900 dark:text-violet-200">
          <Heart className="size-4 text-rose-500" />
          What to expect next
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-violet-900/80 dark:text-violet-200/80">
          Your date is locked in and our team is already preparing everything for
          your big day. We&apos;ll confirm the final details with you as we get
          closer. If anything changes or you have a special request, your event
          coordinator is just a message away.
        </p>
      </section>

      {/* ---- Point of contact ---- */}
      {(e.pointOfContact.name || e.pointOfContact.phone) && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Your event coordinator
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              {e.pointOfContact.name && (
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {e.pointOfContact.name}
                </p>
              )}
              <p className="text-xs text-zinc-500">Here to help, any time</p>
            </div>
            {e.pointOfContact.phone && (
              <a
                href={`tel:${e.pointOfContact.phone}`}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700"
              >
                <Phone className="size-4" />
                Call
              </a>
            )}
          </div>
        </section>
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        {icon}
        {label}
      </span>
      <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
    </div>
  );
}
