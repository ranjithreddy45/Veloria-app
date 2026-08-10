"use client";

// ============================================================
// Active Alerts — the signed-in user's unresolved must-act items.
//
// WAS: a fixed bottom-right panel pinned above everything at z-[60]. It sat
// directly on top of the AI chat button (bottom-right, z-50) and, on a phone,
// over the last row of whatever page you were on. A permanently-docked overlay
// in the corner where the app already puts controls is a navigation obstacle,
// not an alert.
//
// NOW: a header control next to the notification bell, opening an anchored
// popover. It occupies no page space, covers nothing, and sits where this app
// already teaches people to look for things demanding attention.
//
// It also no longer forces itself open. The old panel re-expanded on every new
// alert; from the header that would mean a popover appearing under the cursor
// mid-click. New alerts now move the badge and (optionally) chime — noticeable
// without seizing the pointer. The nag is still there; it stopped grabbing.
//
// Scope is enforced server-side in getActiveAlerts() — tasks assigned to this
// user, plus alerts naming this user. Company-wide SYSTEM broadcasts are
// deliberately excluded there; they live in the notifications centre.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  ExternalLink,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getActiveAlerts,
  type ActiveAlertsResult,
} from "@/actions/active-alerts.actions";
import { updateCrmTaskStatus } from "@/actions/crm-task.actions";

const POLL_MS = 60_000;
const MUTE_KEY = "veloria.activeAlerts.muted";
const MAX_VISIBLE = 4;

const EMPTY: ActiveAlertsResult = { tasks: [], sla: [], total: 0 };

function taskHref(t: { leadId: string | null; bookingId: string | null }): string {
  if (t.leadId) return `/leads/${t.leadId}`;
  if (t.bookingId) return `/bookings/${t.bookingId}`;
  return "/calendar";
}

function relativeDue(iso: string, isOverdue: boolean): string {
  const d = new Date(iso);
  const diffMin = Math.round((d.getTime() - Date.now()) / 60000);
  const abs = Math.abs(diffMin);
  let unit: string;
  if (abs < 60) unit = `${abs}m`;
  else if (abs < 60 * 24) unit = `${Math.round(abs / 60)}h`;
  else unit = `${Math.round(abs / (60 * 24))}d`;
  return isOverdue ? `overdue ${unit}` : `due in ${unit}`;
}

