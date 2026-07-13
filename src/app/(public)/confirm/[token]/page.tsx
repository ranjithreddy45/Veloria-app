import type { Metadata } from "next";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  Users,
  UtensilsCrossed,
  Palette,
  Music4,
  LayoutGrid,
  UserCog,
  StickyNote,
  Package,
  ShieldCheck,
} from "lucide-react";
import { getGuestConfirmationByToken } from "@/actions/guest-confirm.actions";
import { GuestConfirmForm } from "./_components/guest-confirm-form";

// ============================================================
// PUBLIC (no auth) — guest service-confirmation + declaration page. Tokenized
// access only; the unguessable Booking.guestConfirmationToken is the sole access
// control. Shows the guest their own event summary + BEO services + booking T&C,
// then a declaration form that stamps acceptance. Mirrors vendor-confirm/[token].
// ============================================================

export const metadata: Metadata = {
  title: "Confirm your event — Veloria Grand",
  robots: { index: false, follow: false }, // tokenized page; keep out of search
};

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return dateFmt.format(date);
}

type PkgSnapshot = {
  vendorName?: string;
  name?: string;
  category?: string;
  sections?: {
    title?: string;
    items?: { name?: string; chosen?: string[] }[];
  }[];
};

export default async function GuestConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getGuestConfirmationByToken(token);

  if (!data) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          This link is invalid or has expired
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Please contact your event manager for a fresh confirmation link.
        </p>
      </div>
    );
  }

  const alreadyConfirmed = !!data.guestConfirmedAt;
  const services = data.services;

  const noteRows: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (services) {
    const push = (icon: React.ReactNode, label: string, value?: string | null) => {
      if (value && value.trim()) noteRows.push({ icon, label, value: value.trim() });
    };
    push(<UtensilsCrossed className="size-4 text-violet-600" />, "Menu", services.menuNotes);
    push(<Palette className="size-4 text-violet-600" />, "Décor", services.decorNotes);
    push(<Music4 className="size-4 text-violet-600" />, "Audio / Visual", services.avNotes);
    push(<LayoutGrid className="size-4 text-violet-600" />, "Floor plan", services.floorPlanNotes);
    push(<UserCog className="size-4 text-violet-600" />, "Staffing", services.staffingNotes);
    push(
      <StickyNote className="size-4 text-violet-600" />,
      "Special instructions",
      services.specialInstructions,
    );
  }

  const packages: PkgSnapshot[] = Array.isArray(services?.packageSnapshotJson)
    ? (services!.packageSnapshotJson as PkgSnapshot[])
    : [];

  const terms = Array.isArray(data.terms) ? data.terms : [];

  const contactName = [data.contact?.firstName, data.contact?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <div className="space-y-5">
      <header className="text-center">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {alreadyConfirmed ? "Your event is confirmed" : "Confirm your event"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {contactName ? `Hi ${contactName} 👋` : "Welcome 👋"}
        </p>
      </header>

      {/* Event summary */}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {data.eventName || data.eventType || "Your event"}
          </h2>
          <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {data.bookingNumber}
          </span>
        </div>
        <div className="space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <Row
            icon={<CalendarDays className="size-4 text-violet-600" />}
            label="Date"
            value={fmtDate(data.date)}
          />
          {data.timeSlot && (
            <Row
              icon={<Clock className="size-4 text-violet-600" />}
              label="Time slot"
              value={data.timeSlot}
            />
          )}
          {data.venue?.name && (
            <Row
              icon={<MapPin className="size-4 text-violet-600" />}
              label="Venue"
              value={data.venue.name}
            />
          )}
          {typeof data.guestCount === "number" && data.guestCount > 0 && (
            <Row
              icon={<Users className="size-4 text-violet-600" />}
              label="Guest count"
              value={String(data.guestCount)}
            />
          )}
        </div>
      </div>

      {/* Your services */}
      {(noteRows.length > 0 || packages.length > 0) && (
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-600" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Your services
            </h2>
          </div>

          {noteRows.length > 0 && (
            <div className="space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              {noteRows.map((r) => (
                <div key={r.label} className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {r.icon}
                    {r.label}
                  </span>
                  <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                    {r.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {packages.length > 0 && (
            <div className="space-y-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              {packages.map((pkg, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
                >
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-violet-600" />
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {[pkg.vendorName, pkg.name].filter(Boolean).join(" — ") ||
                        "Package"}
                    </p>
                  </div>
                  {Array.isArray(pkg.sections) && pkg.sections.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {pkg.sections.map((s, si) => (
                        <div key={si}>
                          {s.title && (
                            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                              {s.title}
                            </p>
                          )}
                          {Array.isArray(s.items) && s.items.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {s.items.map((it, ii) => (
                                <li
                                  key={ii}
                                  className="text-sm text-zinc-700 dark:text-zinc-300"
                                >
                                  {it.name}
                                  {Array.isArray(it.chosen) && it.chosen.length > 0 && (
                                    <span className="text-zinc-500">
                                      {" "}
                                      — {it.chosen.join(", ")}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Terms & Conditions */}
      {terms.length > 0 && (
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-violet-600" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Terms &amp; Conditions
            </h2>
          </div>
          <div className="space-y-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            {terms.map((section, i) => {
              const heading =
                (section as { title?: string; heading?: string }).title ??
                (section as { heading?: string }).heading ??
                "";
              const points =
                (section as { items?: string[]; points?: string[] }).items ??
                (section as { points?: string[] }).points ??
                [];
              const icon = (section as { icon?: string }).icon;
              return (
                <div key={i}>
                  {heading && (
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {icon ? `${icon} ` : ""}
                      {heading}
                    </p>
                  )}
                  {points.length > 0 && (
                    <ul className="mt-1.5 list-disc space-y-1 pl-5">
                      {points.map((p, pi) => (
                        <li
                          key={pi}
                          className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
                        >
                          {p}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          {data.termsVersion && (
            <p className="text-right text-xs text-zinc-400">
              Terms version {data.termsVersion}
            </p>
          )}
        </div>
      )}

      {alreadyConfirmed ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
          <CheckCircle2 className="size-7 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Confirmed on {fmtDate(data.guestConfirmedAt)}
            {data.guestConfirmedName ? ` by ${data.guestConfirmedName}` : ""}.
          </p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
            Thank you — your event services and terms are locked in. See you soon!
          </p>
        </div>
      ) : (
        <GuestConfirmForm token={token} dueAt={data.guestConfirmationDueAt ?? null} />
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
    <div className="flex items-start justify-between gap-3">
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
