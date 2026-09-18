import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { getGuestLive, type GuestLive } from "@/actions/guest-host.actions";
import { getPublicContact, telHref } from "@/lib/public/business-contact";
import { formatIstDate } from "../_components/event-view";
import { LiveRefresh } from "./_components/live-refresh";

export const dynamic = "force-dynamic";

const DOT: Record<string, string> = { DONE: "#34c759", IN_PROGRESS: "#e8b631", SKIPPED: "#8e8e93" };
const dot = (status: string) => DOT[status] ?? "rgba(255,255,255,.35)";
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function eyebrow(live: GuestLive): string {
  if (live.now) return `${live.now.live ? "Now" : "Next"}${live.now.time ? ` · ${live.now.time}` : ""}`;
  if (live.isEventDay) return "Today";
  return live.daysToGo > 0 ? `In ${count(live.daysToGo, "day", "days")}` : `${count(-live.daysToGo, "day", "days")} ago`;
}

/** One line of facts, each straight from a team record, and only the ones that exist. */
function facts(live: GuestLive): string {
  const place = [live.booking.venueName, live.booking.hallName].filter(Boolean).join(", ");
  const staff =
    live.staff.assigned === 0
      ? null
      : live.isEventDay
        ? `${live.staff.checkedIn}/${live.staff.assigned} team checked in`
        : count(live.staff.assigned, "team member rostered", "team members rostered");
  const partners = live.partners.total > 0 ? `${live.partners.confirmed}/${live.partners.total} partners confirmed` : null;
  return [live.now ? live.booking.eventName : null, place, staff, partners].filter(Boolean).join(" · ");
}

export default async function LivePage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  await requireGuest("/app/event/live");
  const { b } = await searchParams;
  const [live, contact] = await Promise.all([getGuestLive(b), getPublicContact()]);

  return (
    <div className="vg-rise -mb-[calc(6rem+var(--sab))] flex min-h-screen flex-col gap-4 bg-[#111114] px-5 pb-[calc(var(--sab)+2rem)] pt-[calc(var(--sat)+0.5rem)] text-white">
      {live?.isEventDay && <LiveRefresh seconds={30} />}
      <div className="flex items-center gap-3">
        <Link href={live ? `/app/event?b=${live.booking.id}` : "/app/event"} aria-label="Back" className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/[.06]">
          <ChevronLeft className="size-5" />
        </Link>
        <div className="flex-1">
          <div className="text-copy font-semibold">
            {live ? `${live.isEventDay ? "Live" : live.daysToGo > 0 ? "Preview" : "Recap"} · ${formatIstDate(live.booking.date)}` : "Live mode"}
          </div>
          {live && (
            <div className="text-meta text-white/55">
              {live.isEventDay
                ? "Refreshes every 30 seconds while your team checks guests in"
                : live.daysToGo > 0
                  ? "How your day is set up so far · check-ins count on the day"
                  : "How the day went"}
            </div>
          )}
        </div>
        {live?.isEventDay && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-[#34c759]">
            <span className="vg-pulse size-2 rounded-full bg-[#34c759]" />
            Live
          </div>
        )}
      </div>

      {!live ? (
        <p className="text-body text-white/70">{b ? "We couldn't find that booking on your account." : "No booking is linked to this account yet."}</p>
      ) : (
        <>
          <div className="rounded-[22px] border border-white/[.08] bg-white/[.06] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#e8b631]">{eyebrow(live)}</div>
            <div className="mt-1.5 font-editorial text-[28px] font-semibold leading-[1.1] tracking-[-.015em]">{live.now?.activity ?? live.booking.eventName}</div>
            <div className="mt-1 text-detail text-white/60">{facts(live)}</div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { n: String(live.guests.checkedIn), l: live.guests.onList > 0 ? `of ${live.guests.onList} on the list checked in` : "guests checked in" },
              { n: String(live.guests.attending), l: "RSVPs accepted" },
              {
                n: live.partners.total > 0 ? `${live.partners.confirmed}/${live.partners.total}` : "0",
                l: live.partners.total > 0 ? "partners confirmed" : "partners booked",
              },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-white/[.08] bg-white/[.06] px-3 py-3.5">
                <div className="numeric text-[26px] font-semibold leading-none tracking-[-.02em]">{s.n}</div>
                <div className="mt-1.5 text-meta text-white/55">{s.l}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="text-copy font-semibold">Run of show</div>
            <div className="mt-2.5 flex flex-col gap-1.5">
              {live.runOfShow.length === 0 && (
                <p className="text-detail text-white/55">Your coordinator will share the run of show for your day here once it&apos;s planned.</p>
              )}
              {live.runOfShow.map((r, i) => (
                <div key={`${i}-${r.time}-${r.activity}`} className="flex items-center gap-3 rounded-[14px] border border-white/[.08] bg-white/[.06] px-3.5 py-3">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: dot(r.status) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold">{r.activity}</span>
                    {r.time && <span className="block text-meta text-white/55">{r.time}</span>}
                  </span>
                  <span className="text-meta font-semibold" style={{ color: dot(r.status) }}>
                    {r.statusLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={`mt-auto grid gap-2 ${contact.phone ? "grid-cols-2" : "grid-cols-1"}`}>
            <Link href="/app/concierge" className="rounded-2xl bg-white py-[15px] text-center text-body font-semibold text-[#111114]">
              Message the team
            </Link>
            {contact.phone && (
              <a href={telHref(contact.phone)} className="rounded-2xl border border-white/20 py-[15px] text-center text-body font-semibold">
                Call the venue
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
