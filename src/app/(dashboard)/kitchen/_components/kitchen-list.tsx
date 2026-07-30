"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ChefHat, IndianRupee, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusPill } from "@/components/shared/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { formatINR } from "@/lib/utils";
import {
  type KitchenPlanRowDTO,
  type BookableEventDTO,
  getBookableEvents,
  createKitchenPlan,
} from "@/actions/kitchen.actions";
import { STATUS_LABEL, statusHue, fmtEventDate } from "./kitchen-format";

export function KitchenList({
  plans,
  canWrite,
}: {
  plans: KitchenPlanRowDTO[];
  canWrite: boolean;
}) {
  const active = plans.filter((p) => p.status !== "COMPLETED").length;
  const totalEst = plans.reduce((a, p) => a + p.estFoodCost, 0);
  const coversTotal = plans.reduce((a, p) => a + p.covers, 0);
  const avgPerCover = coversTotal > 0 ? totalEst / coversTotal : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Active plans"
          value={active}
          accent="amber"
          icon={<ChefHat className="size-4" />}
        />
        <StatTile label="Total plans" value={plans.length} accent="indigo" />
        <StatTile
          label="Total est. food cost"
          value={formatINR(totalEst)}
          accent="emerald"
          icon={<IndianRupee className="size-4" />}
        />
        <StatTile
          label="Avg cost / cover"
          value={formatINR(avgPerCover)}
          accent="gold"
          icon={<Users className="size-4" />}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Production plans</h2>
            {canWrite && <NewPlanDialog />}
          </div>

          {plans.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<ChefHat className="size-6" />}
                title="No kitchen plans yet"
                description={
                  canWrite
                    ? "Create a production plan for a confirmed event to start food-costing."
                    : "No production plans have been created yet."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Event</th>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 text-right font-medium">Covers</th>
                    <th className="px-4 py-2.5 text-right font-medium">Est. food cost</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cost / cover</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr
                      key={p.id}
                      className="group border-b last:border-0 transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/kitchen/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.eventName ?? "Untitled event"}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {p.itemCount} item{p.itemCount === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {fmtEventDate(p.eventDate)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{p.covers}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {formatINR(p.estFoodCost)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatINR(p.perCoverCost)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill
                          label={STATUS_LABEL[p.status] ?? p.status}
                          hue={statusHue(p.status)}
                          size="xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewPlanDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [events, setEvents] = React.useState<BookableEventDTO[]>([]);
  const [loadingEv, setLoadingEv] = React.useState(false);
  const [bookingId, setBookingId] = React.useState("");
  const [covers, setCovers] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open || events.length > 0) return;
    setLoadingEv(true);
    getBookableEvents()
      .then((res) => {
        if (res.success) setEvents(res.data);
        else toast.error(res.error);
      })
      .finally(() => setLoadingEv(false));
  }, [open, events.length]);

  // Prefill covers from the picked event's guest count.
  function handlePickEvent(id: string) {
    setBookingId(id);
    const ev = events.find((e) => e.id === id);
    if (ev && !covers) setCovers(String(ev.guestCount));
  }

  async function handleCreate() {
    if (!bookingId) {
      toast.error("Select an event");
      return;
    }
    if (covers) {
      const coversNum = Number(covers);
      if (!Number.isFinite(coversNum) || coversNum <= 0) {
        toast.error("Covers must be a positive number");
        return;
      }
    }
    setSubmitting(true);
    const res = await createKitchenPlan({
      bookingId,
      covers: covers ? Number(covers) : undefined,
    });
    setSubmitting(false);
    if (res.success) {
      toast.success("Kitchen plan created");
      setOpen(false);
      router.push(`/kitchen/${res.data.id}`);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New plan
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New kitchen plan</DialogTitle>
          <DialogDescription>
            Pick a confirmed event. Covers prefill from its guest count.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <Label>Event</Label>
            <Select value={bookingId} onValueChange={handlePickEvent} disabled={loadingEv}>
              <SelectTrigger>
                <SelectValue placeholder={loadingEv ? "Loading…" : "Select event"} />
              </SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loadingEv && events.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No confirmed events available.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="kitchen-covers">Covers</Label>
            <Input
              id="kitchen-covers"
              type="number"
              min={0}
              value={covers}
              onChange={(e) => setCovers(e.target.value)}
              placeholder="Number of plates"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating…" : "Create plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
