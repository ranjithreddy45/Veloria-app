"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PhoneForwarded } from "lucide-react";

import { pushContactToCallVibe } from "@/actions/callvibe-push.actions";
import { Button } from "@/components/ui/button";

interface Props {
  contactId: string;
  status: string | null;
  lastPushedAt: Date | string | null;
  error: string | null;
}

const LABEL: Record<string, string> = {
  SUCCESS: "In CallVibe",
  PENDING: "Sending to CallVibe…",
  FAILED: "CallVibe push failed",
};

/** "Push to CallVibe" with the contact's last push result as its tooltip. */
export function CallVibePushButton({ contactId, status, lastPushedAt, error }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function push() {
    startTransition(async () => {
      const res = await pushContactToCallVibe(contactId);
      if (res.success) {
        toast.success("Queued for CallVibe. The result shows on the timeline.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const title = [
    status ? LABEL[status] ?? status : "Not pushed to CallVibe yet",
    lastPushedAt ? new Date(lastPushedAt).toLocaleString() : null,
    error,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Button variant="outline" size="sm" onClick={push} disabled={pending} className="gap-1.5" title={title}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <PhoneForwarded className="size-4" />}
      Push to CallVibe
      {status === "FAILED" && <span className="bg-destructive size-2 rounded-full" aria-label="Last push failed" />}
      {status === "PENDING" && <span className="bg-warning size-2 rounded-full" aria-label="Push in progress" />}
    </Button>
  );
}
