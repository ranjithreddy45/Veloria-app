"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, CalendarDays, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getPublicAvailabilityMonth,
  getPublicAvailabilityGrid,
  createPublicHold,
  releasePublicHold,
  type PublicVenueMonth,
  type PublicVenueDay,
} from "@/actions/public-hold.actions";

// ============================================================
// PUBLIC availability + hold widget (no auth).
// Venue picker → month heatmap → day slot grid (FREE/BUSY only) →
// on a FREE slot, reveal the hold form → createPublicHold → /hold/<token>.
// ============================================================

interface VenueLite {
  id: string;
  name: string;
  capacity: number;
}

const SLOT_KEYS = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"] as const;
type SlotKey = (typeof SLOT_KEYS)[number];

const SLOT_LABEL: Record<SlotKey, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon (11am–3pm)",
  EVENING: "Evening (5pm–10pm)",
  FULL_DAY: "Full Day",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function todayParts() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export function AvailabilityCalendar({ venues }: { venues: VenueLite[] }) {
  const router = useRouter();
  const { year: ty, month: tm, day: td } = todayParts();

  const [venueId, setVenueId] = useState<string>(venues[0]?.id ?? "");
  const [year, setYear] = useState(ty);
  const [month, setMonth] = useState(tm); // 1-based

  const [monthRows, setMonthRows] = useState<PublicVenueMonth[]>([]);
  const [monthDays, setMonthDays] = useState(0);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayRows, setDayRows] = useState<PublicVenueDay[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<SlotKey | null>(null);

  // UTM passthrough from the public landing URL.
  const [utm, setUtm] = useState<{ source?: string; medium?: string; campaign?: string }>({});
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setUtm({
      source: sp.get("utm_source") || undefined,
      medium: sp.get("utm_medium") || undefined,
      campaign: sp.get("utm_campaign") || undefined,
    });
  }, []);

  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === venueId) ?? null,
    [venues, venueId]
  );

  const loadMonth = useCallback(async () => {
    if (!venueId) return;
    setLoadingMonth(true);
    setSelectedDay(null);
    setSelectedSlot(null);
    setDayRows([]);
    const res = await getPublicAvailabilityMonth(year, month, venueId);
    if (res.success) {
      setMonthRows(res.data.rows);
      setMonthDays(res.data.days);
    } else {
      setMonthRows([]);
      setMonthDays(0);
    }
    setLoadingMonth(false);
  }, [venueId, year, month]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  const venueMonth = monthRows.find((r) => r.venueId === venueId) ?? null;

  const dateISO = useMemo(
    () => (selectedDay ? `${year}-${pad(month)}-${pad(selectedDay)}` : null),
    [selectedDay, year, month]
  );

  const loadDay = useCallback(
    async (day: number) => {
      if (!venueId) return;
      setSelectedDay(day);
      setSelectedSlot(null);
      setLoadingDay(true);
      const iso = `${year}-${pad(month)}-${pad(day)}`;
      const res = await getPublicAvailabilityGrid(iso, venueId);
      setDayRows(res.success ? res.data : []);
      setLoadingDay(false);
    },
    [venueId, year, month]
  );

  const prevMonth = () => {
    if (year === ty && month === tm) return; // don't go before current month
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const isPastDay = (day: number) =>
    year < ty ||
    (year === ty && month < tm) ||
    (year === ty && month === tm && day < td);

  const dayState = (day: number): "free" | "busy" | "full" | "past" => {
    if (isPastDay(day)) return "past";
    const d = venueMonth?.days.find((x) => x.day === day);
    if (!d) return "free";
    if (d.full) return "full";
    if (d.busy) return "busy";
    return "free";
  };

  const venueDay = dayRows.find((r) => r.venueId === venueId) ?? null;

  // Leading blanks so the 1st lands on the right weekday.
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  return (
    <div className="space-y-5">
      {/* Venue picker */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <Label className="mb-2 block text-xs font-medium text-zinc-500">Venue</Label>
        <div className="flex flex-wrap gap-2">
          {venues.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVenueId(v.id)}
              className={`rounded-xl border px-3 py-2 text-sm transition ${
                v.id === venueId
                  ? "border-violet-500 bg-violet-50 font-medium text-violet-700 dark:border-violet-400 dark:bg-violet-950/40 dark:text-violet-300"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              }`}
            >
              {v.name}
              <span className="ml-1 text-xs text-zinc-400">· up to {v.capacity}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Month heatmap */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            disabled={year === ty && month === tm}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {MONTHS[month - 1]} {year}
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Next month"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {loadingMonth ? (
          <div className="flex h-48 items-center justify-center text-zinc-400">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-zinc-400">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {Array.from({ length: monthDays }).map((_, i) => {
                const day = i + 1;
                const st = dayState(day);
                const selected = selectedDay === day;
                const disabled = st === "past" || st === "full";
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={disabled}
                    onClick={() => loadDay(day)}
                    title={
                      st === "full"
                        ? "Fully booked"
                        : st === "busy"
                        ? "Some slots taken"
                        : st === "past"
                        ? "Past date"
                        : "Open"
                    }
                    className={`flex aspect-square items-center justify-center rounded-lg text-sm transition ${
                      selected
                        ? "bg-violet-600 font-semibold text-white"
                        : st === "free"
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : st === "busy"
                        ? "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300"
                        : "cursor-not-allowed bg-zinc-100 text-zinc-300 dark:bg-zinc-800 dark:text-zinc-600"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-zinc-500">
              <Legend className="bg-emerald-400" label="Open" />
              <Legend className="bg-amber-400" label="Some slots taken" />
              <Legend className="bg-zinc-300" label="Full / past" />
            </div>
          </>
        )}
      </div>

      {/* Day slot grid */}
      {selectedDay && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <CalendarDays className="size-4 text-violet-600" />
            {selectedVenue?.name} · {MONTHS[month - 1]} {selectedDay}, {year}
          </div>
          {loadingDay ? (
            <div className="flex h-20 items-center justify-center text-zinc-400">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(venueDay?.slots ?? []).map((s) => {
                const isFree = s.status === "FREE";
                const isSel = selectedSlot === s.slot;
                return (
                  <button
                    key={s.slot}
                    type="button"
                    disabled={!isFree}
                    onClick={() => setSelectedSlot(s.slot as SlotKey)}
                    className={`rounded-xl border px-3 py-3 text-center text-sm transition ${
                      isSel
                        ? "border-violet-500 bg-violet-600 font-semibold text-white"
                        : isFree
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600"
                    }`}
                  >
                    <span className="block font-medium">{SLOT_LABEL[s.slot as SlotKey]}</span>
                    <span className="mt-0.5 block text-[11px] opacity-80">
                      {isFree ? "Available" : "Booked"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Hold form */}
      {selectedSlot && dateISO && venueId && (
        <HoldForm
          venueId={venueId}
          venueName={selectedVenue?.name ?? ""}
          dateISO={dateISO}
          dateLabel={`${MONTHS[month - 1]} ${selectedDay}, ${year}`}
          slot={selectedSlot}
          utm={utm}
          onTaken={() => {
            // Slot was grabbed by someone else — refresh the day grid.
            if (selectedDay) loadDay(selectedDay);
            setSelectedSlot(null);
          }}
          onSuccess={(token) => router.push(`/hold/${token}`)}
        />
      )}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block size-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function HoldForm({
  venueId,
  venueName,
  dateISO,
  dateLabel,
  slot,
  utm,
  onTaken,
  onSuccess,
}: {
  venueId: string;
  venueName: string;
  dateISO: string;
  dateLabel: string;
  slot: SlotKey;
  utm: { source?: string; medium?: string; campaign?: string };
  onTaken: () => void;
  onSuccess: (token: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [eventType, setEventType] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await createPublicHold({
        venueId,
        dateISO,
        timeSlot: slot,
        eventType: eventType.trim() || undefined,
        guestCount: Number(guestCount) || 1,
        customerName: name,
        customerPhone: phone,
        customerEmail: email.trim() || undefined,
        notes: notes.trim() || undefined,
        utmSource: utm.source,
        utmMedium: utm.medium,
        utmCampaign: utm.campaign,
      });
      if (res.success) {
        onSuccess(res.data.token);
      } else {
        setError(res.error);
        if (/just taken|already taken/i.test(res.error)) onTaken();
      }
    });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-5 shadow-sm dark:border-violet-900 dark:bg-violet-950/20"
    >
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-violet-600" />
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Hold {venueName} · {SLOT_LABEL[slot]}
          </p>
          <p className="text-xs text-zinc-500">{dateLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ph-name">Your name *</Label>
          <Input id="ph-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ph-phone">Phone *</Label>
          <Input id="ph-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number" inputMode="tel" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ph-email">Email</Label>
          <Input id="ph-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ph-guests">Guest count *</Label>
          <Input id="ph-guests" type="number" min={1} value={guestCount} onChange={(e) => setGuestCount(e.target.value)} placeholder="e.g. 250" required />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ph-occasion">Occasion</Label>
          <Input id="ph-occasion" value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="Wedding, Reception, Birthday…" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="ph-notes">Anything we should know?</Label>
          <Textarea id="ph-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="size-4" /> {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-11 w-full text-base">
        {pending ? <Loader2 className="mr-2 size-5 animate-spin" /> : null}
        {pending ? "Holding your date…" : "Hold this date"}
      </Button>
      <p className="text-center text-[11px] text-zinc-400">
        Next, you&apos;ll pay a small token to secure the slot. Your date is held while
        you complete payment.
      </p>
    </form>
  );
}

// ============================================================
// Hold-confirmation islands (used by /hold/[token]/page.tsx).
// ============================================================

export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const target = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (remaining <= 0) {
    return <span className="font-medium">This hold has expired — please refresh.</span>;
  }
  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return (
    <span>
      Date held — complete payment within{" "}
      <span className="font-semibold tabular-nums">
        {h > 0 ? `${h}h ` : ""}
        {pad(m)}m {pad(s)}s
      </span>
    </span>
  );
}

export function ReleaseLink({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const release = () => {
    setError("");
    startTransition(async () => {
      const res = await releasePublicHold(token);
      if (res.success) {
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={release}
        disabled={pending}
        className="text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-600 disabled:opacity-50 dark:hover:text-zinc-300"
      >
        {pending ? "Releasing…" : "Changed your mind? Release this hold"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
