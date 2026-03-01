"use client";

import { useTransition } from "react";
import { Loader2Icon, GiftIcon } from "lucide-react";
import { toast } from "sonner";

import { awardIncentive } from "@/actions/performance-score.actions";
import { Button } from "@/components/ui/button";

// ============================================================
// Award Incentive Button
// ============================================================

interface AwardIncentiveButtonProps {
  incentiveId: string;
}

export function AwardIncentiveButton({
  incentiveId,
}: AwardIncentiveButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleAward() {
    startTransition(async () => {
      const result = await awardIncentive(incentiveId);
      if (result.success) {
        toast.success("Incentive awarded successfully");
      } else {
        toast.error(result.error || "Failed to award incentive");
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleAward}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2Icon className="mr-2 size-4 animate-spin" />
      ) : (
        <GiftIcon className="mr-2 size-4" />
      )}
      Award
    </Button>
  );
}
