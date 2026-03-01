"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createTimeline } from "@/actions/event-day.actions";

// ============================================================
// Create Timeline Button
// ============================================================

interface CreateTimelineButtonProps {
  bookingId: string;
}

export function CreateTimelineButton({ bookingId }: CreateTimelineButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const result = await createTimeline(bookingId);
      if (result.success) {
        toast.success("Timeline created successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to create timeline");
      }
    });
  }

  return (
    <Button onClick={handleCreate} disabled={isPending} size="lg">
      {isPending ? (
        <Loader2Icon className="mr-2 size-4 animate-spin" />
      ) : (
        <PlusIcon className="mr-2 size-4" />
      )}
      Create Day-of Timeline
    </Button>
  );
}
