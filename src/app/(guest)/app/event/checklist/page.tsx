import { Check } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { getGuestEvent, getGuestChecklist } from "@/actions/guest-host.actions";
import { Screen, ScreenHeader, Card, EmptyNote } from "../../../_components/ui";
import { fmtDate } from "../../../_components/format";

export const dynamic = "force-dynamic";

export default async function ChecklistPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  await requireGuest("/app/event/checklist");
  const { b } = await searchParams;
  const ev = await getGuestEvent(b);
  const list = ev ? await getGuestChecklist(ev.booking.id) : null;

  return (
    <Screen className="gap-4">
      <ScreenHeader title="Planning checklist" backHref="/app/event" />
      {!list ? <EmptyNote>No booking linked yet.</EmptyNote> : (
        <>
          <Card className="flex items-center gap-4 rounded-[18px] p-4">
            <div className="relative size-16 shrink-0 rounded-full" style={{ background: `conic-gradient(#6d1b52 ${list.pct ?? 0}%, #eeeef0 0)` }}>
              <div className="numeric absolute inset-1.5 flex items-center justify-center rounded-full bg-white text-body font-semibold">{list.pct ?? 0}%</div>
            </div>
            <div><div className="text-copy font-semibold">{list.done} of {list.total} done</div><div className="mt-0.5 text-detail leading-[1.5] text-[#6e6e73]">Your coordinator works this list with you — anything marked for you, the concierge can take a note on.</div></div>
          </Card>
          {list.groups.length === 0 && <EmptyNote>Your coordinator hasn&apos;t published the plan yet. It appears here as soon as they do.</EmptyNote>}
          {list.groups.map((g) => (
            <div key={g.title}>
              <div className="flex items-baseline justify-between"><div className="text-copy font-semibold">{g.title}</div>{g.due && <div className="text-meta font-medium text-[#6e6e73]">by {fmtDate(g.due)}</div>}</div>
              <Card className="vg-divide mt-2.5 overflow-hidden">
                {g.items.map((t) => (
                  <div key={t.id} className="flex min-h-[50px] items-center gap-3 px-3.5 py-3">
                    <span className={`flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${t.done ? "border-[#6d1b52] bg-[#6d1b52]" : "border-black/20"}`}>{t.done && <Check className="size-3 text-white" strokeWidth={3} />}</span>
                    <span className={`flex-1 text-body ${t.done ? "text-[#8a8a8e] line-through" : ""}`}>{t.label}</span>
                    <span className="text-meta text-[#8a8a8e]">{t.owner}</span>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </>
      )}
    </Screen>
  );
}
