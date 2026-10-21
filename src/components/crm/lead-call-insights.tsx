import { PhoneCall, PhoneIncoming, PhoneMissed, PhoneOutgoing, Sparkles, ListChecks, Lightbulb } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CallInsightsDialog } from "@/components/crm/call-insights-dialog";
import { CALL_DISPOSITION_COLORS, CALL_DISPOSITION_LABELS } from "@/lib/constants";
import {
  formatIstDateTime,
  formatTalkTime,
  type LeadCall,
  type LeadCallInsights as Insights,
} from "@/lib/crm/call-insights";
import { cn } from "@/lib/utils";

// ============================================================
// Lead page → "Calls & insights". Everything the calls told us about THIS
// lead in one place: the headline, the newest answer per AI insight (with the
// call it came from), the next steps from the last call, and every call with
// its summary, recording and full AI read. Server-rendered; "Show all" is a
// <details> so it needs no client JS. Data: getLeadCallInsights.
// ============================================================

const VISIBLE_CALLS = 5;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="rounded-xl border bg-muted/30 px-3 py-2.5">
      <p className="text-meta uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="numeric mt-0.5 text-copy font-semibold">{value}</p>
      {sub ? <p className="mt-0.5 truncate text-detail text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function CallRow({ call }: { call: LeadCall }) {
  const Icon = !call.connected ? PhoneMissed : call.direction === "INBOUND" ? PhoneIncoming : PhoneOutgoing;
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-detail">
        <Icon
          className={cn("size-4 shrink-0", call.connected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}
          aria-hidden
        />
        <span className="font-medium text-foreground">{formatIstDateTime(call.at)}</span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-meta font-medium",
            CALL_DISPOSITION_COLORS[call.disposition] ?? "bg-muted text-muted-foreground",
          )}
        >
          {CALL_DISPOSITION_LABELS[call.disposition] ?? call.disposition}
        </span>
        {call.durationSeconds > 0 && <span className="numeric text-muted-foreground">{formatTalkTime(call.durationSeconds)}</span>}
        {call.agentName && <span className="text-muted-foreground">· {call.agentName}</span>}
        {call.score && (
          <span className="numeric ml-auto rounded-full bg-violet-500/10 px-2 py-0.5 text-meta font-semibold text-violet-700 dark:text-violet-300">
            AI score {call.score.value}/{call.score.outOf}
          </span>
        )}
      </div>

      {call.summary && <p className="whitespace-pre-wrap text-body leading-relaxed text-foreground/90">{call.summary}</p>}

      {call.insights.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {call.insights.map((i) => (
            <span key={i.label} className="rounded-md bg-muted px-2 py-0.5 text-meta text-muted-foreground">
              <span className="font-medium text-foreground/80">{i.label}:</span> {i.value}
            </span>
          ))}
        </div>
      )}

      {call.actionItems.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-detail text-foreground/85">
          {call.actionItems.map((a, idx) => (
            <li key={idx}>{a}</li>
          ))}
        </ul>
      )}

      {(call.recordingUrl || call.metadata?.isAiTranscription === true) && (
        <div className="flex flex-wrap items-center gap-2">
          {call.recordingUrl && (
            <audio controls preload="none" className="h-9 w-full max-w-xs" aria-label="Call recording">
              <source src={call.recordingUrl} />
            </audio>
          )}
          <CallInsightsDialog content={call.summary} metadata={call.metadata} />
        </div>
      )}
    </li>
  );
}

export function LeadCallInsights({ data, error }: { data: Insights | null; error?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PhoneCall className="size-4" />
          Calls &amp; insights
          {data && data.total > 0 && (
            <span className="numeric text-detail font-normal text-muted-foreground">· {data.total}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!data ? (
          <p className="text-body text-muted-foreground">{error ?? "Could not load this lead's calls."}</p>
        ) : data.total === 0 ? (
          <div className="rounded-xl border border-dashed">
            <EmptyState
              className="py-8"
              icon={<PhoneCall />}
              title="No calls yet"
              description="Calls made through CallVibe show up here with the AI summary, the recording and what was learned on the call."
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat
                label="Calls"
                value={String(data.total)}
                sub={`${data.connected} connected · ${data.notConnected} not answered`}
              />
              <Stat label="Talk time" value={formatTalkTime(data.talkSeconds)} />
              <Stat
                label="Last call"
                value={data.lastCallAt ? formatIstDateTime(data.lastCallAt) : "—"}
                sub={data.calls[0]?.agentName ?? null}
              />
              <Stat
                label="Latest AI score"
                value={data.latestScore ? `${data.latestScore.value}/${data.latestScore.outOf}` : "—"}
                sub={data.latestScore ? `from ${formatIstDateTime(data.latestScore.at)}` : "no scored call yet"}
              />
            </div>

            {(data.facts.length > 0 || data.openActionItems) && (
              <div className="grid gap-4 md:grid-cols-2">
                {data.facts.length > 0 && (
                  <section className="space-y-2">
                    <h4 className="flex items-center gap-1.5 text-detail font-semibold text-foreground">
                      <Lightbulb className="size-3.5 text-amber-500" /> What we learned on calls
                    </h4>
                    <dl className="space-y-1.5">
                      {data.facts.map((f) => (
                        <div key={f.key} className="grid grid-cols-[7.5rem_1fr] gap-2 text-detail">
                          <dt className="text-muted-foreground">{f.label}</dt>
                          <dd>
                            <span className="text-foreground">{f.value}</span>
                            <span className="block text-meta text-muted-foreground">call of {formatIstDateTime(f.at)}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
                {data.openActionItems && (
                  <section className="space-y-2">
                    <h4 className="flex items-center gap-1.5 text-detail font-semibold text-foreground">
                      <ListChecks className="size-3.5 text-emerald-600" /> Next steps from the call
                    </h4>
                    <ul className="list-disc space-y-1 pl-5 text-detail text-foreground/90">
                      {data.openActionItems.items.map((a, idx) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ul>
                    <p className="text-meta text-muted-foreground">call of {formatIstDateTime(data.openActionItems.at)}</p>
                  </section>
                )}
              </div>
            )}

            <section>
              <h4 className="flex items-center gap-1.5 text-detail font-semibold text-foreground">
                <Sparkles className="size-3.5 text-violet-500" /> Every call, newest first
              </h4>
              <ul className="divide-y divide-border/60">
                {data.calls.slice(0, VISIBLE_CALLS).map((c) => (
                  <CallRow key={c.id} call={c} />
                ))}
              </ul>
              {data.calls.length > VISIBLE_CALLS && (
                <details className="group">
                  <summary className="cursor-pointer select-none py-2 text-detail font-medium text-primary hover:underline">
                    <span className="group-open:hidden">Show all {data.calls.length} calls</span>
                    <span className="hidden group-open:inline">Show fewer</span>
                  </summary>
                  <ul className="divide-y divide-border/60">
                    {data.calls.slice(VISIBLE_CALLS).map((c) => (
                      <CallRow key={c.id} call={c} />
                    ))}
                  </ul>
                </details>
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
