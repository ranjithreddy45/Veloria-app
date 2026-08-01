"use client";

// ============================================================
// "Tidy up enquiry data" — runs the repair pass on demand.
//
// Only rendered when there is actually something to fix (the page counts it),
// so it disappears once the data is clean rather than sitting in the header
// forever inviting people to press it.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Wand2 } from "lucide-react";

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
import { runEnquiryDataRepair } from "@/actions/enquiry-repair.actions";

export function EnquiryRepairButton({ affected }: { affected: number }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  function run() {
    startTransition(async () => {
      const res = await runEnquiryDataRepair();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const { sourceFilled, tagsCleaned, phonesCleared } = res.data;
      const parts = [
        sourceFilled ? `${sourceFilled} lead source${sourceFilled === 1 ? "" : "s"} recorded` : null,
        tagsCleaned ? `${tagsCleaned} source tag${tagsCleaned === 1 ? "" : "s"} removed` : null,
        phonesCleared ? `${phonesCleared} bad phone number${phonesCleared === 1 ? "" : "s"} cleared` : null,
      ].filter(Boolean);
      toast.success(parts.length ? parts.join(" · ") : "Everything was already tidy");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={pending}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          Tidy up enquiry data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tidy up {affected} enquir{affected === 1 ? "y" : "ies"}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-[13px] leading-relaxed">
              <p>This cleans up data left behind by older versions of the app:</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  Moves channel tags like <code>google_ads</code> into the Lead source
                  column, so the tag is <strong>read before it is removed</strong> — nothing
                  is lost.
                </li>
                <li>
                  Leaves your own tags alone. Labels such as &ldquo;Marriage&rdquo; or
                  &ldquo;Website shoot&rdquo; are never touched.
                </li>
                <li>
                  Clears phone numbers stored as <code>FALSE</code> or <code>N/A</code>, which
                  are not real numbers and waste a callback.
                </li>
              </ul>
              <p className="text-muted-foreground">
                Safe to run more than once. It also runs by itself every night.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); // keep the dialog open while it runs
              run();
            }}
            disabled={pending}
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Tidy up
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