export function ActiveAlertsPopup() {
  const [data, setData] = useState<ActiveAlertsResult>(EMPTY);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const prevIdsRef = useRef<Set<string>>(new Set());
  // The FIRST poll must not count pre-existing alerts as "new" — otherwise
  // everything already on your plate chimes on every page load.
  const firstLoadRef = useRef(true);
  const interactedRef = useRef(false);
  const mutedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ---- Autoplay guard: browsers reject audio before a user gesture ----
  useEffect(() => {
    const mark = () => {
      interactedRef.current = true;
    };
    const opts = { once: true, passive: true } as const;
    window.addEventListener("pointerdown", mark, opts);
    window.addEventListener("keydown", mark, opts);
    return () => {
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(MUTE_KEY) === "1";
      setMuted(stored);
      mutedRef.current = stored;
    } catch {
      /* private mode */
    }
  }, []);

  // ---- Short oscillator chime (no audio asset needed) ----
  const playChime = useCallback(() => {
    if (mutedRef.current || !interactedRef.current) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      let ctx = audioCtxRef.current;
      if (!ctx) {
        ctx = new Ctx();
        audioCtxRef.current = ctx;
      }
      if (ctx.state === "suspended") void ctx.resume();

      const now = ctx.currentTime;
      const notes = [1318.51, 1760.0]; // E6 → A6
      notes.forEach((freq, i) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.16;
        const end = start + 0.18;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(gain);
        gain.connect(ctx!.destination);
        osc.start(start);
        osc.stop(end + 0.02);
      });
    } catch {
      /* audio unavailable — ignore */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await getActiveAlerts();
      const nextIds = new Set<string>([
        ...res.tasks.map((t) => `t:${t.id}`),
        ...res.sla.map((s) => `s:${s.id}`),
      ]);

      let hasNew = false;
      if (!firstLoadRef.current) {
        for (const id of nextIds) {
          if (!prevIdsRef.current.has(id)) {
            hasNew = true;
            break;
          }
        }
      }
      firstLoadRef.current = false;
      prevIdsRef.current = nextIds;

      setData(res);
      // Chime only. Auto-opening a header popover would land it under the
      // pointer mid-click — the exact "affecting navigation" problem that moving
      // this out of the corner was meant to solve.
      if (hasNew && res.total > 0) playChime();
    } catch {
      /* keep previous data on transient failure */
    }
  }, [playChime]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      mutedRef.current = next;
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);

  const markDone = useCallback(
    async (taskId: string) => {
      setBusyId(taskId);
      try {
        await updateCrmTaskStatus(taskId, "DONE");
        setData((d) => ({
          ...d,
          tasks: d.tasks.filter((t) => t.id !== taskId),
          total: d.total - 1,
        }));
        await load();
      } catch {
        /* next poll reconciles */
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  // Nothing outstanding → no control at all. An always-present "0 alerts"
  // button is chrome that teaches people to ignore the spot.
  if (data.total === 0) return null;

  const overdueCount =
    data.tasks.filter((t) => t.isOverdue).length + data.sla.length;

  const visibleTasks = data.tasks.slice(0, MAX_VISIBLE);
  const remainingSlots = Math.max(0, MAX_VISIBLE - visibleTasks.length);
  const visibleSla = data.sla.slice(0, remainingSlots);
  const hiddenCount = data.total - visibleTasks.length - visibleSla.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 text-muted-foreground"
          aria-label={`${data.total} item${data.total > 1 ? "s" : ""} need your attention`}
          title="Needs your attention"
        >
          <AlertTriangle className="size-4" />
          <Badge
            className={cn(
              "absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center border-0 p-0 text-meta",
              // Red is reserved for genuinely late work, so that when it does
              // appear it still means something.
              overdueCount > 0
                ? "bg-destructive text-white"
                : "bg-primary text-primary-foreground"
            )}
          >
            {data.total}
          </Badge>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[min(380px,calc(100vw-1rem))] p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-gold-bright" />
            <span className="text-copy font-semibold tracking-[-0.01em]">
              Needs your attention
            </span>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label={muted ? "Unmute alert sound" : "Mute alert sound"}
            title={muted ? "Sound off" : "Sound on"}
          >
            {muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          </button>
        </div>

        <div className="max-h-[60vh] divide-y divide-border overflow-y-auto">
          {visibleTasks.map((t) => (
            <div key={t.id} className="flex items-start gap-3 px-4 py-3">
              <div
                className={cn(
                  "mt-0.5 rounded-md p-1.5",
                  t.isOverdue
                    ? "bg-destructive/10 text-destructive"
                    : "bg-warning/10 text-warning"
                )}
              >
                <ListTodo className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {t.title}
                </p>
                <p
                  className={cn(
                    "mt-0.5 flex items-center gap-1 text-xs",
                    t.isOverdue ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  <Clock className="h-3 w-3" />
                  {relativeDue(t.dueDate, t.isOverdue)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                  >
                    <Link href={taskHref(t)} onClick={() => setOpen(false)}>
                      Open <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={busyId === t.id}
                    onClick={() => markDone(t.id)}
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {busyId === t.id ? "…" : "Mark done"}
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {visibleSla.map((s) => (
            <div key={s.id} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5 rounded-md bg-destructive/10 p-1.5 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {s.title}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {s.message}
                </p>
                {s.actionUrl && (
                  <div className="mt-2">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                    >
                      <Link href={s.actionUrl} onClick={() => setOpen(false)}>
                        Resolve <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {hiddenCount > 0 && (
          <div className="border-t border-border bg-muted/40 px-4 py-2 text-center text-xs text-muted-foreground">
            + {hiddenCount} more —{" "}
            <Link
              href="/calendar"
              className="font-medium underline"
              onClick={() => setOpen(false)}
            >
              view all
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
