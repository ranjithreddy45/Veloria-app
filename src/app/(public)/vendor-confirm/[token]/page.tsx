import type { Metadata } from "next";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  XCircle,
} from "lucide-react";
import { getVendorAssignmentByToken } from "@/actions/public-vendor-confirm.actions";
import { VendorConfirm } from "./_components/vendor-confirm";

// ============================================================
// PUBLIC (no auth) — vendor confirm/decline page. Tokenized access only; the
// unguessable OperationVendorAssignment.respondToken is the sole access control.
// Renders ONLY this vendor's own assignment (event name/date/slot/venue + role)
// — never pricing, contacts, or other assignments. Mirrors visit/[token].
// ============================================================

export const metadata: Metadata = {
  title: "Confirm your booking — Veloria Grand",
  robots: { index: false, follow: false }, // tokenized page; keep out of search
};

export default async function VendorConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await getVendorAssignmentByToken(token);

  if (!res.success) {
    return (
      <div className="bg-card shadow-card mx-auto max-w-lg rounded-2xl border p-10 text-center">
        <h1 className="text-foreground text-h2">
          We couldn&apos;t find this request
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
          The link may have expired or is no longer valid. Your coordinator can
          send a new one.
        </p>
      </div>
    );
  }

  const a = res.data;

  return (
    <div className="space-y-6">
      <header className="pb-1 text-center">
        <p className="text-muted-foreground text-meta font-semibold uppercase tracking-[0.18em]">
          For {a.vendorName}
        </p>
        <h1 className="text-foreground mt-3 text-h1 sm:text-h1">
          {a.status === "CONFIRMED"
            ? "You're confirmed"
            : a.status === "DECLINED"
              ? "Request declined"
              : "Confirm your booking"}
        </h1>
      </header>

      {a.status === "CONFIRMED" && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-success/25 bg-success/[0.07] p-7 text-center">
          <CheckCircle2 className="size-7 text-success" />
          <p className="text-sm font-medium text-success">
            Thank you — your confirmation is recorded. We look forward to
            working with you.
          </p>
        </div>
      )}

      {a.status === "DECLINED" && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-destructive/25 bg-destructive/[0.07] p-7 text-center">
          <XCircle className="size-7 text-destructive" />
          <p className="text-sm font-medium text-destructive">
            You&apos;ve declined this request. Our team has been notified.
          </p>
        </div>
      )}

      {/* Summary card — vendor's own details only */}
      <div className="bg-card shadow-card space-y-3.5 rounded-2xl border p-5 sm:p-6">
        <Row
          icon={<Sparkles className="text-muted-foreground/60 size-4" />}
          label="Event"
          value={a.eventName}
        />
        {a.role && (
          <Row
            icon={<Sparkles className="text-muted-foreground/60 size-4" />}
            label="Your role"
            value={a.role}
          />
        )}
        {a.venueName && (
          <Row
            icon={<MapPin className="text-muted-foreground/60 size-4" />}
            label="Venue"
            value={a.venueName}
          />
        )}
        <Row
          icon={<CalendarDays className="text-muted-foreground/60 size-4" />}
          label="Date"
          value={a.dateLabel}
        />
        <Row
          icon={<Clock className="text-muted-foreground/60 size-4" />}
          label="Slot"
          value={a.slotLabel}
        />
        {a.arrivalTime && (
          <Row
            icon={<Clock className="text-muted-foreground/60 size-4" />}
            label="Arrival"
            value={a.arrivalTime}
          />
        )}
      </div>

      {a.actionable ? (
        <VendorConfirm token={a.token} />
      ) : (
        <p className="text-muted-foreground text-center text-sm">
          This request has already been answered.
        </p>
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
