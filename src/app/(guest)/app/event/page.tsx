import Link from "next/link";
import { ClipboardCheck, Users, Package, FileText, CreditCard, Image as ImageIcon, ChevronRight, type LucideIcon, UtensilsCrossed, UserPlus } from "lucide-react";
import { NavLink } from "../../_components/nav-transition";
import { requireGuest } from "@/lib/guest-session";
import { getGuestEvent, type GuestEvent } from "@/actions/guest-host.actions";
import { Screen, Title, Card, ProgressBar, IconTile, Avatar, Pill, EmptyNote, PrimaryButton, SectionTitle, type Tone } from "../../_components/ui";
import { inr, SLOT_SHORT, slotShortText } from "../../_components/format";
import { daysUntilEvent, formatIstDate } from "./_components/event-view";

export const dynamic = "force-dynamic";

const RUN_TONE: Record<string, Tone> = { DONE: "green", IN_PROGRESS: "gold", SKIPPED: "grey" };

type Tile = { label: string; sub: string; icon: LucideIcon; href: string; tone: Tone };

/** Hub tiles. Each sub-line says only what the record says: no "All done" without a plan, nothing "settled" before anything is billed. */
function hubTiles(ev: GuestEvent): Tile[] {
  const b = ev.booking;
  const plan = ev.planTasks;
  const guests = ev.guestCounts;
  const docs = ev.docsToSign;
  // Money, documents, requests and sharing belong to the booking's own customer; co-hosts and viewers don't get them.
  const host = !ev.collaboratorRole;
  const tiles: (Tile | false)[] = [
    {
      label: "Checklist",
      sub: ev.previewHidden.plan ? "Hidden in preview" : !plan ? "Not shared yet" : plan.open > 0 ? `${plan.open} open` : "All done",
      icon: ClipboardCheck,
      href: `/app/event/checklist?b=${b.id}`,
      tone: !plan ? "grey" : plan.open > 0 ? "gold" : "green",
    },
    {
      label: "Guest list",
      sub: guests.onList === 0 ? "None added" : `${guests.attending}/${guests.onList} attending`,
      icon: Users,
      href: `/app/event/guests?b=${b.id}`,
      tone: "plum",
    },
    host && {
      label: "Menu",
      sub: "View or request changes",
      icon: UtensilsCrossed,
      href: `/app/event/menu?b=${b.id}`,
      tone: "plum",
    },
    host && { label: "Packages", sub: ev.requests > 0 ? `${ev.requests} requested` : "Browse", icon: Package, href: "/app/packages", tone: "plum" },
    host && {
      label: "Documents",
      sub: docs === null ? "View" : docs > 0 ? `${docs} to sign` : "Nothing to sign",
      icon: FileText,
      href: `/app/event/documents?b=${b.id}`,
      tone: docs ? "amber" : "plum",
    },
    host && {
      label: "Payments",
      sub: ev.invoicesIssued === 0 ? "No invoices yet" : ev.balanceDue > 0 ? `${inr(ev.balanceDue)} due` : "Nothing due",
      icon: CreditCard,
      href: `/app/payments?b=${b.id}`,
      tone: ev.invoicesIssued > 0 && ev.balanceDue === 0 ? "green" : "plum",
    },
    { label: "Gallery", sub: "Photos", icon: ImageIcon, href: "/app/gallery", tone: "plum" },
    host && { label: "Share", sub: "Family & planners", icon: UserPlus, href: `/app/event/share?b=${b.id}`, tone: "plum" },
  ];
  return tiles.filter((t): t is Tile => Boolean(t));
}

