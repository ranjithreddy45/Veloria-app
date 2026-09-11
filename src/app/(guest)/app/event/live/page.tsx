import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { getGuestEvent, getGuestLive } from "@/actions/guest-host.actions";
import { COMPANY_PHONE, HAS_PUBLIC_CONTACT } from "@/lib/constants";
import { fmtDate } from "../../../_components/format";

export const dynamic = "force-dynamic";

export default async function LivePage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  await requireGuest("/app/event/live");
  const { b } = await searchParams;
  const ev = await getGuestEvent(b);
  const live = ev ? await getGuestLive(ev.booking.id) : null;
  const dot = (s: string) => (s === "DONE" ? "#34c759" : s === "IN_PROGRESS" ? "#e8b631" : s === "SKIPPED" ? "#8e8e93" : "rgba(255,255,255,.35)");
  const word = (s: string) => (s === "DONE" ? "Done" : s === "IN_PROGRESS" ? "Live" : s === "SKIPPED" ? "Skipped" : "Planned");
  const telHref = COMPANY_PHONE ? `tel:${COMPANY_PHONE.replace(/[^\d+]/g, "")}` : null;

  return (
    <div className="vg-rise -mb-[calc(6rem+var(--sab))] flex min-h-screen flex-col gap-4 bg-[#111114] px-5 pb-[calc(var(--sab)+2rem)] pt-[calc(var(--sat)+0.5rem)] text-white">
      <div className="flex items-center gap-3">
        <Link href="/app/event" aria-label="Back" className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/[.06]"><ChevronLeft className="size-5" /></Link>
        <div className="flex-1">
          <div className="text-copy font-semibold">{live ? `${live.isEventDay ? "Live" : "Preview"} · ${fmtDate(live.booking.date)}` : "Live mode"}</div>
          <div className="text-meta text-white/55">{live?.isEventDay ? "Numbers update as guests check in" : "How your day will run · numbers fill in on the day"}</div>
        </div>
        {live?.isEventDay && <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.08em] text-[#34c759]"><span className="vg-pulse size-2 rounded-full bg-[#34c759]" />Live</div>}
      </div>

      {!live ? <p className="text-body text-white/70">No booking linked yet.</p> : (
        <>
          <div className="rounded-[22px] border border-white/[.08] bg-white/[.06] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#e8b631]">{live.isEventDay ? "Today" : `In ${live.daysToGo} day${live.daysToGo === 1 ? "" : "s"}`}</div>
            <div className="mt-1.5 font-editorial text-[28px] font-semibold leading-[1.1] tracking-[-.015em]">{live.booking.eventName}</div>
            <div className="mt-1 text-detail text-white/60">{live.booking.venueName} · {live.staffOnDuty} team member{live.staffOnDuty === 1 ? "" : "s"} assigned · {live.vendorsConfirmed}/{live.vendorsTotal} partners confirmed</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[{ n: live.arrived, l: "guests arrived" }, { n: live.invited, l: "confirmed coming" }, { n: live.vendorsTotal ? `${Math.round((live.vendorsConfirmed / live.vendorsTotal) * 100)}%` : "—", l: "partners ready" }].map((s) => (
              <div key={s.l} className="rounded-2xl border border-white/[.08] bg-white/[.06] px-3 py-3.5"><div className="numeric text-[26px] font-semibold leading-none tracking-[-.02em]">{s.n}</div><div className="mt-1.5 text-meta text-white/55">{s.l}</div></div>
            ))}
          </div>
          <div>
            <div className="text-copy font-semibold">Stations</div>
            <div className="mt-2.5 flex flex-col gap-1.5">
              {live.stations.length === 0 && <p className="text-detail text-white/55">The run sheet is published closer to the day.</p>}
              {live.stations.map((s, i) => (
                <div key={i} className="flex items-center gap-3 rounded-[14px] border border-white/[.08] bg-white/[.06] px-3.5 py-3">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: dot(s.status) }} />
                  <span className="min-w-0 flex-1"><span className="block text-body font-semibold">{s.name}</span>{s.note && <span className="block text-meta text-white/55">{s.note}</span>}</span>
                  <span className="text-meta font-semibold" style={{ color: dot(s.status) }}>{word(s.status)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2">
            <Link href="/app/concierge" className="rounded-2xl bg-white py-[15px] text-center text-body font-semibold text-[#111114]">Message the team</Link>
            {HAS_PUBLIC_CONTACT && telHref ? <a href={telHref} className="rounded-2xl border border-white/20 py-[15px] text-center text-body font-semibold">Call the venue</a> : <span className="rounded-2xl border border-white/10 py-[15px] text-center text-body text-white/40">Call the venue</span>}
          </div>
        </>
      )}
    </div>
  );
}
