"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getVisitAvailability,
  cancelVisitByToken,
  rescheduleVisitByToken,
} from "@/actions/public-site-visit.actions";
import type { VisitSlotOption } from "@/lib/site-visit/slots";

// ============================================================
// PUBLIC client — token-scoped manage controls (Cancel + Reschedule).
// Optimistic transitions; the token is the only credential.
// ============================================================

function isoToDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function maxISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));
}

export function VisitManage({
  token,
  scheduledAtISO,
}: {
  token: string;
  scheduledAtISO: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "reschedule">("idle");

  const [dateISO, setDateISO] = useState(isoToDate(scheduledAtISO));
  const [slots, setSlots] = useState<VisitSlotOption[]>([]);
  const [slotIso, setSlotIso] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (mode !== "reschedule" || !dateISO) return;
    let active = true;
    setLoadingSlots(true);
    setSlotIso("");
    getVisitAvailability(dateISO)
      .then((res) => {
        if (!active) return;
        setSlots(res.success ? res.data : []);
      })
      .finally(() => active && setLoadingSlots(false));
    return () => {
      active = false;
    };
  }, [dateISO, mode]);

  function handleCancel() {
    if (!confirm("Cancel this visit? You can always book another time.")) return;
    startTransition(async () => {
      const res = await cancelVisitByToken(token);
      if (res.success) {
        toast.success("Visit cancelled.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleReschedule() {
    if (!slotIso) {
      toast.error("Pick a new time.");
      return;
    }
    startTransition(async () => {
      const res = await rescheduleVisitByToken(token, slotIso);
      if (res.success) {
        toast.success("Visit rescheduled — we'll re-confirm shortly.");
        setMode("idle");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  if (mode === "reschedule") {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Pick a new time
          </p>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <input
          type="date"
          value={dateISO}
          min={isoToDate(new Date().toISOString())}
          max={maxISO()}
          onChange={(e) => setDateISO(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />

        {loadingSlots ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading times…
          </div>
        ) : slots.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">No times on this date.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => {
              const active = s.iso === slotIso;
              return (
                <button
                  key={s.time}
                  type="button"
                  disabled={!s.available}
                  onClick={() => setSlotIso(s.iso)}
                  className={`rounded-xl border px-2 py-2 text-sm font-medium transition ${
                    active
                      ? "border-primary bg-primary text-white"
                      : s.available
                        ? "border-border bg-card text-muted-foreground hover:border-primary"
                        : "cursor-not-allowed border-border bg-muted text-muted-foreground/60"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        <Button
          onClick={handleReschedule}
          disabled={!slotIso || pending}
          className="w-full bg-primary hover:bg-primary/90"
        >
          {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Confirm new time
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        variant="outline"
        onClick={() => setMode("reschedule")}
        disabled={pending}
        className="flex-1"
      >
        Reschedule
      </Button>
      <Button
        variant="ghost"
        onClick={handleCancel}
        disabled={pending}
        className="flex-1 text-destructive hover:bg-destructive/10"
      >
        Cancel visit
      </Button>
    </div>
  );
}
