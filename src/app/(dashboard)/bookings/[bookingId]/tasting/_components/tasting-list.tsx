"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CalendarIcon,
  ClockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  MessageSquareIcon,
  UtensilsIcon,
  MapPinIcon,
  EyeOffIcon,
} from "lucide-react";

import {
  completeTasting,
  cancelTasting,
  confirmTasting,
  deleteTasting,
  markTastingNoShow,
} from "@/actions/tasting.actions";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TASTING_STATUS_COLORS } from "@/lib/constants";
import { TastingForm } from "./tasting-form";

// ============================================================
// Types
// ============================================================

interface SelectedItem {
  name: string;
  category?: string;
  notes?: string;
}

interface Venue {
  id: string;
  name: string;
}

interface SerializedTasting {
  id: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedItems: any;
  notes: string | null;
  feedback: string | null;
  contactId: string;
  venueId: string | null;
  bookingId: string;
  createdAt: string;
  updatedAt: string;
}

interface TastingListProps {
  tastings: SerializedTasting[];
  bookingId: string;
  contactId: string;
  venues: Venue[];
}

// ============================================================
// TastingList Component
// ============================================================

export function TastingList({
  tastings,
  bookingId,
  contactId,
  venues,
}: TastingListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog states
  const [editingTasting, setEditingTasting] = useState<SerializedTasting | null>(null);
  const [completingTasting, setCompletingTasting] = useState<SerializedTasting | null>(null);
  const [cancellingTasting, setCancellingTasting] = useState<SerializedTasting | null>(null);
  const [deletingTasting, setDeletingTasting] = useState<SerializedTasting | null>(null);

  // Form values
  const [feedback, setFeedback] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  // Venue lookup
  const venueMap = new Map(venues.map((v) => [v.id, v.name]));

  function handleConfirm(tasting: SerializedTasting) {
    startTransition(async () => {
      const result = await confirmTasting(tasting.id);
      if (result.success) {
        toast.success("Tasting confirmed");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to confirm tasting");
      }
    });
  }

  function handleComplete() {
    if (!completingTasting) return;
    startTransition(async () => {
      const result = await completeTasting(completingTasting.id, {
        feedback: feedback || "",
      });
      if (result.success) {
        toast.success("Tasting marked as completed");
        setCompletingTasting(null);
        setFeedback("");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to complete tasting");
      }
    });
  }

  function handleCancel() {
    if (!cancellingTasting) return;
    startTransition(async () => {
      const result = await cancelTasting(cancellingTasting.id, {
        reason: cancelReason || "",
      });
      if (result.success) {
        toast.success("Tasting cancelled");
        setCancellingTasting(null);
        setCancelReason("");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to cancel tasting");
      }
    });
  }

  function handleNoShow(tasting: SerializedTasting) {
    startTransition(async () => {
      const result = await markTastingNoShow(tasting.id);
      if (result.success) {
        toast.success("Tasting marked as no-show");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to mark tasting as no-show");
      }
    });
  }

  function handleDelete() {
    if (!deletingTasting) return;
    startTransition(async () => {
      const result = await deleteTasting(deletingTasting.id);
      if (result.success) {
        toast.success("Tasting deleted");
        setDeletingTasting(null);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete tasting");
      }
    });
  }

  if (tastings.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <UtensilsIcon className="size-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-sm">
            No tastings scheduled for this booking yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Edit Tasting Inline */}
      {editingTasting && (
        <TastingForm
          bookingId={bookingId}
          contactId={contactId}
          venues={venues}
          tasting={editingTasting}
          onSuccess={() => setEditingTasting(null)}
          onCancel={() => setEditingTasting(null)}
        />
      )}

      {/* Tasting Cards */}
      <div className="space-y-4">
        {tastings.map((tasting) => (
          <Card key={tasting.id}>
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="size-4 text-muted-foreground" />
                  <CardTitle className="text-base">
                    {format(new Date(tasting.scheduledDate), "EEEE, dd MMMM yyyy")}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <ClockIcon className="size-3.5" />
                    {tasting.scheduledTime}
                  </span>
                  {tasting.venueId && venueMap.has(tasting.venueId) && (
                    <span className="flex items-center gap-1.5">
                      <MapPinIcon className="size-3.5" />
                      {venueMap.get(tasting.venueId)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <StatusBadge
                  status={tasting.status}
                  colorMap={TASTING_STATUS_COLORS}
                />

                {tasting.status === "SCHEDULED" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontalIcon className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleConfirm(tasting)}>
                        <CheckCircle2Icon className="mr-2 size-4" />
                        Confirm
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setCompletingTasting(tasting);
                          setFeedback("");
                        }}
                      >
                        <CheckCircle2Icon className="mr-2 size-4" />
                        Mark Complete
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingTasting(tasting)}>
                        <PencilIcon className="mr-2 size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleNoShow(tasting)}>
                        <EyeOffIcon className="mr-2 size-4" />
                        Mark No-Show
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setCancellingTasting(tasting);
                          setCancelReason("");
                        }}
                      >
                        <XCircleIcon className="mr-2 size-4" />
                        Cancel
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => setDeletingTasting(tasting)}
                      >
                        <TrashIcon className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Selected Items */}
              {tasting.selectedItems &&
                Array.isArray(tasting.selectedItems) &&
                tasting.selectedItems.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      Menu Items ({tasting.selectedItems.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(tasting.selectedItems as SelectedItem[]).map(
                        (item, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs"
                          >
                            {item.name}
                            {item.category ? ` (${item.category})` : ""}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                )}

              {/* Notes */}
              {tasting.notes && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                    Notes
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{tasting.notes}</p>
                </div>
              )}

              {/* Feedback (for completed tastings) */}
              {tasting.feedback && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="text-xs font-medium text-green-800 mb-1 uppercase tracking-wide flex items-center gap-1.5">
                    <MessageSquareIcon className="size-3.5" />
                    Feedback
                  </p>
                  <p className="text-sm text-green-900 whitespace-pre-wrap">
                    {tasting.feedback}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Complete Tasting Dialog */}
      <Dialog
        open={!!completingTasting}
        onOpenChange={(open) => {
          if (!open) {
            setCompletingTasting(null);
            setFeedback("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Tasting</DialogTitle>
            <DialogDescription>
              Mark this tasting as completed and optionally add feedback.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Feedback (optional)</Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="How did the tasting go? Any preferences or changes noted..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCompletingTasting(null);
                setFeedback("");
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleComplete} disabled={isPending}>
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Tasting Dialog */}
      <Dialog
        open={!!cancellingTasting}
        onOpenChange={(open) => {
          if (!open) {
            setCancellingTasting(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="size-5 text-amber-500" />
              Cancel Tasting
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this tasting? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancellingTasting(null);
                setCancelReason("");
              }}
              disabled={isPending}
            >
              Keep Scheduled
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isPending}
            >
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              Cancel Tasting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tasting Dialog */}
      <Dialog
        open={!!deletingTasting}
        onOpenChange={(open) => {
          if (!open) setDeletingTasting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="size-5 text-red-500" />
              Delete Tasting
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this tasting? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingTasting(null)}
              disabled={isPending}
            >
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
