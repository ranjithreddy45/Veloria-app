import Link from "next/link";
import { NavLink } from "../../_components/nav-transition";
import { ClipboardCheck, Users, Package, FileText, CreditCard, Image as ImageIcon, ChevronRight } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { getGuestEvent } from "@/actions/guest-host.actions";
import { Screen, Title, Card, ProgressBar, IconTile, Avatar, Pill, EmptyNote, PrimaryButton, SectionTitle } from "../../_components/ui";
import { inr, fmtDate, daysUntil, SLOT_SHORT } from "../../_components/format";
import { BOOKING_STATUS_CLIENT_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function MyEventPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  await requireGuest("/app/event");
  const { b: bid } = await searchParams;
  const ev = await getGuestEvent(bid);

  if (!ev) {
    return (
      <Screen className="pt-[calc(var(--sat)+1rem)]">
        <Title>My event</Title>
        <EmptyNote>No booking is linked to this account yet. Hold a date and it will appear here the moment the token is paid.</EmptyNote>
        <PrimaryButton href="/app/book">Reserve a date</PrimaryButton>
      </Screen>
    );
  }
  const { booking: b } = ev;
  const days = daysUntil(b.date);
  const tiles = [
    { label: "Checklist", sub: ev.openTasks > 0 ? `${ev.openTasks} open` : "All done", icon: ClipboardCheck, href: "/app/event/checklist", tone: ev.openTasks > 0 ? "gold" : "green" },
    { label: "Guest list", sub: `${ev.guests.confirmed} / ${ev.guests.total}`, icon: Users, href: "/app/event/guests", tone: "plum" },
    { label: "Packages", sub: ev.requests > 0 ? `${ev.requests} requested` : "Browse", icon: Package, href: "/app/packages", tone: "plum" },
    { label: "Documents", sub: ev.docsToSign > 0 ? `${ev.docsToSign} to sign` : "Up to date", icon: FileText, href: "/app/event/documents", tone: ev.docsToSign > 0 ? "amber" : "green" },
    { label: "Payments", sub: ev.balanceDue > 0 ? inr(ev.balanceDue) : "Settled", icon: CreditCard, href: "/app/payments", tone: "plum" },
    { label: "Gallery", sub: "Photos", icon: ImageIcon, href: "/app/gallery", tone: "plum" },
  ] as const;

  return (
    <Screen className="pt-[calc(var(--sat)+1rem)]">
      {ev.preview && (
        <div className="rounded-xl border border-[#b88513]/35 bg-[#faf3e1] px-3.5 py-2.5 text-detail text-[#6e4f0e]"><span className="font-semibold">Staff preview.</span> You&apos;re seeing {ev.hostName || "the host"}&apos;s view of this booking. Use Switch to pick another.</div>
      )}
      <div className="flex items-baseline justify-between">
        <Title>My event</Title>
        {ev.bookings.length > 1 && (
          <details className="relative">
            <summary className="cursor-pointer list-none text-detail font-semibold text-[#6d1b52]">Switch ▾</summary>
            <div className="vg-card absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-xl">
              {ev.bookings.map((x) => <Link key={x.id} href={`/app/event?b=${x.id}`} className={`block px-3 py-2.5 text-detail ${x.id === b.id ? "bg-[#f7eef2] font-semibold" : ""}`}>{x.eventName}<span className="block text-meta text-[#6e6e73]">{fmtDate(x.date)}</span></Link>)}
            </div>
          </details>
        )}
      </div>

      <div className="vg-hero relative overflow-hidden rounded-[22px]">
        <div aria-hidden className="absolute -right-8 -top-8 size-[150px] rounded-full bg-[#e8b631]/[.18] blur-[30px]" />
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-[.12em] text-[#e8b631]">{BOOKING_STATUS_CLIENT_LABELS[b.status] ?? b.status}</div>
              <div className="mt-1.5 font-editorial text-[23px] font-semibold tracking-[-.01em]">{b.eventName}</div>
              <div className="mt-1 text-detail text-[#fdf5f3]/75">{fmtDate(b.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {SLOT_SHORT[b.timeSlot]?.time ?? b.timeSlot} · {b.venueName}</div>
            </div>
            <div className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-center"><div className="numeric text-[26px] font-semibold leading-none">{Math.max(0, days)}</div><div className="mt-0.5 text-[10px] text-[#fdf5f3]/75">{days < 0 ? "days ago" : "days"}</div></div>
          </div>
          {ev.readiness != null && (
            <div className="mt-[18px]"><div className="flex justify-between text-meta text-[#fdf5f3]/75"><span>Readiness</span><span className="numeric">{ev.readiness}%</span></div><ProgressBar pct={ev.readiness} className="mt-1.5 h-1" track="bg-white/20" fill="bg-[#e8b631]" /></div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <NavLink key={t.label} href={t.href} kind="push" className="vg-card vg-press flex min-h-[92px] flex-col items-start gap-3 rounded-2xl p-3 text-left">
            <IconTile tone={t.tone} size={30}><t.icon className="size-4" strokeWidth={1.9} /></IconTile>
            <span><span className="block text-detail font-semibold leading-tight">{t.label}</span><span className="mt-0.5 block text-meta text-[#6e6e73]">{t.sub}</span></span>
          </NavLink>
        ))}
      </div>

      <NavLink href={`/app/event/live?b=${b.id}`} kind="push" className="vg-press flex items-center gap-3.5 rounded-[18px] bg-[#1d1d1f] px-4 py-3.5 text-white">
        <span className={`size-2.5 shrink-0 rounded-full bg-[#34c759] ${days === 0 ? "vg-pulse" : ""}`} />
        <span className="min-w-0 flex-1"><span className="block text-body font-semibold">Event-day live mode</span><span className="block text-meta text-white/65">{days === 0 ? "Today · arrivals, stations and your team" : "Preview how the day will run"}</span></span>
        <ChevronRight className="size-5 text-white/40" />
      </NavLink>

      {ev.team.length > 0 && (
        <div>
          <SectionTitle title="Your team" />
          <div className="mt-2.5 flex gap-2">
            {ev.team.map((p, i) => (
              <Link key={p.name} href="/app/concierge" className="vg-card flex flex-1 flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center">
                <Avatar text={p.initials} tone={i === 0 ? "plum" : i === 1 ? "gold" : "ink"} size={42} />
                <span><span className="block text-detail font-semibold">{p.name}</span><span className="block text-meta text-[#6e6e73]">{p.role}</span></span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {ev.runOfShow.length > 0 && (
        <div>
          <SectionTitle title="Run of show" sub={SLOT_SHORT[b.timeSlot]?.label ? `${SLOT_SHORT[b.timeSlot].label} slot` : undefined} />
          <Card className="vg-divide mt-2.5 overflow-hidden">
            {ev.runOfShow.map((r, i) => (
              <div key={i} className="flex items-center gap-3.5 px-4 py-3">
                <span className="numeric w-[52px] shrink-0 text-detail font-semibold text-[#6d1b52]">{r.time}</span>
                <span className="flex-1 text-body">{r.activity}</span>
                <Pill tone={r.status === "DONE" ? "green" : r.status === "IN_PROGRESS" ? "gold" : r.status === "SKIPPED" ? "grey" : "plum"}>{r.status === "DONE" ? "Done" : r.status === "IN_PROGRESS" ? "Now" : r.status === "SKIPPED" ? "Skipped" : "Planned"}</Pill>
              </div>
            ))}
          </Card>
        </div>
      )}
    </Screen>
  );
}
