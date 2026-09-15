"use client";

// ============================================================
// ExtendHoldDialog — "Extend hold" on a booking that is on HOLD.
// ------------------------------------------------------------
// The team is told to extend a hold before taking an online payment on one
// whose window has passed (STAFF_HOLD_CHECKOUT_ERROR in
// src/lib/holds/checkout-guard.ts). This picks how long from now the hold runs,
// within what placeHold accepts (whole hours, 1 to 168), and calls placeHold,
// which checks everything again: the booking is still on hold, the new end is
// later than the current one, and a hold whose window has passed only gets its
// date back while the slot is still free. A refusal is shown in the dialog.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { placeHold } from "@/actions/booking.actions";
import {
  EXTEND_HOLD_LABEL,
  EXTEND_HOLD_PRESET_HOURS,
  HOLD_HOURS_MAX,
  HOLD_HOURS_MIN,
  isValidHoldHours,
} from "@/lib/holds/hold-extension";

const DEFAULT_HOURS = "24";

/** 4 → "4 hours", 24 → "1 day", 168 → "7 days". */
function durationLabel(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "1 day" : `${days} days`;
  }
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

export function ExtendHoldDialog({
  bookingId,
  open,
  onOpenChange,
}: {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [hours, setHours] = React.useState(DEFAULT_HOURS);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const parsed = Number(hours);
  const valid = hours.trim() !== "" && isValidHoldHours(parsed);

  function close() {
    onOpenChange(false);
    setHours(DEFAULT_HOURS);
    setError(null);
  }

  function pick(value: string) {
    setHours(value);
    setError(null);
  }

  async function submit() {
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await placeHold(bookingId, parsed);
      if (result.success) {
        const endsAt = result.data?.holdExpiresAt;
        toast.success(endsAt ? `Hold extended until ${format(new Date(endsAt), "d MMM yyyy, h:mm a")}` : "Hold extended");
        close();
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch {
      setError("Couldn't extend the hold. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) onOpenChange(true);
        else close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{EXTEND_HOLD_LABEL}</DialogTitle>
          <DialogDescription>
            Keep this date held for longer. The hold runs for the time you pick, counted from now, and must end
            later than it does at the moment. If its window has already passed, the date is held again only if it
            is still free.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="extend-hold-hours">Hold for</Label>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick picks">
            {EXTEND_HOLD_PRESET_HOURS.map((h) => (
              <Button
                key={h}
                type="button"
                size="sm"
                variant={valid && parsed === h ? "default" : "outline"}
                aria-pressed={valid && parsed === h}
                onClick={() => pick(String(h))}
                disabled={pending}
              >
                {durationLabel(h)}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="extend-hold-hours"
              type="number"
              inputMode="numeric"
              min={HOLD_HOURS_MIN}
              max={HOLD_HOURS_MAX}
              step={1}
              value={hours}
              onChange={(e) => pick(e.target.value)}
              className="w-28"
              disabled={pending}
            />
            <span className="text-sm text-muted-foreground">hours from now</span>
          </div>
          {!valid && (
            <p className="text-xs text-destructive">
              Choose a whole number of hours from {HOLD_HOURS_MIN} to {HOLD_HOURS_MAX} (7 days).
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !valid}>
            {pending ? "Extending…" : EXTEND_HOLD_LABEL}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
