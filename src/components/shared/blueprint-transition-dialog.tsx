"use client";

import * as React from "react";
import {
  Loader2Icon,
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  validateBlueprintTransition,
  executeBlueprintTransition,
} from "@/actions/blueprint.actions";
import {
  ENTITY_REQUIRED_FIELDS,
  REQUIRED_ACTION_LABELS,
} from "@/lib/blueprint-engine";

// ============================================================
// Status Label Maps
// ============================================================

const STATUS_LABELS: Record<string, string> = {
  // Lead statuses
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
  // Booking statuses
  HOLD: "Hold",
  TENTATIVE: "Tentative",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// ============================================================
// BlueprintTransitionDialog Props
// ============================================================

interface BlueprintTransitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  currentStatus: string;
  targetStatus: string;
  onSuccess: () => void;
  onCancel: () => void;
}

// ============================================================
// BlueprintTransitionDialog Component
// ============================================================

export function BlueprintTransitionDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  currentStatus,
  targetStatus,
  onSuccess,
  onCancel,
}: BlueprintTransitionDialogProps) {
  const [state, setState] = React.useState<
    "loading" | "allowed" | "blocked" | "error"
  >("loading");
  const [errors, setErrors] = React.useState<string[]>([]);
  const [transitionName, setTransitionName] = React.useState<string | null>(
    null
  );
  const [requirements, setRequirements] = React.useState<{
    requiredFields: string[];
    requiredActions: string[];
    allowedRoles: string[];
  } | null>(null);
  const [isProceedPending, setIsProceedPending] = React.useState(false);

  // Validate the transition when dialog opens
  React.useEffect(() => {
    if (!open) return;

    setState("loading");
    setErrors([]);
    setTransitionName(null);
    setRequirements(null);

    validateBlueprintTransition(
      entityType,
      entityId,
      currentStatus,
      targetStatus
    )
      .then((result) => {
        if (!result.success) {
          setState("error");
          setErrors([result.error]);
          return;
        }

        const validation = result.data;

        if (validation.transition?.name) {
          setTransitionName(validation.transition.name);
        }

        if (validation.transition) {
          setRequirements({
            requiredFields: validation.transition.requiredFields ?? [],
            requiredActions: validation.transition.requiredActions ?? [],
            allowedRoles: validation.transition.allowedRoles ?? [],
          });
        }

        if (validation.allowed) {
          setState("allowed");
        } else {
          setState("blocked");
          setErrors(validation.errors);
        }
      })
      .catch(() => {
        setState("error");
        setErrors(["Failed to validate transition. Please try again."]);
      });
  }, [open, entityType, entityId, currentStatus, targetStatus]);

  const handleProceed = async () => {
    // Defense-in-depth: never proceed from a non-allowed client state. The
    // authoritative gate is the server re-validation below, but this prevents
    // a stale/raced click from ever reaching the mutation callback.
    if (state !== "allowed" || isProceedPending) return;

    setIsProceedPending(true);
    try {
      // Re-validate + log on the server. executeBlueprintTransition re-runs the
      // full blueprint gate (allowedRoles, requiredFields, requiredActions) and
      // returns success:false when the transition is no longer allowed, so the
      // mutation in onSuccess() can only fire on a confirmed allow.
      const result = await executeBlueprintTransition(
        entityType,
        entityId,
        currentStatus,
        targetStatus
      );

      if (result.success && result.data?.allowed === true) {
        onSuccess();
        onOpenChange(false);
      } else {
        // Blocked by the blueprint (role/field/action gate) — surface the
        // requirements and keep the mutation from running.
        setState("blocked");
        setErrors(
          result.success
            ? ["This transition is not allowed by the active blueprint."]
            : result.errors ?? [
                result.error ?? "Failed to execute transition",
              ]
        );
      }
    } catch {
      setState("error");
      setErrors(["Something went wrong. Please try again."]);
    } finally {
      setIsProceedPending(false);
    }
  };

  const handleClose = () => {
    onCancel();
    onOpenChange(false);
  };

  const fromLabel =
    STATUS_LABELS[currentStatus] ?? currentStatus.replace(/_/g, " ");
  const toLabel =
    STATUS_LABELS[targetStatus] ?? targetStatus.replace(/_/g, " ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {transitionName ?? "Status Transition"}
          </DialogTitle>
          <DialogDescription>
            {entityType} status change
          </DialogDescription>
        </DialogHeader>

        {/* Status Change Indicator */}
        <div className="flex items-center justify-center gap-3 py-3">
          <Badge variant="outline" className="text-sm px-3 py-1">
            {fromLabel}
          </Badge>
          <ArrowRightIcon className="size-5 text-muted-foreground" />
          <Badge variant="outline" className="text-sm px-3 py-1 bg-primary/5">
            {toLabel}
          </Badge>
        </div>

        <Separator />

        {/* Loading State */}
        {state === "loading" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Validating transition requirements...
            </p>
          </div>
        )}

        {/* Allowed State */}
        {state === "allowed" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2Icon className="size-10 text-success" />
            <div className="text-center">
              <p className="font-medium text-success">
                Transition Allowed
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                All requirements are met. You can proceed with this status
                change.
              </p>
            </div>
            {requirements &&
              (requirements.requiredFields.length > 0 ||
                requirements.requiredActions.length > 0 ||
                requirements.allowedRoles.length > 0) && (
                <div className="w-full text-xs text-muted-foreground space-y-1 border rounded-md p-2.5">
                  {requirements.allowedRoles.length > 0 && (
                    <p>
                      <span className="font-medium">Allowed roles:</span>{" "}
                      {requirements.allowedRoles
                        .map((r) => r.replace(/_/g, " "))
                        .join(", ")}
                    </p>
                  )}
                  {requirements.requiredFields.length > 0 && (
                    <p>
                      <span className="font-medium">Required fields:</span>{" "}
                      {requirements.requiredFields
                        .map(
                          (f) =>
                            ENTITY_REQUIRED_FIELDS[entityType]?.find(
                              (e) => e.value === f
                            )?.label ?? f
                        )
                        .join(", ")}
                    </p>
                  )}
                  {requirements.requiredActions.length > 0 && (
                    <p>
                      <span className="font-medium">Required actions:</span>{" "}
                      {requirements.requiredActions
                        .map((a) => REQUIRED_ACTION_LABELS[a] ?? a)
                        .join(", ")}
                    </p>
                  )}
                </div>
              )}
          </div>
        )}

        {/* Blocked State */}
        {state === "blocked" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <XCircleIcon className="size-5 text-destructive flex-shrink-0" />
              <p className="font-medium text-destructive">
                Transition Blocked
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              The following requirements must be met before this transition can
              proceed:
            </p>
            <ul className="space-y-2">
              {errors.map((error, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm bg-destructive/5 rounded-md p-2.5 border border-destructive/10"
                >
                  <AlertTriangleIcon className="size-4 text-destructive mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangleIcon className="size-5 text-warning" />
              <p className="font-medium text-warning">Validation Error</p>
            </div>
            {errors.map((error, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                {error}
              </p>
            ))}
          </div>
        )}

        {/* Footer */}
        <DialogFooter>
          {state === "allowed" ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleProceed}
                disabled={isProceedPending || state !== "allowed"}
              >
                {isProceedPending && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                Proceed
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
