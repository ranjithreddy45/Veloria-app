"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 as Loader2Icon, Trash2 as Trash2Icon, Wand2 as Wand2Icon } from "lucide-react";

import { deleteEmptyFacebookEnquiries } from "@/actions/contact.actions";
import { runEnquiryDataRepair } from "@/actions/enquiry-repair.actions";
import { PageMoreMenuTrigger } from "@/components/ui/quick-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ============================================================
// ContactsMoreMenu: the "More actions" menu at the end of the /contacts
// cluster.
// ------------------------------------------------------------
// The Enquiry page's two maintenance tools live here, not in the header's
// meta row (design spec R6: maintenance tools go only in the More menu). Each
// keeps the gate, confirm copy and server action of the button it replaces
// (cleanup-empty-fb-button.tsx, enquiry-repair-button.tsx):
//
// - Remove N empty Facebook leads (contacts:delete, only while some exist):
//   soft-deletes "Facebook Lead" placeholders with no phone and no email.
// - Tidy up enquiry data (settings:update, only while something is
//   repairable): runs the enquiry repair pass on demand.
//
// The page resolves both gates and counts server-side and passes 0 for a gate
// the viewer does not hold. The confirm dialogs are CONTROLLED and rendered
// outside DropdownMenuContent: a dialog inside the menu content would unmount
// with the menu the moment the item is chosen.
// ============================================================

interface ContactsMoreMenuProps {
  /** Empty "Facebook Lead" placeholders (0 unless the viewer holds contacts:delete). */
  emptyFbCount: number;
  /** Enquiries the repair pass would touch (0 unless the viewer holds settings:update). */
  repairable: number;
}

type DialogKind = "cleanup" | "repair" | null;

export function ContactsMoreMenu({ emptyFbCount, repairable }: ContactsMoreMenuProps) {
  const router = useRouter();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [cleaning, startCleanup] = React.useTransition();
  const [repairing, startRepair] = React.useTransition();
  // Set when an item hands off to a dialog, so the closing menu does not pull
  // focus back to its trigger while the dialog is taking it.
  const handingToDialog = React.useRef(false);

  const showCleanup = emptyFbCount > 0;
  const showRepair = repairable > 0;
  if (!showCleanup && !showRepair) return null;

  function runCleanup() {
    startCleanup(async () => {
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
      setDialog(null);
      router.refresh();
    });
  }

  function runRepair() {
    startRepair(async () => {
      const res = await runEnquiryDataRepair();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const { sourceFilled, tagsCleaned, tagsRetyped, phonesCleared, reclassified } = res.data;
      const parts = [
        sourceFilled ? `${sourceFilled} lead source${sourceFilled === 1 ? "" : "s"} recorded` : null,
        reclassified ? `${reclassified} re-credited from "Website form" to a real channel` : null,
        tagsRetyped ? `${tagsRetyped} tag${tagsRetyped === 1 ? "" : "s"} set to the event type` : null,
        tagsCleaned - tagsRetyped > 0
          ? `${tagsCleaned - tagsRetyped} source tag${tagsCleaned - tagsRetyped === 1 ? "" : "s"} removed`
          : null,
        phonesCleared ? `${phonesCleared} bad phone number${phonesCleared === 1 ? "" : "s"} cleared` : null,
      ].filter(Boolean);
      toast.success(parts.length ? parts.join(" · ") : "Everything was already tidy");
      setDialog(null);
      router.refresh();
    });
  }

  function openDialog(kind: Exclude<DialogKind, null>) {
    handingToDialog.current = true;
    setDialog(kind);
  }

  function onDialogOpenChange(open: boolean) {
    if (!open) setDialog(null);
  }

  // No AlertDialogTrigger, so return focus to the More button ourselves
  // rather than dropping it on <body>.
  function returnFocus(event: Event) {
    event.preventDefault();
    triggerRef.current?.focus();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PageMoreMenuTrigger ref={triggerRef} aria-busy={cleaning || repairing || undefined} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-56"
          onCloseAutoFocus={(event) => {
            if (handingToDialog.current) {
              handingToDialog.current = false;
              event.preventDefault();
            }
          }}
        >
          {showCleanup && (
            <DropdownMenuItem disabled={cleaning} onSelect={() => openDialog("cleanup")}>
              {cleaning ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              Remove {emptyFbCount} empty Facebook lead{emptyFbCount === 1 ? "" : "s"}
            </DropdownMenuItem>
          )}
          {showRepair && (
            <DropdownMenuItem disabled={repairing} onSelect={() => openDialog("repair")}>
              {repairing ? <Loader2Icon className="animate-spin" /> : <Wand2Icon />}
              Tidy up enquiry data
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showCleanup && (
        <AlertDialog open={dialog === "cleanup"} onOpenChange={onDialogOpenChange}>
          <AlertDialogContent onCloseAutoFocus={returnFocus}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Remove {emptyFbCount} empty Facebook lead{emptyFbCount === 1 ? "" : "s"}?
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
              <AlertDialogCancel disabled={cleaning}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault(); // keep the dialog open while it runs
                  runCleanup();
                }}
                disabled={cleaning}
              >
                {cleaning && <Loader2Icon className="size-3.5 animate-spin" />}
                Remove them
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {showRepair && (
        <AlertDialog open={dialog === "repair"} onOpenChange={onDialogOpenChange}>
          <AlertDialogContent onCloseAutoFocus={returnFocus}>
            <AlertDialogHeader>
              <AlertDialogTitle>Tidy up {repairable} enquir{repairable === 1 ? "y" : "ies"}?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-body leading-relaxed">
                  <p>This cleans up data left behind by older versions of the app:</p>
                  <ul className="list-disc space-y-1 pl-4">
                    <li>
                      Moves channel tags like <code>google_ads</code> into the Lead source
                      column, so the tag is <strong>read before it is replaced</strong> — nothing
                      is lost.
                    </li>
                    <li>
                      Puts the <strong>event type</strong> there instead &mdash; &ldquo;Wedding&rdquo;,
                      &ldquo;Baby Shower&rdquo; &mdash; which is what a tag is for.
                    </li>
                    <li>
                      Leaves your own tags alone. Labels such as &ldquo;Marriage&rdquo; or
                      &ldquo;Website shoot&rdquo; are never touched.
                    </li>
                    <li>
                      Re-credits older enquiries filed as &ldquo;Website form&rdquo; to the channel
                      they actually came from &mdash; organic search, a paid click, a referring
                      site &mdash; using the campaign tags captured at the time.
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
              <AlertDialogCancel disabled={repairing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault(); // keep the dialog open while it runs
                  runRepair();
                }}
                disabled={repairing}
              >
                {repairing && <Loader2Icon className="size-3.5 animate-spin" />}
                Tidy up
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
