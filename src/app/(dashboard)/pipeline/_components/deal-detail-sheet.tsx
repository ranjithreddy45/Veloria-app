"use client";

import React, { useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  IndianRupee,
  Calendar,
  User,
  Building2,
  Mail,
  Phone,
  TrendingUp,
  FileText,
  Trash2,
  Trophy,
  XCircle,
  Clock,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { updateDeal, deleteDeal, moveDeal, getPipelineStages } from "@/actions/pipeline.actions";
import type { DealItem } from "./pipeline-board";
import { DealScoreCard } from "@/components/ai/deal-score-card";

// ============================================================
// Formatting
// ============================================================

function formatIndianCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatFullDate(date: Date | string | null): string {
  if (!date) return "Not set";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

// ============================================================
// Types
// ============================================================

type StageOption = {
  id: string;
  name: string;
  color: string;
  isWonStage: boolean;
  isLostStage: boolean;
};

interface DealDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: DealItem;
  onDealUpdated?: () => void;
  onDealDeleted?: () => void;
}

// ============================================================
// Component
// ============================================================

export function DealDetailSheet({
  open,
  onOpenChange,
  deal,
  onDealUpdated,
  onDealDeleted,
}: DealDetailSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(deal.title);
  const [editValue, setEditValue] = useState(String(deal.value));
  const [editProbability, setEditProbability] = useState(
    String(deal.probability)
  );
  const [editNotes, setEditNotes] = useState(deal.notes ?? "");
  const [stages, setStages] = useState<StageOption[]>([]);
  const [stagesLoaded, setStagesLoaded] = useState(false);
  const [lostReasonInput, setLostReasonInput] = useState("");
  const [showLostReasonDialog, setShowLostReasonDialog] = useState(false);
  const [targetLostStageId, setTargetLostStageId] = useState<string | null>(null);

  // Load stages for the move dropdown
  const loadStages = async () => {
    if (stagesLoaded) return;
    const result = await getPipelineStages();
    if (result.success) {
      setStages(
        result.data.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          isWonStage: s.isWonStage,
          isLostStage: s.isLostStage,
        }))
      );
      setStagesLoaded(true);
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateDeal(deal.id, {
        title: editTitle,
        value: parseFloat(editValue) || 0,
        probability: parseInt(editProbability) || 50,
        notes: editNotes || null,
      });

      if (result.success) {
        toast.success("Deal updated successfully");
        setIsEditing(false);
        onDealUpdated?.();
      } else {
        toast.error("Failed to update deal", { description: result.error });
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteDeal(deal.id);
      if (result.success) {
        toast.success("Deal deleted");
        onOpenChange(false);
        onDealDeleted?.();
      } else {
        toast.error("Failed to delete deal", { description: result.error });
      }
    });
  };

  const handleMoveToStage = (stageId: string) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return;

    if (stage.isLostStage) {
      setTargetLostStageId(stageId);
      setShowLostReasonDialog(true);
      return;
    }

    startTransition(async () => {
      const result = await moveDeal(deal.id, stageId, 0);
      if (result.success) {
        if (stage.isWonStage) {
          toast.success("Deal Won!", {
            description: "Congratulations! The deal has been marked as won.",
            duration: 5000,
          });
        } else {
          toast.success(`Deal moved to ${stage.name}`);
        }
        onOpenChange(false);
        onDealUpdated?.();
      } else {
        toast.error("Failed to move deal", { description: result.error });
      }
    });
  };

  const handleMarkLost = () => {
    if (!targetLostStageId) return;
    startTransition(async () => {
      // First update the lost reason
      if (lostReasonInput.trim()) {
        await updateDeal(deal.id, { lostReason: lostReasonInput.trim() });
      }
      const result = await moveDeal(deal.id, targetLostStageId, 0);
      if (result.success) {
        toast.error("Deal Lost", {
          description: "The deal has been moved to the lost stage.",
        });
        setShowLostReasonDialog(false);
        setLostReasonInput("");
        onOpenChange(false);
        onDealUpdated?.();
      } else {
        toast.error("Failed to move deal", { description: result.error });
      }
    });
  };

  const handleMarkWon = () => {
    const wonStage = stages.find((s) => s.isWonStage);
    if (wonStage) {
      handleMoveToStage(wonStage.id);
    } else {
      toast.error("No 'Won' stage found. Please configure pipeline stages.");
    }
  };

  const handleMarkLostBtn = () => {
    const lostStage = stages.find((s) => s.isLostStage);
    if (lostStage) {
      setTargetLostStageId(lostStage.id);
      setShowLostReasonDialog(true);
    } else {
      toast.error("No 'Lost' stage found. Please configure pipeline stages.");
    }
  };

  const contactName = deal.contact
    ? `${deal.contact.firstName} ${deal.contact.lastName}`
    : "No contact";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            loadStages();
          }}
        >
          <SheetHeader className="pb-0">
            <div className="flex items-center gap-2">
              <div
                className="size-3 rounded-full"
                style={{ backgroundColor: deal.stage.color }}
              />
              <Badge variant="outline" className="text-xs">
                {deal.stage.name}
              </Badge>
              {deal.wonDate && (
                <Badge className="bg-green-100 text-green-800 text-xs">
                  Won
                </Badge>
              )}
              {deal.lostDate && (
                <Badge className="bg-red-100 text-red-800 text-xs">Lost</Badge>
              )}
            </div>
            <SheetTitle className="mt-2 text-lg">
              {isEditing ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-lg font-semibold"
                />
              ) : (
                deal.title
              )}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Deal details for {deal.title}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 px-4 pb-6">
            {/* Value & Probability */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <IndianRupee className="size-3.5" />
                  <span className="text-xs font-medium">Deal Value</span>
                </div>
                {isEditing ? (
                  <Input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="mt-1 h-8 text-sm"
                  />
                ) : (
                  <p className="mt-1 text-lg font-bold text-zinc-900">
                    {formatIndianCurrency(Number(deal.value))}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <TrendingUp className="size-3.5" />
                  <span className="text-xs font-medium">Probability</span>
                </div>
                {isEditing ? (
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={editProbability}
                    onChange={(e) => setEditProbability(e.target.value)}
                    className="mt-1 h-8 text-sm"
                  />
                ) : (
                  <p className="mt-1 text-lg font-bold text-zinc-900">
                    {deal.probability}%
                  </p>
                )}
              </div>
            </div>

            {/* AI Deal Score */}
            <DealScoreCard
              dealId={deal.id}
              currentScore={deal.aiScore}
              currentReason={deal.aiScoreReason}
              currentFactors={deal.aiFactors}
              scoredAt={deal.aiScoredAt}
            />

            {/* Move to Stage */}
            {!deal.wonDate && !deal.lostDate && stagesLoaded && (
              <div>
                <Label className="text-xs text-zinc-500">Move to Stage</Label>
                <Select
                  value={deal.stageId}
                  onValueChange={handleMoveToStage}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quick Actions */}
            {!deal.wonDate && !deal.lostDate && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-green-600 text-white hover:bg-green-700"
                  onClick={handleMarkWon}
                  disabled={isPending || !stagesLoaded}
                >
                  <Trophy className="size-3.5" />
                  Mark Won
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleMarkLostBtn}
                  disabled={isPending || !stagesLoaded}
                >
                  <XCircle className="size-3.5" />
                  Mark Lost
                </Button>
              </div>
            )}

            <Separator />

            {/* Contact Info */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                Contact Information
              </h4>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <User className="size-4 text-zinc-400" />
                  <span className="text-sm text-zinc-700">{contactName}</span>
                </div>
                {deal.contact?.company && (
                  <div className="flex items-center gap-2.5">
                    <Building2 className="size-4 text-zinc-400" />
                    <span className="text-sm text-zinc-700">
                      {deal.contact.company}
                    </span>
                  </div>
                )}
                {deal.contact?.email && (
                  <div className="flex items-center gap-2.5">
                    <Mail className="size-4 text-zinc-400" />
                    <span className="text-sm text-zinc-700">
                      {deal.contact.email}
                    </span>
                  </div>
                )}
                {deal.contact?.phone && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="size-4 text-zinc-400" />
                    <span className="text-sm text-zinc-700">
                      {deal.contact.phone}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Lead Info */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                Lead Details
              </h4>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <FileText className="size-4 text-zinc-400" />
                  <span className="text-sm text-zinc-700">
                    {deal.lead.title}
                  </span>
                </div>
                {deal.lead.eventType && (
                  <div className="flex items-center gap-2.5">
                    <Tag className="size-4 text-zinc-400" />
                    <span className="text-sm text-zinc-700">
                      {deal.lead.eventType}
                    </span>
                  </div>
                )}
                {deal.lead.eventDate && (
                  <div className="flex items-center gap-2.5">
                    <Calendar className="size-4 text-zinc-400" />
                    <span className="text-sm text-zinc-700">
                      Event: {formatFullDate(deal.lead.eventDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Key Dates */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                Key Dates
              </h4>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <Calendar className="size-4 text-zinc-400" />
                  <span className="text-sm text-zinc-600">
                    Expected Close: {formatFullDate(deal.expectedCloseDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="size-4 text-zinc-400" />
                  <span className="text-sm text-zinc-600">
                    Created: {formatFullDate(deal.createdAt)}
                  </span>
                </div>
                {deal.wonDate && (
                  <div className="flex items-center gap-2.5">
                    <Trophy className="size-4 text-green-500" />
                    <span className="text-sm text-green-700">
                      Won: {formatFullDate(deal.wonDate)}
                    </span>
                  </div>
                )}
                {deal.lostDate && (
                  <div className="flex items-center gap-2.5">
                    <XCircle className="size-4 text-red-500" />
                    <span className="text-sm text-red-700">
                      Lost: {formatFullDate(deal.lostDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Lost Reason */}
            {deal.lostReason && (
              <>
                <Separator />
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Lost Reason
                  </h4>
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                    {deal.lostReason}
                  </p>
                </div>
              </>
            )}

            {/* Notes */}
            <Separator />
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Notes
              </h4>
              {isEditing ? (
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                  placeholder="Add notes about this deal..."
                />
              ) : (
                <p className="text-sm text-zinc-600 whitespace-pre-wrap">
                  {deal.notes || "No notes added."}
                </p>
              )}
            </div>

            {/* Activity Timeline Placeholder */}
            <Separator />
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                Activity Timeline
              </h4>
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 py-6">
                <p className="text-xs text-zinc-400">
                  Activity tracking coming soon
                </p>
              </div>
            </div>

            {/* Actions */}
            <Separator />
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isPending}
                    className="bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    {isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setEditTitle(deal.title);
                      setEditValue(String(deal.value));
                      setEditProbability(String(deal.probability));
                      setEditNotes(deal.notes ?? "");
                    }}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Deal
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Deal</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{deal.title}&quot;?
                      This action cannot be undone. The associated lead will be
                      reverted to &quot;Qualified&quot; status.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Lost Reason Dialog */}
      <AlertDialog open={showLostReasonDialog} onOpenChange={setShowLostReasonDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Deal as Lost</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for losing this deal. This helps with
              future analysis and improving the sales process.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="lost-reason" className="text-sm font-medium">
              Lost Reason
            </Label>
            <Textarea
              id="lost-reason"
              value={lostReasonInput}
              onChange={(e) => setLostReasonInput(e.target.value)}
              placeholder="e.g., Budget constraints, Chose competitor, Timeline mismatch..."
              rows={3}
              className="mt-1.5"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setLostReasonInput("");
                setTargetLostStageId(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkLost}
              className="bg-red-600 hover:bg-red-700"
              disabled={isPending}
            >
              {isPending ? "Moving..." : "Mark as Lost"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
