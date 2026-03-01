"use client";

import React, { useState, useTransition } from "react";
import { Send, Loader2, Eye, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendGuestInvitation, bulkSendInvitations } from "@/actions/invitation.actions";

interface InvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  guests: Array<{ id: string; name: string; phone: string | null; invitationStatus: string | null }>;
  mode: "single" | "bulk";
}

export function InvitationDialog({
  open,
  onOpenChange,
  bookingId,
  guests,
  mode,
}: InvitationDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [customMessage, setCustomMessage] = useState("");

  const eligibleGuests = guests.filter(
    (g) => g.phone && (!g.invitationStatus || g.invitationStatus === "NOT_SENT")
  );
  const noPhoneGuests = guests.filter((g) => !g.phone);

  function handleSend() {
    startTransition(async () => {
      if (mode === "single" && guests.length === 1) {
        const result = await sendGuestInvitation({
          guestId: guests[0].id,
          bookingId,
          customMessage: customMessage || undefined,
        });

        if (result.success) {
          toast.success(`Invitation sent to ${guests[0].name}`);
          onOpenChange(false);
        } else {
          toast.error(result.error || "Failed to send invitation");
        }
      } else {
        const result = await bulkSendInvitations({
          guestIds: eligibleGuests.map((g) => g.id),
          bookingId,
          customMessage: customMessage || undefined,
        });

        if (result.success) {
          const data = result.data;
          toast.success(
            `${data.sent} sent, ${data.alreadySent} already sent, ${data.failed} failed`
          );
          onOpenChange(false);
        } else {
          toast.error(result.error || "Failed to send invitations");
        }
      }
      setCustomMessage("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-4 text-indigo-500" />
            {mode === "single" ? "Send Invitation" : "Send All Invitations"}
          </DialogTitle>
          <DialogDescription>
            {mode === "single"
              ? `Send a WhatsApp invitation to ${guests[0]?.name} with an RSVP link.`
              : `Send WhatsApp invitations to ${eligibleGuests.length} eligible guests.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Eligible guests summary */}
          {mode === "bulk" && (
            <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="font-medium text-zinc-700 dark:text-zinc-300">
                {eligibleGuests.length} guests will receive invitations
              </p>
              {noPhoneGuests.length > 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  {noPhoneGuests.length} guests skipped (no phone number)
                </p>
              )}
            </div>
          )}

          {/* Custom message */}
          <div>
            <Label className="text-sm text-zinc-600">
              <MessageSquare className="mr-1 inline size-3.5" />
              Custom Message (optional)
            </Label>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="mt-1.5 resize-none"
              rows={3}
              placeholder="Add a personal note to the invitation..."
              maxLength={2000}
            />
            <p className="mt-1 text-right text-xs text-zinc-400">
              {customMessage.length}/2000
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isPending || eligibleGuests.length === 0}
          >
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Send className="mr-2 size-4" />
            )}
            {mode === "single" ? "Send Invitation" : `Send ${eligibleGuests.length} Invitations`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
