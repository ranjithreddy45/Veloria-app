"use client";

// ============================================================
// "Remove empty Facebook leads" — deletes placeholder enquiries the FB webhook
// created with the name "Facebook Lead" and no phone/email (no way to follow
// up). Only rendered when there is at least one, so it disappears once clean.
// Soft-delete — recoverable from Trash for 30 days.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

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
import { deleteEmptyFacebookEnquiries } from "@/actions/contact.actions";

export function CleanupEmptyFbButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  function run() {
    startTransition(async () => {
      const res = await deleteEmptyFacebookEnquiries();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.deleted > 0
          ? `Removed ${res.deleted} empty Facebook lead${res.deleted === 1 ? "" : "s"}.`
          : "Nothing left to remove."
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={pending}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          Remove {count} empty Facebook lead{count === 1 ? "" : "s"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remove {count} empty Facebook lead{count === 1 ? "" : "s"}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-body leading-relaxed">
              <p>
                These are enquiries named <strong>&ldquo;Facebook Lead&rdquo;</strong> with{" "}
                <strong>no phone and no email</strong> — created when Facebook sent a lead but the
                app couldn&rsquo;t fetch the person&rsquo;s details (usually a missing Page Access
                Token). There&rsquo;s no way to follow up on them, so they&rsquo;re just noise.
              </p>
              <p className="text-muted-foreground">
                Only records with that exact name and no contact details are removed — a real
                enquiry can never be caught. They go to Trash and are recoverable for 30 days.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              run();
            }}
            disabled={pending}
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Remove them
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
