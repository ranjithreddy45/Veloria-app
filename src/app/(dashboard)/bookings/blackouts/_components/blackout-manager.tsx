"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Plus, Trash2 } from "lucide-react";

import {
  createBlackoutDate,
  deleteBlackoutDate,
} from "@/actions/booking.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

type TimeSlot = "MORNING" | "AFTERNOON" | "EVENING" | "FULL_DAY";

export interface BlackoutEntry {
  id: string;
  venueId: string;
  date: string;
  timeSlot: TimeSlot | null;
  reason: string | null;
  venue?: { id?: string; name: string } | null;
}

export interface BlackoutVenue {
  id: string;
  name: string;
}

interface BlackoutManagerProps {
  blackouts: BlackoutEntry[];
  venues: BlackoutVenue[];
}

const SLOT_LABELS: Record<TimeSlot, string> = {
  FULL_DAY: "Full Day",
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
};

const SLOT_OPTIONS: TimeSlot[] = ["FULL_DAY", "MORNING", "AFTERNOON", "EVENING"];

// ============================================================
// Blackout Manager
// ============================================================

export function BlackoutManager({ blackouts, venues }: BlackoutManagerProps) {
  const router = useRouter();

  const [venueId, setVenueId] = React.useState<string>("");
  const [date, setDate] = React.useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [timeSlot, setTimeSlot] = React.useState<TimeSlot>("FULL_DAY");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const canSubmit = Boolean(venueId) && Boolean(date) && !submitting;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!venueId || !date || submitting) return;
    setSubmitting(true);
    try {
      const res = await createBlackoutDate({
        venueId,
        date,
        // "Full Day" must persist as null so it blocks EVERY slot. Stored as
        // the literal "FULL_DAY" it would only collide with full-day bookings
        // and let morning/afternoon/evening bookings slip through.
        timeSlot: timeSlot === "FULL_DAY" ? null : timeSlot,
        reason: reason.trim() || undefined,
      });
      if (res.success) {
        toast.success("Date blocked");
        setDate(undefined);
        setReason("");
        setTimeSlot("FULL_DAY");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to block date");
      }
    } catch {
      toast.error("Failed to block date");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await deleteBlackoutDate(id);
      if (res.success) {
        toast.success("Blackout removed");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed to remove blackout");
      }
    } catch {
      toast.error("Failed to remove blackout");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Existing blackouts */}
      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-premium">
        <table className="w-full min-w-[480px] border-collapse text-body">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-meta font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Venue</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Slot</th>
              <th className="px-3 py-2 font-medium">Reason</th>
              <th className="px-3 py-2 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {blackouts.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  No blocked dates yet.
                </td>
              </tr>
            ) : (
              blackouts.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2.5 font-medium text-foreground">
                    {b.venue?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {format(new Date(b.date), "dd MMM yyyy")}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {b.timeSlot ? SLOT_LABELS[b.timeSlot] : "Full Day"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {b.reason || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(b.id)}
                      disabled={deletingId === b.id}
                      aria-label="Remove blackout"
                    >
                      {deletingId === b.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5 text-destructive" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Block a date form */}
      <form
        onSubmit={handleCreate}
        className="h-fit space-y-4 rounded-2xl border border-border/70 bg-card p-5 text-body shadow-premium"
      >
        <div className="text-body font-semibold tracking-[-0.01em] text-foreground">
          Block a date
        </div>

        <div className="grid gap-1.5">
          <Label className="text-detail text-muted-foreground">
            Venue <span className="text-destructive">*</span>
          </Label>
          <Select value={venueId || undefined} onValueChange={setVenueId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select venue" />
            </SelectTrigger>
            <SelectContent>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-detail text-muted-foreground">
            Date <span className="text-destructive">*</span>
          </Label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "w-full pl-3 text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                {date ? format(date, "dd MMM yyyy") : <span>Pick a date</span>}
                <CalendarIcon className="ml-auto size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  setDate(d);
                  setCalendarOpen(false);
                }}
                disabled={(d) =>
                  d < new Date(new Date().setHours(0, 0, 0, 0))
                }
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-detail text-muted-foreground">Time slot</Label>
          <Select
            value={timeSlot}
            onValueChange={(v) => setTimeSlot(v as TimeSlot)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLOT_OPTIONS.map((slot) => (
                <SelectItem key={slot} value={slot}>
                  {SLOT_LABELS[slot]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-detail text-muted-foreground">Reason</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Maintenance, private hold…"
          />
        </div>

        <Button type="submit" disabled={!canSubmit} className="w-full gap-1.5">
          {submitting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
          Block date
        </Button>
      </form>
    </div>
  );
}
