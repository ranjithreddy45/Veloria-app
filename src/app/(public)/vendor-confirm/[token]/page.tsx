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
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          We couldn&apos;t find this request
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          The link may have expired or is no longer valid.
        </p>
      </div>
    );
  }

  const a = res.data;

  return (
    <div className="space-y-5">
      <header className="text-center">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {a.status === "CONFIRMED"
            ? "You're confirmed"
            : a.status === "DECLINED"
              ? "Request declined"
              : "Confirm your booking"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Hi {a.vendorName} 👋</p>
      </header>

      {a.status === "CONFIRMED" && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="size-7 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Thank you — we&apos;ve recorded your confirmation. See you there!
          </p>
        </div>
      )}

      {a.status === "DECLINED" && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center dark:border-rose-900 dark:bg-rose-950/30">
          <XCircle className="size-7 text-rose-600" />
          <p className="text-sm font-medium text-rose-800 dark:text-rose-300">
            You&apos;ve declined this request. Our team has been notified.
          </p>
        </div>
      )}

      {/* Summary card — vendor's own details only */}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <Row
          icon={<Sparkles className="size-4 text-violet-600" />}
          label="Event"
          value={a.eventName}
        />
        {a.role && (
          <Row
            icon={<Sparkles className="size-4 text-violet-600" />}
            label="Your role"
            value={a.role}
          />
        )}
        {a.venueName && (
          <Row
            icon={<MapPin className="size-4 text-violet-600" />}
            label="Venue"
            value={a.venueName}
          />
        )}
        <Row
          icon={<CalendarDays className="size-4 text-violet-600" />}
          label="Date"
          value={a.dateLabel}
        />
        <Row
          icon={<Clock className="size-4 text-violet-600" />}
          label="Slot"
          value={a.slotLabel}
        />
        {a.arrivalTime && (
          <Row
            icon={<Clock className="size-4 text-violet-600" />}
            label="Arrival"
            value={a.arrivalTime}
          />
        )}
      </div>

      {a.actionable ? (
        <VendorConfirm token={a.token} />
      ) : (
        <p className="text-center text-sm text-zinc-500">
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
      <span className="flex items-center gap-2 text-sm text-zinc-500">
        {icon}
        {label}
      </span>
      <span className="text-right text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </span>
    </div>
  );
}
