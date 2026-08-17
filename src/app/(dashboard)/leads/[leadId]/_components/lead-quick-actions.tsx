"use client";

// ============================================================
// LeadQuickActions — detail-header action buttons that don't need the full
// edit form: "Send Email" (mailto to the lead's contact, subject prefilled with
// the lead title) and "Convert to Deal" (reuses the convertLeadToDeal server
// action, then routes to the created pipeline deal). Both sit next to the
// existing Edit button — they don't replace it.
// ============================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { MailIcon, GitBranchPlusIcon, Loader2Icon, PhoneIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { convertLeadToDeal } from "@/actions/lead.actions";
import { initiateRunoCall } from "@/actions/runo.actions";

interface LeadQuickActionsProps {
  leadId: string;
  leadTitle: string;
  contactEmail: string | null;
  /** Present when the lead is already converted — hides the convert button. */
  alreadyConverted: boolean;
}

export function LeadQuickActions({
  leadId,
  leadTitle,
  contactEmail,
  alreadyConverted,
}: LeadQuickActionsProps) {
  const router = useRouter();
  const [converting, setConverting] = React.useState(false);

  function handleSendEmail() {
    if (!contactEmail) {
      toast.error("This lead's contact has no email address.");
      return;
    }
    const subject = encodeURIComponent(`Re: ${leadTitle}`);
    // Opens the user's default mail client with the recipient + subject prefilled.
    window.location.href = `mailto:${contactEmail}?subject=${subject}`;
  }

  async function handleRunoCall() {
    toast.info("Initiating call via Runo...");
    try {
      const result = await initiateRunoCall(leadId);
      if (result.success) {
        toast.success("Call allocated in Runo app. Please check your phone.");
      } else {
        toast.error(result.error || "Failed to initiate call.");
      }
    } catch {
      toast.error("Failed to initiate call.");
    }
  }

  async function handleConvert() {
    setConverting(true);
    try {
      const result = await convertLeadToDeal(leadId);
      if (result.success) {
        toast.success(
          result.data.alreadyExisted
            ? "This lead already has a deal — opening it."
            : "Lead converted to a deal."
        );
        router.push(`/pipeline?deal=${result.data.dealId}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to convert lead.");
    } finally {
      setConverting(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleRunoCall}>
        <PhoneIcon className="mr-2 size-4" />
        Call via Runo
      </Button>
      <Button size="sm" variant="outline" onClick={handleSendEmail}>
        <MailIcon className="mr-2 size-4" />
        Send Email
      </Button>
      {!alreadyConverted && (
        <Button size="sm" variant="outline" onClick={handleConvert} disabled={converting}>
          {converting ? (
            <Loader2Icon className="mr-2 size-4 animate-spin" />
          ) : (
            <GitBranchPlusIcon className="mr-2 size-4" />
          )}
          Convert to Deal
        </Button>
      )}
    </>
  );
}
