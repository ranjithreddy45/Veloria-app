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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AWAY: "fill-slate-400 text-slate-400",
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
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            {teamError === "Insufficient permissions"
              ? "You need the leads:assign permission to view the team availability board."
              : teamError}
          </CardContent>
        </Card>
      )}

      {/* Team availability board */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" />
            Team availability
            <Badge variant="secondary">{onlineCount} active</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {team.length === 0 && !teamError && (
            <p className="text-sm text-muted-foreground">
              No reps have a routing profile yet. Reps appear here once they set
              their availability from the top-bar chip, or you can configure one
              below as they join.
            </p>
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
                className="rounded-lg border border-border/70 p-4"
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
                        <Badge variant="outline" className="text-[10px]">
                          {rep.user.role}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <Gauge className="mr-1 inline size-3" />
                      {rep.openLeadCount}/{rep.capacityLimit} open leads ·{" "}
                      {loadPct}% load
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
        </CardContent>
      </Card>

      {/* Routing decision audit feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-primary" />
            Routing decisions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No SMART routing decisions recorded yet. They appear here as leads
              are routed by a SMART assignment rule.
            </p>
          ) : (
            <div className="space-y-2">
              {decisions.map((dec) => (
                <div
                  key={dec.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs"
                >
                  <Badge
                    variant={dec.method === "SMART" ? "default" : "secondary"}
                  >
                    {dec.method}
                  </Badge>
                  <span className="font-medium">
                    {dec.assignedTo?.name ||
                      dec.assignedTo?.email ||
                      (dec.assignedToId ? dec.assignedToId : "Unassigned")}
                  </span>
                  <span className="text-muted-foreground">
                    load {dec.repLoadAtDecision}
                  </span>
                  {dec.matchedEventType && (
                    <Badge variant="success" className="text-[10px]">
                      event match
                    </Badge>
                  )}
                  {dec.matchedLanguage && (
                    <Badge variant="outline" className="text-[10px]">
                      language match
                    </Badge>
                  )}
                  <span className="ml-auto text-muted-foreground">
                    {new Date(dec.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
