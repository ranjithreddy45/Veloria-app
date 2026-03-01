"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontalIcon } from "lucide-react";
import { toast } from "sonner";

import { adjustPoints } from "@/actions/loyalty.actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// Types
// ============================================================

interface AdjustPointsDialogProps {
  accountId: string;
  currentPoints: number;
  contactName: string;
}

// ============================================================
// Adjust Points Dialog
// ============================================================

export function AdjustPointsDialog({
  accountId,
  currentPoints,
  contactName,
}: AdjustPointsDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "subtract">("add");
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    const parsedPoints = parseInt(points, 10);

    if (!parsedPoints || parsedPoints <= 0) {
      toast.error("Please enter a valid number of points");
      return;
    }

    if (!description.trim()) {
      toast.error("Please enter a description for the adjustment");
      return;
    }

    const adjustedPoints =
      adjustmentType === "subtract" ? -parsedPoints : parsedPoints;

    if (adjustmentType === "subtract" && parsedPoints > currentPoints) {
      toast.error(
        `Cannot subtract ${parsedPoints} points. Current balance is ${currentPoints}.`
      );
      return;
    }

    startTransition(async () => {
      const result = await adjustPoints({
        accountId,
        points: adjustedPoints,
        description: description.trim(),
      });

      if (result.success) {
        toast.success(
          `Points ${adjustmentType === "add" ? "added" : "subtracted"} successfully`
        );
        setOpen(false);
        setPoints("");
        setDescription("");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to adjust points");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontalIcon className="mr-2 size-4" />
          Adjust Points
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Points</DialogTitle>
          <DialogDescription>
            Adjust loyalty points for{" "}
            <span className="font-semibold">{contactName}</span>. Current
            balance:{" "}
            <span className="font-bold">
              {currentPoints.toLocaleString("en-IN")} pts
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <Select
              value={adjustmentType}
              onValueChange={(val) =>
                setAdjustmentType(val as "add" | "subtract")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add Points</SelectItem>
                <SelectItem value="subtract">Subtract Points</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Points */}
          <div className="space-y-2">
            <Label htmlFor="adj-points">Points *</Label>
            <Input
              id="adj-points"
              type="number"
              min="1"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="Enter points amount"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="adj-description">Reason / Description *</Label>
            <Textarea
              id="adj-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Correction for booking reward, Goodwill gesture..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending
              ? "Processing..."
              : adjustmentType === "add"
                ? "Add Points"
                : "Subtract Points"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
