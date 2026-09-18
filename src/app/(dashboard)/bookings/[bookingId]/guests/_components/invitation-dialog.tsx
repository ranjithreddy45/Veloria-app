"use client";

import React, { useState, useTransition } from "react";
import { Send, Loader2, MessageSquare } from "lucide-react";
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
import {
  canSendInvite,
  guestInviteState,
  type InviteFacts,
} from "@/app/(guest)/app/event/guests/_lib/guest-invites";

interface InvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  /** Each guest with the facts the invite rule reads (guest-invites.ts): the rule the server applies too. */
  guests: Array<InviteFacts & { id: string; name: string }>;
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

  // The server's eligibility rule: a phone WhatsApp can reach, never invited, no reply yet.
  const eligibleGuests = guests.filter((g) => canSendInvite(g));
  const noPhoneGuests = guests.filter((g) => guestInviteState(g) === "NO_PHONE");

  function handleSend() {
    startTransition(async () => {
      if (mode === "single" && guests.length === 1) {
        const result = await sendGuestInvitation({
          guestId: guests[0].id,
          bookingId,
          customMessage: customMessage || undefined,
        });

        if (result.success) {
          // An approved template can't carry the personal note: say so, don't let it look sent.
          const notice = "notice" in result ? result.notice : undefined;
          toast.success(
            `Invitation sent to ${guests[0].name}`,
            notice ? { description: notice, duration: 15_000 } : undefined
          );
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
          const notice = "notice" in data ? data.notice : undefined;
          // data.message accounts for every guest, with WhatsApp's own reasons for any it refused.
          const title =
            data.sent > 0
              ? `${data.sent} ${data.sent === 1 ? "invitation" : "invitations"} sent`
              : "No invitations sent";
          const options = {
            description: [data.message, notice].filter(Boolean).join(" "),
            duration: data.failed > 0 || notice ? 15_000 : undefined,
          };
          if (data.failed === 0) toast.success(title, options);
          else if (data.sent > 0) toast.warning(title, options);
          else toast.error(title, options);
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
            <div className="rounded-lg border border-border bg-muted p-3 text-sm">
              <p className="font-medium text-foreground">
                {eligibleGuests.length} {eligibleGuests.length === 1 ? "guest" : "guests"} not invited yet
              </p>
              {noPhoneGuests.length > 0 && (
                <p className="mt-1 text-xs text-warning">
                  {noPhoneGuests.length} skipped: no phone number WhatsApp can reach
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Guests already invited or who have replied aren&apos;t sent another. Only invitations WhatsApp accepts are marked sent.
              </p>
            </div>
          )}

          {/* Custom message */}
          <div>
            <Label className="text-sm text-muted-foreground">
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
            <p className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
              <span>An approved WhatsApp template has fixed wording, so a note only goes out in text messages.</span>
              <span className="shrink-0">{customMessage.length}/2000</span>
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
