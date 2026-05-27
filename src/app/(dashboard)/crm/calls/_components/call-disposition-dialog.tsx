"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, Plus } from "lucide-react";
import { logCall } from "@/actions/call.actions";
import { toast } from "sonner";

const DISPOSITIONS = [
  { value: "COMPLETED", label: "Completed" },
  { value: "NO_ANSWER", label: "No Answer" },
  { value: "BUSY", label: "Busy" },
  { value: "VOICEMAIL", label: "Voicemail" },
  { value: "WRONG_NUMBER", label: "Wrong Number" },
  { value: "CALLBACK_REQUESTED", label: "Callback Requested" },
];

export function CallDispositionDialog({
  contactId,
  contactName,
  externalCallId,
  recordingUrl,
}: {
  contactId?: string;
  contactName?: string;
  externalCallId?: string;
  recordingUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [direction, setDirection] = useState<"INBOUND" | "OUTBOUND">(
    "OUTBOUND"
  );
  const [disposition, setDisposition] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [durationSec, setDurationSec] = useState("");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [localContactId, setLocalContactId] = useState(contactId || "");

  const resetForm = () => {
    setDirection("OUTBOUND");
    setDisposition("");
    setDurationMin("");
    setDurationSec("");
    setNotes("");
    setFollowUpDate("");
    setFollowUpNotes("");
    if (!contactId) setLocalContactId("");
  };

  const handleSubmit = () => {
    if (!localContactId) {
      toast.error("Contact ID is required");
      return;
    }
    if (!disposition) {
      toast.error("Please select a disposition");
      return;
    }

    const durationSeconds =
      parseInt(durationMin || "0") * 60 + parseInt(durationSec || "0");

    startTransition(async () => {
      const result = await logCall({
        contactId: localContactId,
        direction,
        disposition: disposition as
          | "COMPLETED"
          | "NO_ANSWER"
          | "BUSY"
          | "VOICEMAIL"
          | "WRONG_NUMBER"
          | "CALLBACK_REQUESTED",
        durationSeconds,
        notes: notes || undefined,
        tags: [],
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        followUpNotes: followUpNotes || undefined,
        externalCallId: externalCallId || undefined,
        recordingUrl: recordingUrl || undefined,
      });

      if (result.success) {
        toast.success("Call logged successfully");
        resetForm();
        setOpen(false);
      } else {
        toast.error(result.error || "Failed to log call");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Log Call
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            {contactName ? `Log Call \u2014 ${contactName}` : "Log Call"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Contact ID (hidden if passed) */}
          {!contactId && (
            <div className="space-y-2">
              <Label>Contact ID</Label>
              <Input
                placeholder="Enter contact ID"
                value={localContactId}
                onChange={(e) => setLocalContactId(e.target.value)}
              />
            </div>
          )}

          {/* Direction */}
          <div className="space-y-2">
            <Label>Direction</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={direction === "OUTBOUND" ? "default" : "outline"}
                size="sm"
                onClick={() => setDirection("OUTBOUND")}
              >
                Outbound
              </Button>
              <Button
                type="button"
                variant={direction === "INBOUND" ? "default" : "outline"}
                size="sm"
                onClick={() => setDirection("INBOUND")}
              >
                Inbound
              </Button>
            </div>
          </div>

          {/* Disposition */}
          <div className="space-y-2">
            <Label>Disposition *</Label>
            <Select value={disposition} onValueChange={setDisposition}>
              <SelectTrigger>
                <SelectValue placeholder="Select disposition" />
              </SelectTrigger>
              <SelectContent>
                {DISPOSITIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                min={0}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">min</span>
              <Input
                type="number"
                placeholder="Sec"
                min={0}
                max={59}
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">sec</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Call notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Follow-up */}
          <div className="space-y-2">
            <Label>Follow-up Date</Label>
            <Input
              type="datetime-local"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
          </div>

          {followUpDate && (
            <div className="space-y-2">
              <Label>Follow-up Notes</Label>
              <Textarea
                placeholder="Follow-up notes..."
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                rows={2}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Logging..." : "Log Call"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
