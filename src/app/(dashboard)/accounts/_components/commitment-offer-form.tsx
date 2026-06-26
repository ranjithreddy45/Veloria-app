"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { LockIcon, SaveIcon, PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setCommitmentOffer } from "@/actions/corporate-account.actions";

// ============================================================
// Commitment offer panel — "book N/year → locked per-plate pricing"
// ============================================================
// lockedPricePerPlate is an ADVISORY snapshot. It is never auto-applied to a
// quotation; reps apply it manually via the quotation per-plate override.

interface CommitmentOfferFormProps {
  accountId: string;
  committedEventsPerYear: number;
  lockedPricePerPlate: number | null;
  commitmentStart: string | null;
  commitmentEnd: string | null;
  canManage: boolean;
}

function toDateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd");
}

export function CommitmentOfferForm({
  accountId,
  committedEventsPerYear,
  lockedPricePerPlate,
  commitmentStart,
  commitmentEnd,
  canManage,
}: CommitmentOfferFormProps) {
  const router = useRouter();
  const hasOffer = committedEventsPerYear > 0 || lockedPricePerPlate != null;
  const [editing, setEditing] = React.useState(!hasOffer && canManage);
  const [saving, setSaving] = React.useState(false);

  const [events, setEvents] = React.useState(String(committedEventsPerYear || ""));
  const [price, setPrice] = React.useState(
    lockedPricePerPlate != null ? String(lockedPricePerPlate) : ""
  );
  const [start, setStart] = React.useState(toDateInput(commitmentStart));
  const [end, setEnd] = React.useState(toDateInput(commitmentEnd));

  async function handleSave() {
    const eventsNum = Number(events || 0);
    const priceNum = price.trim() === "" ? null : Number(price);
    if (priceNum != null && (!isFinite(priceNum) || priceNum <= 0)) {
      toast.error("Locked price must be a positive amount");
      return;
    }
    if (!Number.isInteger(eventsNum) || eventsNum < 0) {
      toast.error("Committed events must be a whole number");
      return;
    }

    setSaving(true);
    try {
      const res = await setCommitmentOffer(accountId, {
        committedEventsPerYear: eventsNum,
        lockedPricePerPlate: priceNum,
        commitmentStart: start || null,
        commitmentEnd: end || null,
      });
      if (res.success) {
        toast.success("Commitment offer saved");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <LockIcon className="size-4 text-emerald-600" />
          Multi-event commitment
        </CardTitle>
        {canManage && !editing && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <PencilIcon className="size-3.5" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!editing ? (
          hasOffer ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Committed events / year</dt>
                <dd className="font-medium">{committedEventsPerYear || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Locked price / plate</dt>
                <dd className="font-medium text-emerald-700">
                  {lockedPricePerPlate != null
                    ? `₹${lockedPricePerPlate.toLocaleString("en-IN")}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">From</dt>
                <dd className="font-medium">
                  {commitmentStart ? format(new Date(commitmentStart), "dd MMM yyyy") : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">To</dt>
                <dd className="font-medium">
                  {commitmentEnd ? format(new Date(commitmentEnd), "dd MMM yyyy") : "—"}
                </dd>
              </div>
              <p className="col-span-2 mt-1 text-xs text-muted-foreground">
                Advisory rate — apply manually as the per-plate override on quotations.
              </p>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              No commitment offer recorded yet.
            </p>
          )
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="committed-events">Events / year</Label>
                <Input
                  id="committed-events"
                  type="number"
                  min={0}
                  step={1}
                  value={events}
                  onChange={(e) => setEvents(e.target.value)}
                  placeholder="3"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="locked-price">Locked price / plate (₹)</Label>
                <Input
                  id="locked-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="1250.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="commitment-start">From</Label>
                <Input
                  id="commitment-start"
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="commitment-end">To</Label>
                <Input
                  id="commitment-end"
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" onClick={handleSave} disabled={saving} className="gap-1.5">
                <SaveIcon className="size-4" />
                {saving ? "Saving…" : "Save offer"}
              </Button>
              {hasOffer && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
