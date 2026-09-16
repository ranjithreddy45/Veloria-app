import { Check } from "lucide-react";
import { requireGuest } from "@/lib/guest-session";
import { getGuestChecklist } from "@/actions/guest-host.actions";
import { Screen, ScreenHeader, Card, EmptyNote, Pill, type Tone } from "../../../_components/ui";
import { formatIstDate } from "../_components/event-view";
import { HostTodos } from "./_components/host-todos";

export const dynamic = "force-dynamic";

/** Plan statuses worth flagging on an unfinished row. A "Not started" row just shows who owns it. */
const FLAG_TONE: Record<string, Tone> = { IN_PROGRESS: "gold", BLOCKED: "amber", DELAYED: "amber" };

export default async function ChecklistPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  await requireGuest("/app/event/checklist");
  const { b } = await searchParams;
  const list = await getGuestChecklist(b);

  return (
    <Screen className="gap-4">
      <ScreenHeader title="Planning checklist" backHref={list ? `/app/event?b=${list.bookingId}` : "/app/event"} />
      {!list ? (
        <EmptyNote>{b ? "We couldn't find that booking on your account." : "No booking is linked to this account yet."}</EmptyNote>
      ) : (
        <>
          {list.total > 0 && (
            <Card className="flex items-center gap-4 rounded-[18px] p-4">
              <div className="relative size-16 shrink-0 rounded-full" style={{ background: `conic-gradient(#6d1b52 ${list.pct ?? 0}%, #eeeef0 0)` }}>
                <div className="numeric absolute inset-1.5 flex items-center justify-center rounded-full bg-white text-body font-semibold">{list.pct ?? 0}%</div>
              </div>
              <div>
                <div className="text-copy font-semibold">
                  <span className="numeric">{list.done}</span> of <span className="numeric">{list.total}</span> done
                </div>
                <div className="mt-0.5 text-detail leading-[1.5] text-[#6e6e73]">Your team&apos;s plan for the day, ticked off as they work through it.</div>
              </div>
            </Card>
          )}
          <HostTodos bookingId={list.bookingId} initial={list.todos} readOnly={list.preview} />
          {!list.planVisible ? (
            <EmptyNote>Staff preview: your role can&apos;t open this booking&apos;s execution plan, so the team&apos;s checklist is hidden here.</EmptyNote>
          ) : list.groups.length === 0 ? (
            <EmptyNote>Your coordinator hasn&apos;t shared the plan for your day yet. It appears here as soon as they do.</EmptyNote>
          ) : null}
          {list.groups.map((g, gi) => (
            <div key={`${gi}-${g.title}`}>
              <div className="flex items-baseline justify-between">
                <div className="text-copy font-semibold">{g.title}</div>
                {g.due && <div className="text-meta font-medium text-[#6e6e73]">by {formatIstDate(g.due, { day: "numeric", month: "short" })}</div>}
              </div>
              <Card className="vg-divide mt-2.5 overflow-hidden">
                {g.items.map((t) => (
                  <div key={t.id} className="flex min-h-[50px] items-center gap-3 px-3.5 py-3">
                    <span className={`flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${t.done ? "border-[#6d1b52] bg-[#6d1b52]" : "border-black/20"}`}>
                      {t.done && <Check className="size-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className={`flex-1 text-body ${t.done ? "text-[#636368] line-through" : ""}`}>{t.label}</span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {!t.done && FLAG_TONE[t.status] && <Pill tone={FLAG_TONE[t.status]}>{t.statusLabel}</Pill>}
                      <span className="text-meta text-[#636368]">{t.owner}</span>
                    </span>
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
