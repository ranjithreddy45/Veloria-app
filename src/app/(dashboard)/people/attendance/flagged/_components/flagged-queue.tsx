"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ShieldCheck, ShieldAlert, Loader2, MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { StatusPill, type Hue } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { clearAttendanceFlag, type FlaggedPunch } from "@/actions/hr-attendance.actions";

/** Format the punch date treating the ISO string as a UTC calendar day (records
 *  are @db.Date, UTC-midnight) so it never shifts across the runtime timezone. */
function fmtUtcDate(iso: string): string {
  const d = new Date(iso);
  const cal = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return format(cal, "EEE, d MMM yyyy");
}

/** Clock time rendered in IST (fixed +5:30) regardless of runtime timezone. */
function fmtIstTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

/** A verification chip whose hue reflects trust: verified/emerald, unverified/amber, no-geo/slate. */
function VerifyChip({ label, verified }: { label: string; verified: boolean | null }) {
  const hue: Hue = verified === true ? "emerald" : verified === false ? "amber" : "slate";
  const state = verified === true ? "Verified" : verified === false ? "Unverified" : "No geo";
  return <StatusPill size="xs" hue={hue} label={`${label} ${state}`} />;
}

export function FlaggedQueue({ punches, canClear }: { punches: FlaggedPunch[]; canClear: boolean }) {
  if (punches.length === 0) {
    return (
      <EmptyState
        tone="success"
        icon={<ShieldCheck />}
        title="No flagged check-ins"
        description="Everything is verified."
      />
    );
  }
  return (
    <div className="space-y-3">
      {punches.map((p) => (
        <FlaggedCard key={p.id} punch={p} canClear={canClear} />
      ))}
    </div>
  );
}

function FlaggedCard({ punch, canClear }: { punch: FlaggedPunch; canClear: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const hasCoords = punch.lat != null && punch.lng != null;
  const accuracyHigh = punch.accuracyM != null && punch.accuracyM > 100;

  async function clear() {
    setBusy(true);
    const res = await clearAttendanceFlag(punch.id, note.trim() || undefined);
    setBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    setOpen(false);
    setNote("");
    toast.success("Flag cleared.");
    router.refresh();
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={`/people/${punch.employeeId}`} className="font-medium hover:underline">
              {punch.name}
            </Link>
            <span className="text-[12px] text-muted-foreground">{punch.empCode}</span>
            <span className="text-[12px] text-muted-foreground">·</span>
            <span className="text-[13px] text-muted-foreground">{fmtUtcDate(punch.date)}</span>
          </div>

          {/* Why it's flagged — the headline of the card. */}
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[13px] text-amber-800 ring-1 ring-inset ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/50">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>{punch.flagReason ?? "Needs review."}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span>In: <span className="text-foreground">{fmtIstTime(punch.checkInAt)}</span></span>
            <span>Out: <span className="text-foreground">{fmtIstTime(punch.checkOutAt)}</span></span>
            <span>Site: <span className="text-foreground">{punch.siteName ?? "—"}</span></span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <VerifyChip label="In" verified={punch.locationVerified} />
            <VerifyChip label="Out" verified={punch.checkOutVerified} />
            {punch.accuracyM != null && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset",
                  accuracyHigh
                    ? "bg-amber-50 text-amber-700 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50"
                    : "bg-muted text-muted-foreground ring-border"
                )}
              >
                ±{Math.round(punch.accuracyM)}m
              </span>
            )}
            {hasCoords && (
              <a
                href={`https://www.google.com/maps?q=${punch.lat},${punch.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <MapPin className="size-3.5" /> Map <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-3">
          {punch.selfieUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={punch.selfieUrl}
              alt="Check-in selfie"
              className="size-14 shrink-0 rounded-lg border object-cover"
            />
          )}
          {canClear && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ShieldCheck className="size-3.5" /> Clear flag
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clear flag</DialogTitle>
                  <DialogDescription>
                    Confirm you&apos;ve reviewed {punch.name}&apos;s check-in on {fmtUtcDate(punch.date)}. Add an optional note for the audit trail.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor={`clear-note-${punch.id}`}>Review note (optional)</Label>
                  <Textarea
                    id={`clear-note-${punch.id}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Confirmed with manager — genuine field visit."
                    rows={3}
                  />
                </div>
                <DialogFooter showCloseButton>
                  <Button onClick={clear} disabled={busy} className="gap-1.5">
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />} Clear flag
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
}
