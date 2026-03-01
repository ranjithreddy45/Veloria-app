"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, ZapIcon } from "lucide-react";

import {
  getCadences,
  enrollEntity,
  type CadenceListItem,
} from "@/actions/cadence.actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ============================================================
// Props
// ============================================================

interface EnrollCadenceDialogProps {
  entityType: "LEAD" | "CONTACT";
  entityId: string;
  entityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================
// Component
// ============================================================

export function EnrollCadenceDialog({
  entityType,
  entityId,
  entityName,
  open,
  onOpenChange,
}: EnrollCadenceDialogProps) {
  const router = useRouter();
  const [cadences, setCadences] = React.useState<CadenceListItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [enrolling, setEnrolling] = React.useState<string | null>(null);
  const [confirming, setConfirming] = React.useState<CadenceListItem | null>(
    null
  );

  // Load active cadences for the entity type when dialog opens
  React.useEffect(() => {
    if (!open) {
      setConfirming(null);
      return;
    }

    async function loadCadences() {
      setLoading(true);
      const result = await getCadences();
      setLoading(false);

      if (result.success) {
        setCadences(
          result.data.filter(
            (c) => c.status === "ACTIVE" && c.entityType === entityType
          )
        );
      } else {
        toast.error(result.error);
      }
    }

    loadCadences();
  }, [open, entityType]);

  async function handleEnroll(cadenceId: string) {
    setEnrolling(cadenceId);
    const result = await enrollEntity(cadenceId, entityId);
    setEnrolling(null);

    if (result.success) {
      toast.success(`${entityName} enrolled in cadence`);
      setConfirming(null);
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ZapIcon className="h-5 w-5" />
            Enroll in Cadence
          </DialogTitle>
          <DialogDescription>
            Select an active cadence to enroll{" "}
            <span className="font-medium">{entityName}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Confirmation View */}
        {confirming ? (
          <div className="space-y-4">
            <div className="rounded-md border p-4">
              <p className="text-sm">
                Enroll <span className="font-medium">{entityName}</span> into
                the cadence{" "}
                <span className="font-medium">{confirming.name}</span>?
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                The entity will begin receiving cadence steps immediately based
                on the configured delays.
              </p>
              {confirming._count.steps > 0 && (
                <p className="text-muted-foreground mt-1 text-xs">
                  This cadence has {confirming._count.steps} step
                  {confirming._count.steps !== 1 ? "s" : ""}.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirming(null)}
              >
                Back
              </Button>
              <Button
                onClick={() => handleEnroll(confirming.id)}
                disabled={enrolling === confirming.id}
              >
                {enrolling === confirming.id ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Enrolling...
                  </>
                ) : (
                  "Confirm Enroll"
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Cadence List View */
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : cadences.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-sm">
                No active cadences found for {entityType.toLowerCase()}s. Create
                and activate a cadence first.
              </div>
            ) : (
              cadences.map((cadence) => (
                <button
                  key={cadence.id}
                  type="button"
                  onClick={() => setConfirming(cadence)}
                  className="hover:bg-muted w-full rounded-md border p-3 text-left transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{cadence.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {cadence._count.steps} step
                      {cadence._count.steps !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  {cadence.description && (
                    <p className="text-muted-foreground mt-0.5 text-xs line-clamp-1">
                      {cadence.description}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
