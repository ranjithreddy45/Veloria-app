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
      <div className="bg-card shadow-card mx-auto max-w-lg rounded-2xl border p-10 text-center">
        <h1 className="text-foreground text-h2">
          We couldn&apos;t find this visit
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
          The link may have expired — but we&apos;d still love to show you
          around.
        </p>
        <a
          href="/visit"
          className="bg-primary text-primary-foreground mt-6 inline-block rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Book a visit
        </a>
      </div>
    );
  }

  const v = res.data;
  const copy = STATUS_COPY[v.status] ?? STATUS_COPY.REQUESTED;

  return (
    <div className="space-y-6">
      <header className="pb-1 text-center">
        <p className="text-muted-foreground text-meta font-semibold uppercase tracking-[0.18em]">
          For {v.customerFirstName}
        </p>
        <h1 className="text-foreground mt-3 text-h1 sm:text-h1">
          {copy.title}
        </h1>
      </header>

      {v.status === "CONFIRMED" && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-success/25 bg-success/[0.07] p-7 text-center">
          <CheckCircle2 className="size-7 text-success" />
          <p className="text-sm font-medium text-success">
            {copy.line}
          </p>
        </div>
      )}

      {/* Summary card — prospect's own details only */}
      <div className="bg-card shadow-card space-y-3.5 rounded-2xl border p-5 sm:p-6">
        <Row
          icon={<Sparkles className="text-muted-foreground/60 size-4" />}
          label="Visit"
          value={v.kindLabel}
        />
        {v.venueName && (
          <Row
            icon={<MapPin className="text-muted-foreground/60 size-4" />}
            label="Venue"
            value={v.venueName}
          />
        )}
        <Row
          icon={<CalendarDays className="text-muted-foreground/60 size-4" />}
          label="Date"
          value={v.dateLabel}
        />
        <Row
          icon={<Clock className="text-muted-foreground/60 size-4" />}
          label="Time"
          value={v.timeLabel}
        />
      </div>

      {v.status !== "CONFIRMED" && (
        <p className="text-muted-foreground text-center text-sm">{copy.line}</p>
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
      <span className="text-muted-foreground flex items-center gap-2 text-sm">
        {icon}
        {label}
      </span>
      <span className="text-foreground text-right text-sm font-medium">
        {value}
      </span>
    </div>
  );
}
