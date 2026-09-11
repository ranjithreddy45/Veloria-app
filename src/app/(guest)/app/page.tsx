import Link from "next/link";
import { NavLink } from "../_components/nav-transition";
import { Bell, ChevronRight } from "lucide-react";
import { getStorefrontVenues } from "@/actions/storefront.actions";
import { getGuestPhotos, getGuestMostBookedVenueId, getGuestPeakDates } from "@/actions/guest-public.actions";
import { getGuestOverview } from "@/actions/guest-host.actions";
import { VenueImage } from "../_components/venue-image";
import { PrimaryButton, ProgressBar, Card, SectionTitle, Photo } from "../_components/ui";
import { formatPrice, inr, initials, fmtDate, toISODateLocal } from "../_components/format";

export const dynamic = "force-dynamic";

const OCCASIONS = ["Wedding", "Reception", "Engagement", "Sangeet", "Birthday Party", "Corporate Event"];

function greeting(name: string | null) {
  const h = new Date().getHours();
  const g = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return name ? `${g}, ${name.split(" ")[0]}` : g;
}

export default async function GuestHomePage() {
  const today = new Date();
  const in60 = new Date(today); in60.setDate(in60.getDate() + 60);
  const [venues, photos, mostBooked, peaks, ov] = await Promise.all([
    getStorefrontVenues(), getGuestPhotos({ limit: 12 }), getGuestMostBookedVenueId(), getGuestPeakDates(toISODateLocal(today), toISODateLocal(in60)), getGuestOverview(),
  ]);
  const hero = venues.find((v) => v.id === mostBooked) ?? [...venues].sort((a, b) => b.capacity - a.capacity)[0] ?? null;
  const heroPhoto = hero ? photos.find((p) => p.venueId === hero.id)?.url : undefined;
  const teaser = photos.slice(0, 3);
  const b = ov?.booking ?? null;

  return (
    <div className="vg-rise flex flex-col gap-[22px] px-5 pt-[calc(var(--sat)+0.75rem)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-detail text-[#6e6e73]">{greeting(ov?.user.name ?? null)}</div>
          <div className="mt-0.5 font-editorial text-[22px] font-semibold leading-[1.1] tracking-[-.01em]">Veloria Grand</div>
        </div>
        <div className="flex gap-2">
          <Link href={ov ? "/app/notifications" : "/app/welcome?next=%2Fapp%2Fnotifications"} aria-label="Notifications" className="relative flex size-10 items-center justify-center rounded-full border border-black/[.07] bg-white">
            <Bell className="size-5" strokeWidth={1.8} />
            {ov && ov.unread > 0 && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-[#e8b631] ring-2 ring-white" />}
          </Link>
          <Link href={ov ? "/app/account" : "/app/welcome"} aria-label="Account" className="flex size-10 items-center justify-center rounded-full bg-[#6d1b52] text-meta font-semibold text-[#fdf5f3] shadow-[0_0_0_1.5px_rgba(232,182,49,.6)]">
            {ov ? initials(ov.user.name) : "→"}
          </Link>
        </div>
      </div>

      {/* Editorial hero */}
      <h1 className="-mt-1.5 font-editorial text-[30px] font-medium leading-[1.1] tracking-[-.018em] [text-wrap:pretty]">Your celebration, arranged with care.</h1>
      {hero && (
        <NavLink href={`/app/venues/${hero.id}`} kind="push" className="relative block h-[360px] overflow-hidden rounded-[22px] shadow-[0_1px_2px_rgba(29,29,31,.06),0_28px_48px_-24px_rgba(109,27,82,.45)]">
          <VenueImage seed={hero.id} alt={hero.name} name={hero.name} src={heroPhoto} priority className="h-full w-full" />
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(29,29,31,0)_40%,rgba(29,29,31,.82)_100%)]" />
          {mostBooked === hero.id && <span className="absolute left-3.5 top-3.5 rounded-full bg-[#fdf5f3]/[.92] px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[.08em] text-[#6d1b52] backdrop-blur">Most booked</span>}
          <div className="absolute inset-x-0 bottom-0 p-[18px] text-white">
            <div className="font-editorial text-[26px] font-semibold tracking-[-.01em]">{hero.name}</div>
            <div className="mt-1 flex items-end justify-between"><span className="text-detail text-white/80">Up to {hero.capacity.toLocaleString("en-IN")} guests</span><span className="numeric text-copy font-semibold">from {formatPrice(hero.pricePerSlot)}</span></div>
          </div>
        </NavLink>
      )}
      <div className="vg-scroll-x vg-bleed -mt-1.5 pb-1">
        {OCCASIONS.map((o) => (
          <Link key={o} href={`/app/book?occasion=${encodeURIComponent(o)}`} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-black/[.08] bg-white px-4 py-2.5 text-detail font-medium">{o.replace(" Party", "").replace(" Event", "")}</Link>
        ))}
      </div>

      {/* Your event — only for a signed-in host with a booking */}
      {b && (
        <NavLink href="/app/event" kind="push" className="vg-hero vg-press block rounded-[22px] p-5 text-left">
          <div className="text-[10.5px] font-semibold uppercase tracking-[.12em] text-[#e8b631]">Your event</div>
          <div className="mt-1.5 font-editorial text-[24px] font-semibold tracking-[-.01em]">{b.eventName}</div>
          <div className="mt-1 text-detail text-[#fdf5f3]/75">{fmtDate(b.date)} · {b.venueName}</div>
          <div className="mt-[18px] flex items-end justify-between">
            <div><div className="numeric text-[42px] font-semibold leading-none tracking-[-.02em]">{Math.max(0, Math.round((new Date(b.date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000))}</div><div className="mt-1 text-meta text-[#fdf5f3]/75">days to go</div></div>
            {ov?.readiness != null && <div className="w-[130px] text-right"><div className="text-meta text-[#fdf5f3]/75">Readiness {ov.readiness}%</div><ProgressBar pct={ov.readiness} className="mt-1.5 h-1" track="bg-white/20" fill="bg-[#e8b631]" /></div>}
          </div>
        </NavLink>
      )}
      {ov?.nextTask && (
        <NavLink href="/app/event/checklist" kind="push" className="vg-card vg-press flex items-center gap-3.5 rounded-[18px] px-4 py-3.5">
          <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-[14px] bg-[#faf3e1]">
            {ov.nextTask.dueDate ? <><span className="text-[10px] font-bold tracking-[.06em] text-[#b88513]">{fmtDate(ov.nextTask.dueDate, { month: "short" }).toUpperCase()}</span><span className="numeric text-[19px] font-semibold leading-none">{new Date(ov.nextTask.dueDate).getDate()}</span></> : <span className="text-[10px] font-bold text-[#b88513]">NEXT</span>}
          </span>
          <span className="min-w-0 flex-1"><span className="block text-meta font-semibold uppercase tracking-[.08em] text-[#b88513]">Next up</span><span className="mt-0.5 block truncate text-body font-semibold">{ov.nextTask.title}</span><span className="block text-meta text-[#6e6e73]">{ov.openTasks} task{ov.openTasks === 1 ? "" : "s"} still open</span></span>
          <ChevronRight className="size-5 text-[#c7c7cc]" />
        </NavLink>
      )}

      {/* This season — only what is true */}
      <div>
        <SectionTitle title="This season" action={{ label: "All packages", href: "/app/packages" }} />
        <div className="vg-scroll-x vg-bleed mt-3 gap-2.5 pb-1.5">
          {peaks.length > 0 && (
            <Link href={hero ? `/app/venues/${hero.id}` : "/app/venues"} className="vg-hero flex min-h-[120px] w-[220px] shrink-0 flex-col justify-between rounded-[18px] p-4">
              <span className="text-[10.5px] font-bold uppercase tracking-[.1em] opacity-75">Auspicious dates</span>
              <span><span className="block font-editorial text-[19px] font-semibold leading-[1.15]">{peaks.length} muhurtham date{peaks.length === 1 ? "" : "s"} in the next 60 days</span><span className="mt-1 block text-meta opacity-80">Next: {fmtDate(peaks[0].dateISO + "T00:00:00")} · {peaks[0].label}</span></span>
            </Link>
          )}
          <Link href="/app/book" className="flex min-h-[120px] w-[220px] shrink-0 flex-col justify-between rounded-[18px] bg-gradient-to-br from-[#fff8e6] to-[#f3d489] p-4 text-[#3b2a05]">
            <span className="text-[10.5px] font-bold uppercase tracking-[.1em] opacity-75">Online hold</span>
            <span><span className="block font-editorial text-[19px] font-semibold leading-[1.15]">Hold a date in minutes</span><span className="mt-1 block text-meta opacity-80">Small refundable token · Razorpay</span></span>
          </Link>
          <Link href="/app/packages" className="flex min-h-[120px] w-[220px] shrink-0 flex-col justify-between rounded-[18px] bg-[#1d1d1f] p-4 text-white">
            <span className="text-[10.5px] font-bold uppercase tracking-[.1em] opacity-75">Partners</span>
            <span><span className="block font-editorial text-[19px] font-semibold leading-[1.15]">Curated catering &amp; decor</span><span className="mt-1 block text-meta opacity-80">Partners who know our halls</span></span>
          </Link>
        </div>
      </div>

      {/* Gallery teaser — real photos only */}
      {teaser.length >= 3 && (
        <div>
          <SectionTitle title="Recent celebrations" action={{ label: "Gallery", href: "/app/gallery" }} />
          <div className="mt-3 grid grid-cols-[2fr_1fr] grid-rows-[96px_96px] gap-1.5 overflow-hidden rounded-[18px]">
            {teaser.map((p, i) => (
              <Photo key={p.id} src={p.url} alt={p.title ?? "Event photo"} className={i === 0 ? "row-span-2" : ""} />
            ))}
          </div>
        </div>
      )}

      {ov && !ov.verified && (
        <Card className="p-4 text-detail leading-[1.5] text-[#3a3a3c]">
          <span className="font-semibold text-[#1d1d1f]">We couldn&apos;t link this sign-in to a booking yet.</span> If you have an event with us, message the concierge or hold a date and it will appear here.
        </Card>
      )}

      <PrimaryButton href="/app/book">Reserve a date</PrimaryButton>
      {ov && ov.balanceDue > 0 && <p className="-mt-3 text-center text-meta text-[#6e6e73]">Balance due {inr(ov.balanceDue)} · <Link href="/app/payments" className="font-semibold text-[#6d1b52]">Payments</Link></p>}
    </div>
  );
}
