"use client";

import * as React from "react";
import { Circle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  getMyAvailability,
  setMyAvailability,
  touchMyHeartbeat,
} from "@/actions/rep-availability.actions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================
// AvailabilityToggle — top-bar chip; the logged-in rep flips their own
// ONLINE/BUSY/AWAY/OFFLINE (self-service) and a heartbeat keeps lastSeenAt
// fresh so SMART routing keeps them eligible. Mounted in the dashboard shell.
// ============================================================

type Status = "ONLINE" | "BUSY" | "AWAY" | "OFFLINE";

const STATUS_META: Record<
  Status,
  { label: string; dot: string; text: string }
> = {
  ONLINE: {
    label: "Online",
    dot: "fill-emerald-500 text-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  BUSY: {
    label: "Busy",
    dot: "fill-amber-500 text-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  AWAY: {
    label: "Away",
    dot: "fill-slate-400 text-muted-foreground",
    text: "text-slate-500 dark:text-slate-400",
  },
  OFFLINE: {
    label: "Offline",
    dot: "fill-muted-foreground text-muted-foreground",
    text: "text-muted-foreground",
  },
};

const HEARTBEAT_MS = 2 * 60 * 1000; // every 2 min keeps lastSeenAt fresh

export function AvailabilityToggle() {
  const { user } = useCurrentUser();
  const [status, setStatus] = React.useState<Status>("OFFLINE");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Load current availability once we have a session.
  React.useEffect(() => {
    let active = true;
    if (!user?.id) return;
    getMyAvailability().then((res) => {
      if (active && res.success) {
        setStatus(res.data.status as Status);
      }
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Heartbeat: keep lastSeenAt fresh while the app is open so an active rep
  // isn't auto-marked OFFLINE and excluded from SMART routing.
  React.useEffect(() => {
    if (!user?.id) return;
    // Immediate ping on mount, then on an interval.
    touchMyHeartbeat().catch(() => {});
    const id = window.setInterval(() => {
      touchMyHeartbeat().catch(() => {});
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [user?.id]);

  async function pick(next: Status) {
    if (next === status || saving) return;
    setSaving(true);
    const prev = status;
    setStatus(next);
    const res = await setMyAvailability(next);
    setSaving(false);
    if (!res.success) {
      setStatus(prev);
      toast.error(res.error || "Couldn't update availability");
      return;
    }
    setStatus(res.data.status as Status);
    toast.success(`You're now ${STATUS_META[res.data.status as Status].label}`);
  }

  // Hide entirely for non-internal users (no availability row concept).
  if (!user?.id || user.role === "CLIENT") return null;

  const meta = STATUS_META[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-9 gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 text-detail font-medium transition-all duration-200 hover:bg-muted/70 active:scale-[0.97]",
            meta.text
          )}
          title="Set your routing availability"
        >
          {loading || saving ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Circle className={cn("size-2.5", meta.dot)} />
          )}
          <span className="hidden sm:inline-block">{meta.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-44">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Routing availability
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(STATUS_META) as Status[]).map((s) => (
          <DropdownMenuItem
            key={s}
            className="cursor-pointer gap-2"
            onClick={() => pick(s)}
          >
            <Circle className={cn("size-2.5", STATUS_META[s].dot)} />
            <span>{STATUS_META[s].label}</span>
            {s === status && (
              <span className="ml-auto text-meta text-muted-foreground">
                current
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
