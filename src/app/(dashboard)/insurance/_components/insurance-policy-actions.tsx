"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TrashIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  deleteInsurancePolicy,
  markAsClaimed,
} from "@/actions/insurance.actions";

// ============================================================
// InsurancePolicyActions Component
// ============================================================

interface InsurancePolicyActionsProps {
  policyId: string;
  status: string;
  policyNumber: string;
}

export function InsurancePolicyActions({
  policyId,
  status,
  policyNumber,
}: InsurancePolicyActionsProps) {
  const router = useRouter();
  const [isClaimPending, setIsClaimPending] = React.useState(false);

  const handleMarkClaimed = async () => {
    setIsClaimPending(true);
    try {
      const result = await markAsClaimed(policyId);
      if (result.success) {
        toast.success("Policy marked as claimed");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsClaimPending(false);
    }
  };

  const handleDelete = async () => {
    const result = await deleteInsurancePolicy(policyId);
    if (result.success) {
      toast.success("Insurance policy deleted");
      router.push("/insurance");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {status === "ACTIVE" && (
        <Button
          variant="outline"
          onClick={handleMarkClaimed}
          disabled={isClaimPending}
        >
          <ShieldCheckIcon className="mr-2 size-4" />
          Mark as Claimed
        </Button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">
            <TrashIcon className="mr-2 size-4" />
            Delete
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Insurance Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete policy{" "}
              <span className="font-medium">{policyNumber}</span>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
