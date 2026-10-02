"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 as Loader2Icon, RefreshCw as RefreshCwIcon, Trash2 as Trash2Icon } from "lucide-react";

import { deleteTestLeads, runLeadEngagementRepair } from "@/actions/lead.actions";
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
// LeadsMoreMenu: the "More actions" menu at the end of the /leads cluster.
// ------------------------------------------------------------
// The leads page's two maintenance tools live here, not as header buttons:
//
// - Recompute engagement (lead managers): recomputes the Touches / Last
//   contacted roll-up on demand. It is derived nightly, so a freshly deployed
//   or freshly imported board shows "Not logged" everywhere until the cron
//   runs, which looks exactly like a broken feature.
// - Clean up test leads (leads:delete, only while "[TEST]" leads exist):
//   moves the integration-test leads (Google Ads test data, webhook checks)
//   that would otherwise skew conversion reporting to Trash. Soft delete, so
//   recoverable.
//
// The confirm dialog is CONTROLLED and rendered outside DropdownMenuContent.
// A dialog inside the menu content would unmount with the menu the moment the
// item is chosen, and the cleanup would silently never run.
// ============================================================

interface LeadsMoreMenuProps {
  /** Lead managers (resolved server-side from leads:assign): Recompute engagement. */
  canViewAll: boolean;
  /** The viewer holds leads:delete: Clean up test leads. */
  canDeleteLeads: boolean;
  /** How many "[TEST]" leads exist. The cleanup item shows only while there are some. */
  testLeadCount: number;
}

export function LeadsMoreMenu({ canViewAll, canDeleteLeads, testLeadCount }: LeadsMoreMenuProps) {
  const router = useRouter();
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Recompute engagement: the same server action, toasts and labels as the
  // header button it replaces.
  const [recomputing, startRecompute] = React.useTransition();
  const [recomputed, setRecomputed] = React.useState(false);

  // Clean up test leads: the same confirm copy and server action as before.
  const [cleanupOpen, setCleanupOpen] = React.useState(false);
  const [cleaning, setCleaning] = React.useState(false);
  // Set when an item hands off to the dialog, so the closing menu does not
  // pull focus back to its trigger while the dialog is taking it.
  const handingToDialog = React.useRef(false);

  const showRecompute = canViewAll;
  const showCleanup = canDeleteLeads && testLeadCount > 0;
  if (!showRecompute && !showCleanup) return null;

  function recompute() {
    startRecompute(async () => {
      const res = await runLeadEngagementRepair();
      if (!res.success) {
        toast.error(res.error ?? "Could not recompute engagement");
        return;
      }
      setRecomputed(true);
      toast.success(
        res.updated === 0
          ? `Engagement already up to date (${res.scanned} leads checked).`
          : `Updated ${res.updated} of ${res.scanned} leads.`
      );
    });
  }

  async function confirmCleanup() {
    setCleaning(true);
    try {
      const res = await deleteTestLeads();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`Removed ${res.deleted} test lead${res.deleted === 1 ? "" : "s"}.`);
      router.refresh();
    } finally {
      setCleaning(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PageMoreMenuTrigger ref={triggerRef} aria-busy={recomputing || cleaning || undefined} />
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
          {showRecompute && (
            <DropdownMenuItem disabled={recomputing} onSelect={recompute}>
              {recomputing ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
              {recomputing
                ? "Recomputing…"
                : recomputed
                  ? "Recompute again"
                  : "Recompute engagement"}
            </DropdownMenuItem>
          )}
          {showCleanup && (
            <DropdownMenuItem
              disabled={cleaning}
              onSelect={() => {
                // Let the menu close as usual; the dialog lives outside it.
                handingToDialog.current = true;
                setCleanupOpen(true);
              }}
            >
              {cleaning ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              Clean up test leads ({testLeadCount})
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showCleanup && (
        <AlertDialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
          <AlertDialogContent
            onCloseAutoFocus={(event) => {
              // No AlertDialogTrigger, so return focus to the More button
              // ourselves rather than dropping it on <body>.
              event.preventDefault();
              triggerRef.current?.focus();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Remove test leads?</AlertDialogTitle>
              <AlertDialogDescription>
                This moves the {testLeadCount} <strong>[TEST]</strong> lead{testLeadCount === 1 ? "" : "s"} (from Google Ads
                test data and integration checks) to Trash, so they stop skewing your reporting. Only leads
                tagged &ldquo;[TEST]&rdquo; are affected — never a real enquiry — and they&rsquo;re recoverable
                from Settings → Trash for 30 days.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cleaning}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmCleanup} disabled={cleaning}>
                {cleaning && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                Remove test leads
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
