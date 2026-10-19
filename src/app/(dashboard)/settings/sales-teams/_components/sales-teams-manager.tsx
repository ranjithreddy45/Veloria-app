"use client";

// ============================================================
// Settings → Sales teams: one card per team (head, auto-routing, members),
// the "who is in which team" table, and the Unsorted backlog with Sort now.
// ============================================================

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeamChip } from "@/components/crm/team-switcher";
import { SALES_TEAMS } from "@/lib/crm/sales-team";
import {
  setUserSalesTeam,
  sortUnsortedLeadsNow,
  updateSalesTeam,
  type SalesTeamSettings,
} from "@/actions/sales-team.actions";

const NONE = "__none";

const ROLE_LABEL: Record<string, string> = {
  SALES_EXEC: "Sales executive",
  SALES_HEAD: "Sales head",
  EVENT_COORDINATOR: "Event coordinator",
};

export function SalesTeamsManager({ data }: { data: SalesTeamSettings }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ success: boolean; error?: string }>, ok?: string) {
    setBusy(key);
    try {
      const res = await fn();
      if (!res.success) toast.error(res.error ?? "Something went wrong.");
      else {
        if (ok) toast.success(ok);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  const unteamed = data.people.filter((p) => !p.salesTeam).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {data.teams.map((t) => (
          <Card key={t.key}>
            <CardContent className="space-y-4 py-1">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-body font-semibold">{t.label} team</p>
                  <p className="text-detail text-muted-foreground">
                    <span className="numeric">{t.memberCount}</span> {t.memberCount === 1 ? "rep" : "reps"} ·{" "}
                    <span className="numeric">{t.openLeads}</span> open leads
                  </p>
                </div>
                <TeamChip team={t.key} />
              </div>

              <div className="space-y-1.5">
                <p className="text-meta font-medium text-muted-foreground">Team head</p>
                <Select
                  value={t.headUserId ?? NONE}
                  disabled={busy !== null}
                  onValueChange={(v) =>
                    run(`head:${t.key}`, () => updateSalesTeam(t.key, { headUserId: v === NONE ? null : v }), "Team head saved")
                  }
                >
                  <SelectTrigger className="h-9 w-full" aria-label={`${t.label} team head`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No head</SelectItem>
                    {data.people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-body font-medium">Share out new leads</span>
                  <span className="block text-detail text-muted-foreground">
                    {t.autoRoute
                      ? "New leads go to the next rep in this team, in turn."
                      : "Off — new leads use the general assignment rules."}
                  </span>
                </span>
                <Switch
                  checked={t.autoRoute}
                  disabled={busy !== null}
                  onCheckedChange={(v) => run(`route:${t.key}`, () => updateSalesTeam(t.key, { autoRoute: v }))}
                  aria-label={`Share out new ${t.label} leads automatically`}
                />
              </label>

              {t.autoRoute && t.memberCount === 0 && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-detail text-foreground/80">
                  No reps in this team yet, so its leads fall back to the general rules.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-body font-semibold">
              <span className="numeric">{data.unsorted}</span> open {data.unsorted === 1 ? "lead is" : "leads are"} Unsorted
            </p>
            <p className="text-detail text-muted-foreground">
              These have no event type yet, so no team. Sorting runs every hour on its own; a lead moved by hand is never re-sorted.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" asChild>
              <Link href="/leads?scope=all&team=UNSORTED">Open Unsorted</Link>
            </Button>
            <Button
              disabled={busy !== null}
              onClick={() =>
                run("sort", async () => {
                  const res = await sortUnsortedLeadsNow();
                  if (res.success) toast.success(`${res.sorted} sorted · ${res.stillUnsorted} still need an event type`);
                  return res;
                })
              }
            >
              {busy === "sort" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              Sort now
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-1">
          <div>
            <p className="text-body font-semibold">Who is in which team</p>
            <p className="text-detail text-muted-foreground">
              {unteamed > 0
                ? `${unteamed} of ${data.people.length} sales staff are in no team yet — they still see only the leads assigned to them.`
                : "Moving a rep doesn't move their open leads; reassign those from the leads list if needed."}
            </p>
          </div>
          {data.people.length === 0 ? (
            <p className="py-6 text-center text-body text-muted-foreground">
              No active sales staff. Add users with a Sales or Event coordinator role first.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {data.people.map((p) => (
                <li key={p.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium">{p.name}</p>
                    <p className="truncate text-detail text-muted-foreground">
                      {ROLE_LABEL[p.role] ?? p.role} · {p.email}
                    </p>
                  </div>
                  <Select
                    value={p.salesTeam ?? NONE}
                    disabled={busy !== null}
                    onValueChange={(v) =>
                      run(`user:${p.id}`, () => setUserSalesTeam(p.id, v === NONE ? null : v), `${p.name} moved`)
                    }
                  >
                    <SelectTrigger className="h-9 w-full sm:w-48" aria-label={`Team for ${p.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>No team</SelectItem>
                      {SALES_TEAMS.map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