export default async function MyEventPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  await requireGuest("/app/event");
  const { b: bid } = await searchParams;
  const ev = await getGuestEvent(bid);

  if (!ev) {
    return (
      <Screen className="pt-[calc(var(--sat)+1rem)]">
        <Title>My event</Title>
        <EmptyNote>{bid ? "We couldn't find that booking on your account." : "No booking is linked to this account yet."}</EmptyNote>
        <PrimaryButton href="/app/book">Reserve a date</PrimaryButton>
      </Screen>
    );
  }

  const { booking: b } = ev;
  const days = daysUntilEvent(b.date);
  const slot = SLOT_SHORT[b.timeSlot];
  const place = [b.venueName, b.hallName].filter(Boolean).join(" · ");
  const dayWord = days > 0 ? (days === 1 ? "day to go" : "days to go") : days === -1 ? "day ago" : "days ago";
  const hiddenInPreview = ev.preview && (ev.previewHidden.readiness || ev.previewHidden.plan || ev.previewHidden.documents);

  return (
    <Screen className="pt-[calc(var(--sat)+1rem)]">
      {ev.preview && (
        <div className="rounded-xl border border-[#b88513]/35 bg-[#faf3e1] px-3.5 py-2.5 text-detail text-[#6e4f0e]">
          <span className="font-semibold">Staff preview.</span> You&apos;re seeing {ev.hostName || "the host"}&apos;s view of this booking. Use Switch to pick another.
          {hiddenInPreview && " Sections your role can't open in the ERP are hidden."}
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <Title>My event</Title>
        {ev.bookings.length > 1 && (
          <details className="relative">
            <summary className="cursor-pointer list-none text-detail font-semibold text-[#6d1b52]">Switch ▾</summary>
            <div className="vg-card absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-xl">
              {ev.bookings.map((x) => (
                <Link key={x.id} href={`/app/event?b=${x.id}`} className={`block px-3 py-2.5 text-detail ${x.id === b.id ? "bg-[#f7eef2] font-semibold" : ""}`}>
                  {x.eventName}
                  <span className="block text-meta text-[#6e6e73]">{formatIstDate(x.date)}</span>
                </Link>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="vg-hero relative overflow-hidden rounded-[22px]">
        <div aria-hidden className="absolute -right-8 -top-8 size-[150px] rounded-full bg-[#e8b631]/[.18] blur-[30px]" />
        <div className="relative p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-[.12em] text-[#e8b631]">{b.statusLabel}</div>
              <div className="mt-1.5 font-editorial text-[23px] font-semibold tracking-[-.01em]">{b.eventName}</div>
              <div className="mt-1 text-detail text-[#fdf5f3]/75">
                {formatIstDate(b.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {slotShortText(b.timeSlot) ?? b.timeSlot}
              </div>
              <div className="text-detail text-[#fdf5f3]/75">
                {place} · <span className="numeric">{b.guestCount}</span> guests expected
              </div>
            </div>
            <div className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-center">
              {days === 0 ? (
                <div className="py-1.5 text-copy font-semibold leading-none">Today</div>
              ) : (
                <>
                  <div className="numeric text-[26px] font-semibold leading-none">{Math.abs(days)}</div>
                  <div className="mt-0.5 text-[10px] text-[#fdf5f3]/75">{dayWord}</div>
                </>
              )}
            </div>
          </div>
          {ev.readiness != null && ev.readinessChecks && (
            <div className="mt-[18px]">
              <div className="flex justify-between text-meta text-[#fdf5f3]/75">
                <span>Readiness</span>
                <span className="numeric">{ev.readiness}%</span>
              </div>
              <ProgressBar pct={ev.readiness} className="mt-1.5 h-1" track="bg-white/20" fill="bg-[#e8b631]" />
              <div className="mt-1.5 text-meta text-[#fdf5f3]/60">
                {ev.readinessChecks.passing} of {ev.readinessChecks.total} operations checks passed, as your team tracks them
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {hubTiles(ev).map((t) => (
          <NavLink key={t.label} href={t.href} kind="push" className="vg-card vg-press flex min-h-[92px] flex-col items-start gap-3 rounded-2xl p-3 text-left">
            <IconTile tone={t.tone} size={30}>
              <t.icon className="size-4" strokeWidth={1.9} />
            </IconTile>
            <span>
              <span className="block text-detail font-semibold leading-tight">{t.label}</span>
              <span className="mt-0.5 block text-meta text-[#6e6e73]">{t.sub}</span>
            </span>
          </NavLink>
        ))}
      </div>

      <NavLink href={`/app/event/live?b=${b.id}`} kind="push" className="vg-press flex items-center gap-3.5 rounded-[18px] bg-[#1d1d1f] px-4 py-3.5 text-white">
        <span className={`size-2.5 shrink-0 rounded-full ${days === 0 ? "vg-pulse bg-[#34c759]" : "bg-white/35"}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold">Event-day live mode</span>
          <span className="block text-meta text-white/65">
            {days === 0 ? "Today · check-ins and the run of show" : days > 0 ? "Check-ins and the run of show, live on the day" : "How the day went"}
          </span>
        </span>
        <ChevronRight className="size-5 text-white/40" />
      </NavLink>

      {ev.team.length > 0 && (
        <div>
          <SectionTitle title="Your team" />
          <div className="mt-2.5 flex gap-2">
            {ev.team.map((p, i) => (
              <Link key={p.name} href="/app/concierge" className="vg-card flex flex-1 flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center">
                <Avatar text={p.initials} tone={i === 0 ? "plum" : i === 1 ? "gold" : "ink"} size={42} />
                <span>
                  <span className="block text-detail font-semibold">{p.name}</span>
                  <span className="block text-meta text-[#6e6e73]">{p.role}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionTitle title="Run of show" sub={slot ? `${slot.label} slot` : undefined} />
        {ev.runOfShow.length > 0 ? (
          <Card className="vg-divide mt-2.5 overflow-hidden">
            {ev.runOfShow.map((r, i) => (
              <div key={`${i}-${r.time}-${r.activity}`} className="flex items-center gap-3.5 px-4 py-3">
                <span className="numeric w-[68px] shrink-0 text-detail font-semibold text-[#6d1b52]">{r.time}</span>
                <span className="flex-1 text-body">{r.activity}</span>
                <Pill tone={RUN_TONE[r.status] ?? "plum"}>{r.statusLabel}</Pill>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyNote className="mt-2.5">Your coordinator will share the run of show for your day here once it&apos;s planned.</EmptyNote>
        )}
      </div>
    </Screen>
  );
}
