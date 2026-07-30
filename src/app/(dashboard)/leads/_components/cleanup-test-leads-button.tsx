"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 as Trash2Icon, Loader2 as Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteTestLeads } from "@/actions/lead.actions";

/** Shown only when "[TEST] …" leads exist and the viewer can delete leads.
 *  Removes the integration-test leads (Google Ads test data, webhook checks)
 *  that would otherwise skew conversion reporting. Soft-delete → recoverable. */
export function CleanupTestLeadsButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  if (count <= 0) return null;

  async function onConfirm() {
    setPending(true);
    try {
      const res = await deleteTestLeads();
      if (!res.success) { toast.error(res.error); return; }
      toast.success(`Removed ${res.deleted} test lead${res.deleted === 1 ? "" : "s"}.`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-amber-700 dark:text-amber-400">
          <Trash2Icon className="size-3.5" strokeWidth={2.5} />
          Clear {count} test lead{count === 1 ? "" : "s"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove test leads?</AlertDialogTitle>
          <AlertDialogDescription>
            This moves the {count} <strong>[TEST]</strong> lead{count === 1 ? "" : "s"} (from Google Ads
            test data and integration checks) to Trash, so they stop skewing your reporting. Only leads
            tagged &ldquo;[TEST]&rdquo; are affected — never a real enquiry — and they&rsquo;re recoverable
            from Settings → Trash for 30 days.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            {pending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Remove test leads
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
