"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Check, Loader2, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getVisitAvailability,
  submitVisitBooking,
  type PublicVisitVenue,
  type VisitKindOption,
} from "@/actions/public-site-visit.actions";
import type { VisitSlotOption } from "@/lib/site-visit/slots";

// ============================================================
// PUBLIC client — visit/tasting booking wizard.
// Kind toggle → venue → date → slot → details → submit. Captures utm_* from
// the URL. On success routes to /visit/{token}. No internal data ever touched.
// ============================================================

interface Props {
  venues: PublicVisitVenue[];
  kinds: VisitKindOption[];
}

function todayISO(): string {
  // IST "today" (Asia/Kolkata) so the picker's first day matches the catalog.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

function maxISO(): string {
  const d = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function VisitScheduler({ venues, kinds }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [kind, setKind] = useState(kinds[0]?.kind ?? "SITE_VISIT");
  const [venueId, setVenueId] = useState<string>(venues[0]?.id ?? "");
  const [dateISO, setDateISO] = useState<string>(todayISO());
  const [slots, setSlots] = useState<VisitSlotOption[]>([]);
  const [slotIso, setSlotIso] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [eventType, setEventType] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [notes, setNotes] = useState("");

  const utm = useMemo(
    () => ({
      utmSource: searchParams.get("utm_source") || "",
      utmMedium: searchParams.get("utm_medium") || "",
      utmCampaign: searchParams.get("utm_campaign") || "",
    }),
    [searchParams]
  );

  // Load slots whenever the date changes.
  useEffect(() => {
    if (!dateISO) return;
    let active = true;
    setLoadingSlots(true);
    setSlotIso("");
    getVisitAvailability(dateISO)
      .then((res) => {
        if (!active) return;
        if (res.success) setSlots(res.data);
        else setSlots([]);
      })
      .finally(() => active && setLoadingSlots(false));
    return () => {
      active = false;
    };
  }, [dateISO]);

  const canSubmit =
    !!slotIso && name.trim().length >= 2 && phone.replace(/\D/g, "").length >= 7;

  function handleSubmit() {
    if (!canSubmit) {
      toast.error("Please pick a time and enter your name and phone.");
      return;
    }
    startTransition(async () => {
      const res = await submitVisitBooking({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        kind,
        scheduledAt: slotIso,
        venueId: venueId || undefined,
        eventType: eventType.trim() || undefined,
        guestCount: guestCount ? Number(guestCount) : undefined,
        notes: notes.trim() || undefined,
        utmSource: utm.utmSource || undefined,
        utmMedium: utm.utmMedium || undefined,
        utmCampaign: utm.utmCampaign || undefined,
      });
      if (res.success) {
        toast.success("Visit booked! Redirecting…");
        router.push(`/visit/${res.data.token}`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Kind toggle */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {kinds.map((k) => {
          const active = k.kind === kind;
          return (
            <button
              key={k.kind}
              type="button"
              onClick={() => setKind(k.kind)}
              className={`rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500 dark:border-violet-500 dark:bg-violet-950/30"
                  : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <Sparkles className="size-4 text-violet-600" />
                  {k.label}
                </span>
                {active && <Check className="size-4 text-violet-600" />}
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{k.tagline}</p>
            </button>
          );
        })}
      </div>

      {/* Venue + date */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {venues.length > 0 && (
          <Field label="Venue" icon={<MapPin className="size-3.5" />}>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">Any venue</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Date" icon={<CalendarDays className="size-3.5" />}>
          <input
            type="date"
            value={dateISO}
            min={todayISO()}
            max={maxISO()}
            onChange={(e) => setDateISO(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </Field>
      </div>

      {/* Slots */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Choose a time
        </p>
        {loadingSlots ? (
          <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
            <Loader2 className="size-4 animate-spin" /> Loading times…
          </div>
        ) : slots.length === 0 ? (
          <p className="py-3 text-sm text-zinc-500">
            No times available on this date — please pick another day.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => {
              const active = s.iso === slotIso;
              return (
                <button
                  key={s.time}
                  type="button"
                  disabled={!s.available}
                  onClick={() => setSlotIso(s.iso)}
                  className={`rounded-xl border px-2 py-2 text-sm font-medium transition ${
                    active
                      ? "border-violet-500 bg-violet-600 text-white"
                      : s.available
                        ? "border-zinc-200 bg-white text-zinc-700 hover:border-violet-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                        : "cursor-not-allowed border-zinc-100 bg-zinc-50 text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-700"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Your name *">
            <TextInput value={name} onChange={setName} placeholder="Full name" />
          </Field>
          <Field label="Phone *">
            <TextInput value={phone} onChange={setPhone} placeholder="+91 …" type="tel" />
          </Field>
          <Field label="Email">
            <TextInput value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
          </Field>
          <Field label="Event type">
            <TextInput value={eventType} onChange={setEventType} placeholder="Wedding, Reception…" />
          </Field>
          <Field label="Guest count">
            <TextInput value={guestCount} onChange={setGuestCount} placeholder="e.g. 350" type="number" />
          </Field>
        </div>
        <Field label="Anything we should know?">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Preferences, accessibility needs, questions…"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </Field>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || pending}
        className="w-full bg-violet-600 py-6 text-base hover:bg-violet-700"
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" /> Booking…
          </>
        ) : (
          "Book my visit"
        )}
      </Button>
      <p className="text-center text-xs text-zinc-400">
        No payment needed. We&apos;ll confirm your slot by WhatsApp.
      </p>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
    />
  );
}
