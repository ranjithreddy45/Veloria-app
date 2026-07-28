"use client";

import * as React from "react";
import {
  Circle,
  Loader2,
  Save,
  Users,
  History,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";

import {
  getTeamAvailability,
  getRoutingDecisions,
  setRepAvailabilityForUser,
  type TeamAvailabilityRow,
  type RoutingDecisionData,
} from "@/actions/rep-availability.actions";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Status = "ONLINE" | "BUSY" | "AWAY" | "OFFLINE";

const STATUS_DOT: Record<string, string> = {
  ONLINE: "fill-emerald-500 text-emerald-500",
  BUSY: "fill-amber-500 text-amber-500",
  AWAY: "fill-slate-400 text-muted-foreground",
  OFFLINE: "fill-muted-foreground text-muted-foreground",
};

const STATUSES: Status[] = ["ONLINE", "BUSY", "AWAY", "OFFLINE"];

interface RoutingBoardProps {
  initialTeam: TeamAvailabilityRow[];
  initialDecisions: RoutingDecisionData[];
  teamError: string | null;
}

export function RoutingBoard({
  initialTeam,
  initialDecisions,
  teamError,
}: RoutingBoardProps) {
  const [team, setTeam] = React.useState<TeamAvailabilityRow[]>(initialTeam);
  const [decisions] =
    React.useState<RoutingDecisionData[]>(initialDecisions);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  // Per-row draft edits (status / capacity / skills / languages).
  const [draft, setDraft] = React.useState<
    Record<
      string,
      {
        status: Status;
        capacityLimit: number;
        eventTypeSkills: string;
        languages: string;
      }
    >
  >(() => {
    const init: RoutingBoardProps["initialTeam"] = initialTeam;
    const d: Record<
      string,
      { status: Status; capacityLimit: number; eventTypeSkills: string; languages: string }
    > = {};
    for (const r of init) {
      d[r.userId] = {
        status: r.status as Status,
        capacityLimit: r.capacityLimit,
        eventTypeSkills: r.eventTypeSkills.join(", "),
        languages: r.languages.join(", "),
      };
    }
    return d;
  });

  const refresh = React.useCallback(async () => {
    const res = await getTeamAvailability();
    if (res.success) {
      setTeam(res.data);
      setDraft((prev) => {
        const next = { ...prev };
        for (const r of res.data) {
          next[r.userId] = {
            status: r.status as Status,
            capacityLimit: r.capacityLimit,
            eventTypeSkills: r.eventTypeSkills.join(", "),
            languages: r.languages.join(", "),
          };
        }
        return next;
      });
    }
  }, []);

  function parseList(csv: string): string[] {
    return csv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function save(userId: string) {
    const d = draft[userId];
    if (!d) return;
    const cap = Number(d.capacityLimit);
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) {
      toast.error("Capacity must be between 1 and 500");
      return;
    }
    setSavingId(userId);
    const res = await setRepAvailabilityForUser(userId, {
      status: d.status,
      capacityLimit: cap,
      eventTypeSkills: parseList(d.eventTypeSkills),
      languages: parseList(d.languages),
    });
    setSavingId(null);
    if (!res.success) {
      toast.error(res.error || "Failed to save");
      return;
    }
    toast.success("Rep routing settings updated");
    await refresh();
  }

  function setField(
    userId: string,
    field: "status" | "capacityLimit" | "eventTypeSkills" | "languages",
    value: string | number
  ) {
    setDraft((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value },
    }));
  }

  const onlineCount = team.filter(
    (r) => r.status === "ONLINE" || r.status === "BUSY"
  ).length;

  return (
    <div className="space-y-6">
      {teamError && (
        <div className="rounded-2xl border bg-card px-5 py-4 text-sm text-muted-foreground shadow-card">
          {teamError === "Insufficient permissions"
            ? "You need the leads:assign permission to view the team availability board."
            : teamError}
        </div>
      )}

      {/* Team availability board */}
      <section className="rounded-2xl border bg-card shadow-card">
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
              <Users className="size-4 text-muted-foreground" />
              Team availability
            </h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Each rep&apos;s status, capacity and skills — the inputs SMART
              routing weighs when picking an owner.
            </p>
          </div>
          <StatusPill
            label={`${onlineCount} active`}
            hue={onlineCount > 0 ? "emerald" : "slate"}
            size="xs"
          />
        </div>
        <div className="space-y-4 px-5 py-5">
          {team.length === 0 && !teamError && (
            <EmptyState
              icon={<Users />}
              title="No routing profiles yet"
              description="Reps show up here the moment they set their availability from the top-bar chip. Until then, SMART rules fall back to round-robin."
            />
          )}

          {team.map((rep) => {
            const d = draft[rep.userId];
            const loadPct =
              rep.capacityLimit > 0
                ? Math.min(100, Math.round((rep.openLeadCount / rep.capacityLimit) * 100))
                : 0;
            return (
              <div
                key={rep.userId}
                className="rounded-xl border p-4 transition-shadow hover:shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Circle
                        className={cn("size-2.5", STATUS_DOT[rep.status])}
                      />
                      <span className="truncate text-sm font-medium">
                        {rep.user?.name || rep.user?.email || rep.userId}
                      </span>
                      {rep.user?.role && (
                        <StatusPill
                          label={rep.user.role}
                          hue="slate"
                          size="xs"
                          noDot
                        />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <Gauge className="mr-1 inline size-3" />
                      <span className="numeric">
                        {rep.openLeadCount}/{rep.capacityLimit}
                      </span>{" "}
                      open leads · <span className="numeric">{loadPct}%</span>{" "}
                      load
                      {rep.lastSeenAt && (
                        <>
                          {" "}
                          · last seen{" "}
                          {new Date(rep.lastSeenAt).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => save(rep.userId)}
                    disabled={savingId === rep.userId}
                  >
                    {savingId === rep.userId ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    Save
                  </Button>
                </div>

                {d && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={d.status}
                        onValueChange={(v) =>
                          setField(rep.userId, "status", v as Status)
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Capacity limit</Label>
                      <Input
                        type="number"
                        min={1}
                        max={500}
                        value={d.capacityLimit}
                        onChange={(e) =>
                          setField(
                            rep.userId,
                            "capacityLimit",
                            Number(e.target.value)
                          )
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Event-type skills</Label>
                      <Input
                        value={d.eventTypeSkills}
                        placeholder="WEDDING, CORPORATE"
                        onChange={(e) =>
                          setField(
                            rep.userId,
                            "eventTypeSkills",
                            e.target.value
                          )
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Languages</Label>
                      <Input
                        value={d.languages}
                        placeholder="en, hi, te"
                        onChange={(e) =>
                          setField(rep.userId, "languages", e.target.value)
                        }
                        className="h-9"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Routing decision audit feed */}
      <section className="rounded-2xl border bg-card shadow-card">
        <div className="border-b px-5 py-4">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
            <History className="size-4 text-muted-foreground" />
            Routing decisions
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            An audit trail of who each lead went to and why.
          </p>
        </div>
        {decisions.length === 0 ? (
          <EmptyState
            icon={<History />}
            title="No routing decisions yet"
            description="Once a SMART assignment rule routes its first lead, every decision it makes is logged here with the reasoning."
          />
        ) : (
          <div className="divide-y">
            {decisions.map((dec) => (
              <div
                key={dec.id}
                className="flex flex-wrap items-center gap-2 px-5 py-3 text-xs"
              >
                <StatusPill
                  label={dec.method}
                  hue={dec.method === "SMART" ? "violet" : "slate"}
                  size="xs"
                />
                <span className="text-[13px] font-medium">
                  {dec.assignedTo?.name ||
                    dec.assignedTo?.email ||
                    (dec.assignedToId ? dec.assignedToId : "Unassigned")}
                </span>
                <span className="text-muted-foreground">
                  load <span className="numeric">{dec.repLoadAtDecision}</span>
                </span>
                {dec.matchedEventType && (
                  <StatusPill label="event match" hue="emerald" size="xs" />
                )}
                {dec.matchedLanguage && (
                  <StatusPill label="language match" hue="blue" size="xs" />
                )}
                <span className="numeric ml-auto text-muted-foreground">
                  {new Date(dec.createdAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
