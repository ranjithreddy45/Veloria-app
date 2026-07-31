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
      <div className="bg-card shadow-card rounded-2xl border p-10 text-center">
        <h1 className="text-foreground text-[24px]">
          This link is no longer active
        </h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
          Your event manager can send you a fresh confirmation link in a moment
          — just reach out.
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
    push(<UtensilsCrossed className="text-muted-foreground/60 size-4" />, "Menu", services.menuNotes);
    push(<Palette className="text-muted-foreground/60 size-4" />, "Décor", services.decorNotes);
    push(<Music4 className="text-muted-foreground/60 size-4" />, "Audio / Visual", services.avNotes);
    push(<LayoutGrid className="text-muted-foreground/60 size-4" />, "Floor plan", services.floorPlanNotes);
    push(<UserCog className="text-muted-foreground/60 size-4" />, "Staffing", services.staffingNotes);
    push(
      <StickyNote className="text-muted-foreground/60 size-4" />,
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
    <div className="space-y-6">
      <header className="pb-2 text-center">
        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.18em]">
          {contactName ? `For ${contactName}` : "Your celebration"}
        </p>
        <h1 className="text-foreground mt-3 text-[30px] sm:text-[36px]">
          {alreadyConfirmed ? "Your event is confirmed" : "Confirm your event"}
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-[15px] leading-relaxed">
          {alreadyConfirmed
            ? "Everything below is locked in. We can't wait to host you."
            : "Please take a moment to review the details below, then confirm — so we can begin preparing your day."}
        </p>
      </header>

      {/* Event summary */}
      <div className="bg-card shadow-card space-y-4 rounded-2xl border p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-editorial text-foreground text-[20px] font-semibold">
            {data.eventName || data.eventType || "Your event"}
          </h2>
          <span className="bg-muted text-muted-foreground numeric shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium">
            {data.bookingNumber}
          </span>
        </div>
        <div className="space-y-3 border-t pt-4">
          <Row
            icon={<CalendarDays className="text-muted-foreground/60 size-4" />}
            label="Date"
            value={fmtDate(data.date)}
          />
          {data.timeSlot && (
            <Row
              icon={<Clock className="text-muted-foreground/60 size-4" />}
              label="Time slot"
              value={data.timeSlot}
            />
          )}
          {data.venue?.name && (
            <Row
              icon={<MapPin className="text-muted-foreground/60 size-4" />}
              label="Venue"
              value={data.venue.name}
            />
          )}
          {typeof data.guestCount === "number" && data.guestCount > 0 && (
            <Row
              icon={<Users className="text-muted-foreground/60 size-4" />}
              label="Guest count"
              value={String(data.guestCount)}
            />
          )}
        </div>
      </div>

      {/* Your services */}
      {(noteRows.length > 0 || packages.length > 0) && (
        <div className="bg-card shadow-card space-y-5 rounded-2xl border p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="text-muted-foreground/60 size-4" />
            <h2 className="font-editorial text-foreground text-[20px] font-semibold">
              Your services
            </h2>
          </div>

          {noteRows.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              {noteRows.map((r) => (
                <div key={r.label} className="flex flex-col gap-1.5">
                  <span className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                    {r.icon}
                    {r.label}
                  </span>
                  <p className="text-foreground/90 whitespace-pre-wrap text-sm leading-relaxed">
                    {r.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {packages.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              {packages.map((pkg, i) => (
                <div key={i} className="bg-muted/40 rounded-xl border p-4">
                  <div className="flex items-center gap-2">
                    <Package className="text-muted-foreground/60 size-4" />
                    <p className="text-foreground text-sm font-semibold">
                      {[pkg.vendorName, pkg.name].filter(Boolean).join(" — ") ||
                        "Package"}
                    </p>
                  </div>
                  {Array.isArray(pkg.sections) && pkg.sections.length > 0 && (
                    <div className="mt-3 space-y-3">
                      {pkg.sections.map((s, si) => (
                        <div key={si}>
                          {s.title && (
                            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.12em]">
                              {s.title}
                            </p>
                          )}
                          {Array.isArray(s.items) && s.items.length > 0 && (
                            <ul className="mt-1.5 space-y-1">
                              {s.items.map((it, ii) => (
                                <li
                                  key={ii}
                                  className="text-foreground/85 flex gap-2 text-sm leading-relaxed"
                                >
                                  <span
                                    aria-hidden
                                    className="bg-muted-foreground/40 mt-[9px] size-1 shrink-0 rounded-full"
                                  />
                                  <span>
                                    {it.name}
                                    {Array.isArray(it.chosen) &&
                                      it.chosen.length > 0 && (
                                        <span className="text-muted-foreground">
                                          {" "}
                                          — {it.chosen.join(", ")}
                                        </span>
                                      )}
                                  </span>
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
        <div className="bg-card shadow-card space-y-5 rounded-2xl border p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-muted-foreground/60 size-4" />
            <h2 className="font-editorial text-foreground text-[20px] font-semibold">
              Terms &amp; Conditions
            </h2>
          </div>
          <div className="space-y-5 border-t pt-4">
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
                    <p className="text-foreground text-sm font-semibold">
                      {icon ? `${icon} ` : ""}
                      {heading}
                    </p>
                  )}
                  {points.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1.5 pl-5">
                      {points.map((p, pi) => (
                        <li
                          key={pi}
                          className="text-muted-foreground text-sm leading-relaxed"
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
            <p className="text-muted-foreground/60 numeric text-right text-[11px]">
              Terms version {data.termsVersion}
            </p>
          )}
        </div>
      )}

      {alreadyConfirmed ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-success/25 bg-success/[0.07] p-8 text-center">
          <CheckCircle2 className="size-8 text-success" />
          <p className="font-editorial mt-1 text-[19px] font-semibold text-success">
            Thank you — everything is set
          </p>
          <p className="text-sm text-success/85">
            Confirmed on {fmtDate(data.guestConfirmedAt)}
            {data.guestConfirmedName ? ` by ${data.guestConfirmedName}` : ""}.
          </p>
          <p className="text-xs text-success/75">
            Your services and terms are locked in. We look forward to hosting
            you.
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
