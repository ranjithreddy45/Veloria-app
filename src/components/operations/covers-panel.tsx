"use client";

// ============================================================
// The two guest numbers, side by side.
//
// A Function Sheet and a kitchen plan are created at booking confirmation and
// stamped with the CONTRACTED count, because no RSVP exists yet. Later, replies
// arrive. This panel shows both, says which one the sheet is currently cooking
// to, and offers a deliberate button to switch — it never changes anything on
// its own.
//
// It also refuses to imply precision it hasn't got: heads whose party never
// answered the meal question are shown as "not answered", never rolled into
// non-veg, and the panel says plainly when nobody has been invited yet.
// ============================================================

import * as React from "react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { coversSourceLabel, type Headcount } from "@/lib/guests/headcount";
import { setBeoCoversFromRsvp, setKitchenCoversFromRsvp } from "@/actions/event-covers.actions";

export interface CoversPanelProps {
  /** Which sheet this panel belongs to — decides which action the button calls. */
  target: "beo" | "kitchen";
  targetId: string;
  /** What the sheet is cooking to right now. */
  covers: number | null;
  coversSource: string | null;
  headcount: Headcount;
  /** No guests on the list at all — nothing has been invited. */
  noGuestList: boolean;
  /** False hides the button (read-only viewer, locked sheet). */
  canEdit?: boolean;
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-meta text-muted-foreground uppercase tracking-[0.06em]">{label}</div>
      <div className="numeric text-title font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-meta text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export function CoversPanel({
  target,
  targetId,
  covers,
  coversSource,
  headcount,
  noGuestList,
  canEdit = true,
}: CoversPanelProps) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState<number | null>(covers);
  const [source, setSource] = useState<string | null>(coversSource);

  const { contractedHeads, confirmedHeads, awaitingHeads, meals } = headcount;
  const alreadyMatches = current === confirmedHeads && source === "RSVP_CONFIRMED";

  function apply() {
    start(async () => {
      const res =
        target === "beo"
          ? await setBeoCoversFromRsvp(targetId)
          : await setKitchenCoversFromRsvp(targetId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setCurrent(res.data.covers);
      setSource("RSVP_CONFIRMED");
      toast.success(`Covers set to ${res.data.covers} from confirmed RSVPs.`);
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/60 p-4">
      <div className="flex items-center gap-2">
        <Users className="text-muted-foreground size-4" aria-hidden />
        <h3 className="text-body font-semibold">Guest numbers</h3>
      </div>

      {noGuestList ? (
        <p className="text-detail text-muted-foreground">
          No guest list yet, so there are no replies to count. This sheet is cooking to the
          contracted guest count
          {contractedHeads != null ? ` of ${contractedHeads.toLocaleString("en-IN")}` : ""}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure
              label="Contracted"
              value={contractedHeads == null ? "—" : contractedHeads.toLocaleString("en-IN")}
              hint="agreed on the booking"
            />
            <Figure
              label="Confirmed"
              value={confirmedHeads.toLocaleString("en-IN")}
              hint="heads that replied yes"
            />
            <Figure
              label="Awaiting reply"
              value={awaitingHeads.toLocaleString("en-IN")}
              hint="still in play"
            />
            <Figure
              label="Cooking for"
              value={current == null ? "—" : current.toLocaleString("en-IN")}
              hint={coversSourceLabel(source)}
            />
          </div>

          <div className="text-detail">
            <span className="text-muted-foreground">Of the confirmed heads: </span>
            <span className="font-medium">{meals.veg} veg</span>
            <span className="text-muted-foreground"> · </span>
            <span className="font-medium">{meals.nonVeg} non-veg</span>
            <span className="text-muted-foreground"> · </span>
            <span className="font-medium">{meals.jain} Jain</span>
            {meals.unknown > 0 && (
              <>
                <span className="text-muted-foreground"> · </span>
                <span className="text-amber-700 font-medium">{meals.unknown} not answered</span>
              </>
            )}
          </div>

          {meals.unknown > 0 && (
            <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50/70 p-2.5 text-meta text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {meals.unknown} confirmed {meals.unknown === 1 ? "head has" : "heads have"} not said
                what they eat. They are left out of the split above rather than counted as non-veg.
              </span>
            </p>
          )}

          {canEdit && confirmedHeads > 0 && !alreadyMatches && (
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" onClick={apply} disabled={pending}>
                {pending ? "Updating…" : `Cook for the ${confirmedHeads.toLocaleString("en-IN")} confirmed`}
              </Button>
              <span className="text-meta text-muted-foreground">
                {awaitingHeads > 0
                  ? `${awaitingHeads} still haven't replied — this number can still rise.`
                  : "Everyone has replied."}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
