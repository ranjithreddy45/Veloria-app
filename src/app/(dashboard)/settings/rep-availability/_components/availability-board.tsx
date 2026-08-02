"use client";

import * as React from "react";
import { Loader2Icon, RadioIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";

import {
  setMyAvailability,
  setRepAvailabilityForUser,
  type TeamAvailabilityRow,
} from "@/actions/rep-availability.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Status = "ONLINE" | "BUSY" | "AWAY" | "OFFLINE";

const STATUSES: Status[] = ["ONLINE", "BUSY", "AWAY", "OFFLINE"];

const STATUS_STYLES: Record<Status, string> = {
  ONLINE:
    "bg-success/10 text-success border-success/20",
  BUSY: "bg-warning/10 text-warning border-warning/20",
  AWAY: "bg-muted text-muted-foreground border-border",
  OFFLINE:
    "bg-muted text-muted-foreground border-border",
};

interface AvailabilityBoardProps {
  rows: TeamAvailabilityRow[];
  myStatus: string;
}

export function AvailabilityBoard({ rows, myStatus }: AvailabilityBoardProps) {
  const [selfStatus, setSelfStatus] = React.useState<Status>(
    (STATUSES.includes(myStatus as Status) ? myStatus : "OFFLINE") as Status
  );
  const [savingSelf, setSavingSelf] = React.useState(false);
  const [pendingUser, setPendingUser] = React.useState<string | null>(null);

  async function onSelfStatus(next: Status) {
    setSelfStatus(next);
    setSavingSelf(true);
    try {
      const res = await setMyAvailability(next);
      if (res.success) {
        toast.success(`You're now ${next.toLowerCase()}`);
      } else {
        toast.error(res.error || "Couldn't update your status");
      }
    } finally {
      setSavingSelf(false);
    }
  }

  async function onRepStatus(userId: string, next: Status) {
    setPendingUser(userId);
    try {
      const res = await setRepAvailabilityForUser(userId, { status: next });
      if (res.success) {
        toast.success("Rep status updated");
      } else {
        toast.error(res.error || "Couldn't update rep status");
      }
    } finally {
      setPendingUser(null);
    }
  }

  const cap = (row: TeamAvailabilityRow) =>
    row.capacityLimit > 0
      ? Math.min(100, Math.round((row.openLeadCount / row.capacityLimit) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Self status toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RadioIcon className="h-4 w-4" />
            My status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={selfStatus === s ? "default" : "outline"}
                disabled={savingSelf}
                onClick={() => onSelfStatus(s)}
              >
                {savingSelf && selfStatus === s ? (
                  <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Set yourself ONLINE to receive smart-routed inbound enquiries.
          </p>
        </CardContent>
      </Card>

      {/* Team board */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersIcon className="h-4 w-4" />
            Team availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No reps have set their availability yet.
            </p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => {
                const status = (
                  STATUSES.includes(row.status as Status) ? row.status : "OFFLINE"
                ) as Status;
                return (
                  <div
                    key={row.userId}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {row.user?.name || row.user?.email || "Unknown rep"}
                        </span>
                        <Badge
                          variant="outline"
                          className={STATUS_STYLES[status]}
                        >
                          {status}
                        </Badge>
                      </div>

                      {/* Skills + languages */}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {row.eventTypeSkills.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            No event-type skills
                          </span>
                        ) : (
                          row.eventTypeSkills.map((sk) => (
                            <Badge key={sk} variant="secondary" className="text-meta">
                              {sk}
                            </Badge>
                          ))
                        )}
                        {row.languages.map((lng) => (
                          <Badge key={lng} variant="outline" className="text-meta">
                            {lng}
                          </Badge>
                        ))}
                      </div>

                      {/* Load bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${cap(row)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {row.openLeadCount}/{row.capacityLimit} open
                        </span>
                      </div>
                    </div>

                    {/* Admin override */}
                    <div className="flex items-center gap-2">
                      {pendingUser === row.userId ? (
                        <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : null}
                      <Select
                        value={status}
                        onValueChange={(v) => onRepStatus(row.userId, v as Status)}
                        disabled={pendingUser === row.userId}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s.charAt(0) + s.slice(1).toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
