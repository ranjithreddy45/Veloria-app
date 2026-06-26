"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  PencilIcon,
  SendIcon,
  XCircleIcon,
  CalendarIcon,
  Loader2Icon,
} from "lucide-react";

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
import {
  sendCampaign,
  cancelCampaign,
  scheduleCampaign,
} from "@/actions/campaign.actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ============================================================
// CampaignActions Component
// ============================================================

interface CampaignActionsProps {
  campaignId: string;
  status: string;
}

export function CampaignActions({ campaignId, status }: CampaignActionsProps) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [scheduleDate, setScheduleDate] = React.useState("");

  const isDraft = status === "DRAFT";
  const canSend = isDraft || status === "SCHEDULED";
  const canCancel = status !== "SENT" && status !== "CANCELLED";

  const handleSend = async () => {
    setIsPending(true);
    const result = await sendCampaign(campaignId);
    if (result.success) {
      toast.success("Campaign sent successfully");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setIsPending(false);
  };

  const handleCancel = async () => {
    setIsPending(true);
    const result = await cancelCampaign(campaignId);
    if (result.success) {
      toast.success("Campaign cancelled");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setIsPending(false);
  };

  const handleSchedule = async () => {
    if (!scheduleDate) {
      toast.error("Please select a date and time");
      return;
    }
    const parsedDate = new Date(scheduleDate);
    if (Number.isNaN(parsedDate.getTime())) {
      toast.error("Please enter a valid date and time");
      return;
    }
    if (parsedDate.getTime() <= Date.now()) {
      toast.error("Scheduled date and time must be in the future");
      return;
    }
    setIsPending(true);
    const result = await scheduleCampaign(campaignId, scheduleDate);
    if (result.success) {
      toast.success("Campaign scheduled successfully");
      setScheduleOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setIsPending(false);
  };

  return (
    <div className="flex items-center gap-2">
      {isDraft && (
        <>
          <Button variant="outline" asChild>
            <Link href={`/campaigns/${campaignId}/edit`}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </Link>
          </Button>

          {/* Schedule Dialog */}
          <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 size-4" />
                Schedule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Campaign</DialogTitle>
                <DialogDescription>
                  Choose when this campaign should be sent.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="scheduleDate">Send Date & Time</Label>
                <Input
                  id="scheduleDate"
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="mt-2"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setScheduleOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSchedule} disabled={isPending}>
                  {isPending && (
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                  )}
                  Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {canSend && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={isPending}>
              {isPending ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : (
                <SendIcon className="mr-2 size-4" />
              )}
              Send Now
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send Campaign</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to send this campaign now? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSend}>
                Send Campaign
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {canCancel && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isPending}>
              <XCircleIcon className="mr-2 size-4" />
              Cancel
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Campaign</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this campaign? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Go Back</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Cancel Campaign
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
