"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, ChevronLeft } from "lucide-react";
import { createPublicHold, getPublicAvailabilityMonth } from "@/actions/public-hold.actions";
import { getGuestPeakDates } from "@/actions/guest-public.actions";
import { PrimaryButton, KeyValue } from "../../../_components/ui";
import { formatPrice, inr, toISODateLocal, SLOT_SHORT } from "../../../_components/format";

// ============================================================
// Four-step reserve flow (the design's "stepper" variant):
//   0 occasion → 1 date + slot → 2 guests + hall → 3 review + hold.
// Availability is the public month feed; the hold itself is the existing
// createPublicHold (token invoice + Razorpay), so an app hold and a website
// hold are the same object to the team.
// ============================================================

const OCCASIONS = ["Wedding", "Reception", "Engagement", "Sangeet", "Birthday Party", "Corporate Event"];
const SLOTS = ["MORNING", "AFTERNOON", "EVENING", "FULL_DAY"] as const;
type Slot = (typeof SLOTS)[number];

interface VenueLite { id: string; name: string; capacity: number; pricePerSlot: number }
interface Terms { tokenAmount: number; holdHours: number; currency: string }

export function ReserveStepper({ venues, terms, initial, prefill }: {
  venues: VenueLite[]; terms: Terms;
  initial: { venueId: string; occasion: string; date: string };
  prefill: { name: string; email: string };
}) {
  const router = useRouter();
  const today = React.useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const startVenue = venues.find((v) => v.id === initial.venueId) ?? venues[0];
  const [step, setStep] = React.useState(initial.date ? 1 : initial.occasion ? 1 : 0);
  const [occasion, setOccasion] = React.useState(initial.occasion || "Wedding");
  const [dateISO, setDateISO] = React.useState<string | null>(initial.date || null);
  const [slot, setSlot] = React.useState<Slot>("EVENING");
  const [guests, setGuests] = React.useState(200);
  const [venueId, setVenueId] = React.useState(startVenue?.id ?? "");
  const [name, setName] = React.useState(prefill.name);
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState(prefill.email);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dayState, setDayState] = React.useState<Record<string, "busy" | "full">>({});
  const [peak, setPeak] = React.useState<Record<string, string>>({});

  const venue = venues.find((v) => v.id === venueId) ?? startVenue;

  // 14-day strip starting tomorrow; spans at most two months.
  const days = React.useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + 1 + i); return d; }), [today]);

  React.useEffect(() => {
    if (!venueId) return;
    let alive = true;
    const months = [...new Set(days.map((d) => `${d.getFullYear()}-${d.getMonth() + 1}`))].map((k) => k.split("-").map(Number));
    Promise.all([
      Promise.all(months.map(([y, m]) => getPublicAvailabilityMonth(y, m, venueId))),
      getGuestPeakDates(toISODateLocal(days[0]), toISODateLocal(days[13]), venueId),
    ]).then(([monthRes, peaks]) => {
      if (!alive) return;
      const st: Record<string, "busy" | "full"> = {};
      monthRes.forEach((res, idx) => {
        if (!res.success) return;
        const [y, m] = months[idx];
        const row = res.data.rows.find((r) => r.venueId === venueId) ?? res.data.rows[0];
        for (const d of row?.days ?? []) {
          const iso = `${y}-${String(m).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
          if (d.full) st[iso] = "full"; else if (d.busy) st[iso] = "busy";
        }
      });
      setDayState(st);
      setPeak(Object.fromEntries(peaks.map((p) => [p.dateISO, p.label])));
    });
    return () => { alive = false; };
  }, [venueId, days]);

  async function hold() {
    if (!venue || !dateISO) return;
    setBusy(true); setError(null);
    const res = await createPublicHold({
      venueId: venue.id, dateISO, timeSlot: slot, eventType: occasion, guestCount: guests,
      customerName: name.trim(), customerPhone: phone.trim(), customerEmail: email.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) return setError(res.error);
    router.push(`/app/book/held/${res.data.token}`);
  }

  const back = () => (step > 0 ? setStep(step - 1) : router.push("/app"));
  const dateLabel = dateISO ? new Date(dateISO + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—";
  const field = "w-full rounded-xl border border-black/[.08] bg-white px-3.5 py-3 text-copy text-[#1d1d1f] placeholder:text-[#8a8a8e] focus:border-[#6d1b52] focus:outline-none focus:ring-2 focus:ring-[#6d1b52]/15";
  const h2 = "font-editorial text-[26px] font-semibold leading-[1.15] tracking-[-.015em]";

  return (
    <div className="vg-rise flex flex-col gap-5 px-5 pt-[calc(var(--sat)+0.5rem)]">
      <div className="flex items-center gap-3">
        <button type="button" onClick={back} aria-label={step === 0 ? "Back to home" : "Previous step"} className="flex size-10 shrink-0 items-center justify-center rounded-full border border-black/[.08] bg-white text-[#1d1d1f]"><ChevronLeft className="size-5" /></button>
        <div className="flex-1 text-copy font-semibold">Reserve a date</div>
        <div className="flex gap-1.5" aria-label={`Step ${step + 1} of 4`}>{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-[22px]" : "w-1.5"} ${i <= step ? "bg-[#6d1b52]" : "bg-black/[.12]"}`} />)}</div>
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-3">
          <h2 className={h2}>What are we celebrating?</h2>
          <div className="grid grid-cols-3 gap-2">
            {OCCASIONS.map((o) => (
              <button key={o} type="button" onClick={() => { setOccasion(o); setStep(1); }}
                className={`min-h-14 rounded-[14px] border-[1.5px] px-2 py-3.5 text-detail font-semibold ${occasion === o ? "border-[#6d1b52] bg-[#f7eef2] text-[#6d1b52]" : "border-black/[.08] bg-white text-[#1d1d1f]"}`}>
                {o.replace(" Party", "").replace(" Event", "")}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-3">
          <h2 className={h2}>Pick your date</h2>
          <p className="-mt-1.5 text-detail text-[#6e6e73]">Greyed dates are fully booked. Gold dots mark auspicious muhurtham dates{venue ? ` at ${venue.name}` : ""}.</p>
          <div className="vg-scroll-x vg-bleed py-0.5">
            {days.map((d) => {
              const iso = toISODateLocal(d); const st = dayState[iso]; const taken = st === "full"; const sel = dateISO === iso; const gold = !!peak[iso];
              return (
                <button key={iso} type="button" disabled={taken} onClick={() => setDateISO(iso)} title={peak[iso]}
                  className={`relative flex w-[58px] shrink-0 flex-col items-center gap-[3px] rounded-[14px] border-[1.5px] py-2.5 ${sel ? "border-[#6d1b52] bg-[#6d1b52] text-[#fdf5f3]" : "border-black/[.08] bg-white text-[#1d1d1f]"} ${taken ? "opacity-35" : ""}`}>
                  <span className="text-[10.5px] font-semibold uppercase tracking-[.06em]">{d.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                  <span className="numeric text-[19px] font-semibold leading-none">{d.getDate()}</span>
                  <span className="text-[10px]">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                  {gold && !taken && <span className={`mt-px size-[5px] rounded-full ${sel ? "bg-[#e8b631]" : "bg-[#b88513]"}`} />}
                  {st === "busy" && !sel && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#c77700]" title="Some slots taken" />}
                </button>
              );
            })}
          </div>
          {dateISO && peak[dateISO] && <p className="text-detail text-[#b88513]">✦ {peak[dateISO]}</p>}
          <div className="mt-1 text-detail font-semibold">Slot</div>
          <div className="grid grid-cols-4 gap-[3px] rounded-xl bg-[#e9e9ec] p-[3px]">
            {SLOTS.map((s) => (
              <button key={s} type="button" onClick={() => setSlot(s)} className={`rounded-[10px] px-1 py-2.5 text-detail font-semibold ${slot === s ? "bg-white text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,.12)]" : "text-[#6e6e73]"}`}>
                <div>{SLOT_SHORT[s].label}</div><div className="mt-0.5 text-[10px] font-medium opacity-70">{SLOT_SHORT[s].time}</div>
              </button>
            ))}
          </div>
          <PrimaryButton className="mt-1.5" disabled={!dateISO} onClick={() => setStep(2)}>Continue</PrimaryButton>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <h2 className={h2}>How many guests?</h2>
          <div className="vg-card flex items-center justify-between rounded-2xl px-3 py-2.5">
            <button type="button" aria-label="Fewer guests" onClick={() => setGuests((g) => Math.max(20, g - 20))} className="flex size-11 items-center justify-center rounded-xl border border-black/[.08] bg-[#f3f0ec]"><Minus className="size-5" /></button>
            <div className="text-center"><div className="numeric text-[30px] font-semibold leading-none tracking-[-.02em]">{guests}</div><div className="mt-1 text-meta text-[#6e6e73]">approx. guests</div></div>
            <button type="button" aria-label="More guests" onClick={() => setGuests((g) => Math.min(5000, g + 20))} className="flex size-11 items-center justify-center rounded-xl border border-black/[.08] bg-[#f3f0ec]"><Plus className="size-5" /></button>
          </div>
          <div className="mt-1 text-detail font-semibold">Hall</div>
          <div className="flex flex-col gap-2">
            {venues.map((v) => {
              const sel = v.id === venueId; const fits = v.capacity >= guests;
              return (
                <button key={v.id} type="button" onClick={() => setVenueId(v.id)} className={`flex w-full items-center gap-3 rounded-[14px] border-[1.5px] bg-white p-3 text-left ${sel ? "border-[#6d1b52]" : "border-black/[.06]"}`}>
                  <span className={`flex size-5 items-center justify-center rounded-full border-[1.5px] ${sel ? "border-[#6d1b52]" : "border-black/20"}`}>{sel && <span className="size-2.5 rounded-full bg-[#6d1b52]" />}</span>
                  <span className="min-w-0 flex-1"><span className="block text-body font-semibold">{v.name}</span><span className={`block text-meta ${fits ? "text-[#2a9d4a]" : "text-[#ff3b30]"}`}>Up to {v.capacity.toLocaleString("en-IN")} guests · {fits ? "fits" : "too small"}</span></span>
                  <span className="numeric text-detail font-semibold text-[#6d1b52]">{formatPrice(v.pricePerSlot)}</span>
                </button>
              );
            })}
          </div>
          <PrimaryButton className="mt-1.5" disabled={!venue} onClick={() => setStep(3)}>Review</PrimaryButton>
        </div>
      )}

      {step === 3 && venue && (
        <div className="flex flex-col gap-3">
          <h2 className={h2}>Hold your date</h2>
          <KeyValue
            rows={[
              { k: "Occasion", v: occasion },
              { k: "Date", v: dateLabel },
              { k: "Slot", v: `${SLOT_SHORT[slot].label} · ${SLOT_SHORT[slot].time}` },
              { k: "Hall", v: `${venue.name} · ${guests} guests` },
            ]}
            total={{ k: "Hall rental from", v: `${formatPrice(venue.pricePerSlot)} / slot` }}
          />
          <div className="vg-gold-note flex items-start gap-3.5 rounded-2xl p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#faf3e1]"><span className="size-3 rounded-full bg-[#b88513]" /></span>
            <div>
              <div className="text-body font-semibold">{inr(terms.tokenAmount)} refundable hold</div>
              <div className="mt-0.5 text-detail leading-[1.5] text-[#6e6e73]">Locks the date for {terms.holdHours} hours while our team confirms details and prepares your quotation. Refunded in full if you don&apos;t proceed.</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            <input className={field} placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
            <input className={field} type="tel" inputMode="tel" autoComplete="tel" placeholder="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <input className={field} type="email" autoComplete="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="rounded-xl bg-[#ff3b30]/10 px-3 py-2 text-detail text-[#b3261e]">{error}</p>}
          <PrimaryButton className="mt-1" disabled={busy || name.trim().length < 2 || phone.replace(/\D/g, "").length < 7} onClick={hold}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : `Pay ${inr(terms.tokenAmount)} and hold date`}
          </PrimaryButton>
          <p className="text-center text-meta leading-[1.5] text-[#8a8a8e]">Secured by Razorpay · UPI, cards and net banking</p>
          <Link href={`/app/book/enquire?venueId=${venue.id}&occasion=${encodeURIComponent(occasion)}`} className="text-center text-detail font-semibold text-[#6d1b52]">Prefer a callback first? Request one instead</Link>
        </div>
      )}
    </div>
  );
}
