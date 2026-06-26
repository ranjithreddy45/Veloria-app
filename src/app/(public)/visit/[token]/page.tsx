import type { Metadata } from "next";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
} from "lucide-react";
import { getPublicVisitByToken } from "@/actions/public-site-visit.actions";
import { VisitManage } from "./_components/visit-manage";

// ============================================================
// PUBLIC (no auth) — visit confirm/manage page. Tokenized access only; the
// unguessable SiteVisitBooking.token is the sole access control. Renders ONLY
// the prospect's own submission (never leadId / rep / other bookings).
// Mirrors hold/[token] + pay/[token] structure.
// ============================================================

export const metadata: Metadata = {
  title: "Your visit — Veloria Grand",
  robots: { index: false, follow: false }, // tokenized page; keep out of search
};

const STATUS_COPY: Record<
  string,
  { title: string; tone: string; line: string }
> = {
  REQUESTED: {
    title: "Visit requested",
    tone: "amber",
    line: "We've received your request — our team will confirm shortly.",
  },
  CONFIRMED: {
    title: "Visit confirmed",
    tone: "emerald",
    line: "You're all set. We look forward to welcoming you!",
  },
  COMPLETED: {
    title: "Visit complete",
    tone: "zinc",
    line: "Thanks for visiting us. We hope to host your event soon!",
  },
  CANCELLED: {
    title: "Visit cancelled",
    tone: "zinc",
    line: "This visit was cancelled. You're welcome to book another time.",
  },
  NO_SHOW: {
    title: "Visit missed",
    tone: "zinc",
    line: "Looks like this visit didn't happen — book a new time whenever you like.",
  },
  RESCHEDULED: {
    title: "Visit rescheduled",
    tone: "amber",
    line: "Your visit was rescheduled and is awaiting confirmation.",
  },
};

export default async function VisitManagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await getPublicVisitByToken(token);

  if (!res.success) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          We couldn&apos;t find this visit
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          The link may have expired. Please book your visit again.
        </p>
        <a
          href="/visit"
          className="mt-4 inline-block rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Book a visit
        </a>
      </div>
    );
  }

  const v = res.data;
  const copy = STATUS_COPY[v.status] ?? STATUS_COPY.REQUESTED;

  return (
    <div className="space-y-5">
      <header className="text-center">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {copy.title}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Hi {v.customerFirstName} 👋</p>
      </header>

      {v.status === "CONFIRMED" && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="size-7 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            {copy.line}
          </p>
        </div>
      )}

      {/* Summary card — prospect's own details only */}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <Row
          icon={<Sparkles className="size-4 text-violet-600" />}
          label="Visit"
          value={v.kindLabel}
        />
        {v.venueName && (
          <Row
            icon={<MapPin className="size-4 text-violet-600" />}
            label="Venue"
            value={v.venueName}
          />
        )}
        <Row
          icon={<CalendarDays className="size-4 text-violet-600" />}
          label="Date"
          value={v.dateLabel}
        />
        <Row
          icon={<Clock className="size-4 text-violet-600" />}
          label="Time"
          value={v.timeLabel}
        />
      </div>

      {v.status !== "CONFIRMED" && (
        <p className="text-center text-sm text-zinc-500">{copy.line}</p>
      )}

      {v.manageable && (
        <VisitManage token={v.token} scheduledAtISO={v.scheduledAtISO} />
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-zinc-500">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </span>
    </div>
  );
}
