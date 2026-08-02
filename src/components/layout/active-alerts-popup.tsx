"use client";

// ============================================================
// Active Alerts Popup (requirement 4)
// ------------------------------------------------------------
// A fixed, bottom-right, persistent popup that nags the current user about
// unresolved must-act items (pending tasks + SLA breaches). It:
//   - polls getActiveAlerts() on mount and every ~60s,
//   - STAYS on screen as long as any unresolved alert exists (collapsing it
//     just minimises to a badge; the next poll re-expands if new items arrive),
//   - plays a short Web Audio chime when NEW alert ids appear (autoplay-safe:
//     only after the first user interaction; mute toggle persisted in
//     localStorage),
//   - lets the user open the related lead/booking/notification, and
//     "Mark done" a task (→ updateCrmTaskStatus DONE, then re-polls).
// Renders nothing when there are no alerts.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getActiveAlerts,
  type ActiveAlertsResult,
} from "@/actions/active-alerts.actions";
import { updateCrmTaskStatus } from "@/actions/crm-task.actions";

const POLL_MS = 60_000;
const MUTE_KEY = "veloria.activeAlerts.muted";
const COLLAPSE_KEY = "veloria.activeAlerts.collapsed";
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
  // Minimising has to survive a page change. This panel remounts on every
  // navigation, so a non-persisted `collapsed` meant the thing you just
  // dismissed reappeared, expanded, on the very next click — which reads as
  // the app ignoring you. The nag itself is deliberate and stays: new alerts
  // still re-expand it (see the poll effect). This only remembers the choice
  // you already made about the alerts you have already seen.
  const [collapsed, setCollapsed] = useState(true);
  const [muted, setMuted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Refs that must survive re-renders without triggering effects.
  const prevIdsRef = useRef<Set<string>>(new Set());
  // The FIRST poll must not count pre-existing alerts as "new".
  //
  // prevIdsRef starts empty, so without this every alert already on your plate
  // looked brand new on mount — the panel auto-expanded and chimed on every
  // single page load. On a data-dense page it sat on top of the right-hand
  // third of the table, hiding whole columns. Nagging you about something you
  // saw an hour ago is not urgency, it is noise, and it cost real screen.
  const firstLoadRef = useRef(true);
  const interactedRef = useRef(false);
  const mutedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ---- Autoplay guard: mark that the user has interacted at least once ----
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

  // ---- Restore mute preference ----
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MUTE_KEY) === "1";
      // Restore the minimise choice alongside the mute choice.
      if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
      setMuted(stored);
      mutedRef.current = stored;
    } catch {
      /* ignore */
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
      // Two-note ping (E6 -> A6) for a clear, non-annoying "attention" chime.
      const notes = [1318.51, 1760.0];
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
      /* audio not available — silently ignore */
    }
  }, []);

  // ---- Poll ----
  const load = useCallback(async () => {
    try {
      const res = await getActiveAlerts();
      const nextIds = new Set<string>([
        ...res.tasks.map((t) => `t:${t.id}`),
        ...res.sla.map((s) => `s:${s.id}`),
      ]);

      // NEW alert = id present now that was not in the previous poll.
      // On the first poll we only take a baseline — nothing is "new" yet.
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
      if (hasNew && res.total > 0) {
        // A fresh alert arrived — re-expand and chime so it nags.
        setCollapsed(false);
        playChime();
      }
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
        /* ignore */
      }
      return next;
    });
  }, []);

  const markDone = useCallback(
    async (taskId: string) => {
      setBusyId(taskId);
      try {
        await updateCrmTaskStatus(taskId, "DONE");
        // Optimistically drop it, then re-poll for the source of truth.
        setData((d) => ({
          ...d,
          tasks: d.tasks.filter((t) => t.id !== taskId),
          total: d.total - 1,
        }));
        await load();
      } catch {
        /* ignore — next poll will reconcile */
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  // No unresolved alerts → render nothing.
  if (data.total === 0) return null;

  const overdueCount =
    data.tasks.filter((t) => t.isOverdue).length + data.sla.length;

  // ---- Collapsed pill ----
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => {
          setCollapsed(false);
          try { localStorage.removeItem(COLLAPSE_KEY); } catch { /* private mode */ }
        }}
        className={cn(
          "fixed bottom-[calc(1rem+max(var(--sab),0px))] right-4 z-[60] flex items-center gap-2 rounded-full border px-4 py-2.5 shadow-lg transition-transform hover:scale-105",
          // The pill keeps red ONLY when something is genuinely overdue.
          // Otherwise it sits in the brand's emerald with a gold hairline —
          // present and clickable, without pretending to be an emergency.
          overdueCount > 0
            ? "border-destructive/30 bg-destructive text-white"
            : "border-gold/40 bg-primary text-white"
        )}
        aria-label={`${data.total} active alerts`}
      >
        <AlertTriangle className="h-4 w-4" />
        <span className="text-copy font-semibold">{data.total} alert{data.total > 1 ? "s" : ""}</span>
      </button>
    );
  }

  const visibleTasks = data.tasks.slice(0, MAX_VISIBLE);
  const remainingSlots = Math.max(0, MAX_VISIBLE - visibleTasks.length);
  const visibleSla = data.sla.slice(0, remainingSlots);
  const hiddenCount =
    data.total - visibleTasks.length - visibleSla.length;

  return (
    <div className="fixed bottom-[calc(1rem+max(var(--sab),0px))] right-4 z-[60] w-[min(92vw,22rem)]">
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_16px_40px_-12px_oklch(0_0_0/0.22)]">
        {/* Header */}
        {/* The header was a red-to-amber gradient — warning tape on a brand
            built from deep emerald and gold. It shouted on every page and made
            the whole app look like an incident dashboard. A panel that is
            ALWAYS on screen cannot also be maximally loud; if everything is an
            emergency, nothing reads as one.

            So: the brand's own dark surface, and red kept in reserve for the
            one number that genuinely means "late". Colour earns its urgency
            by being rare. */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-primary px-4 py-2.5 text-white">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-gold-bright" />
            <span className="text-copy font-semibold tracking-[-0.01em]">
              Needs your attention
            </span>
            <Badge
              className={cn(
                "border-transparent",
                overdueCount > 0
                  ? "bg-destructive text-white"
                  : "bg-white/15 text-white"
              )}
            >
              {data.total}
            </Badge>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-md p-1.5 hover:bg-white/20"
              aria-label={muted ? "Unmute alert sound" : "Mute alert sound"}
              title={muted ? "Sound off" : "Sound on"}
            >
              {muted ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setCollapsed(true);
                try { localStorage.setItem(COLLAPSE_KEY, "1"); } catch { /* private mode */ }
              }}
              className="rounded-md p-1.5 hover:bg-white/20"
              aria-label="Minimise"
              title="Minimise"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
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
                    t.isOverdue
                      ? "text-destructive"
                      : "text-muted-foreground"
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
                    <Link href={taskHref(t)}>
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
                      <Link href={s.actionUrl}>
                        Resolve <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {hiddenCount > 0 && (
          <div className="border-t border-border bg-muted/40 px-4 py-2 text-center text-xs text-muted-foreground">
            + {hiddenCount} more —{" "}
            <Link href="/calendar" className="font-medium underline">
              view all
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
