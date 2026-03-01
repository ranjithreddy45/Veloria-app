"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";

import { logCommunication } from "@/actions/communication.actions";
import { COMMUNICATION_TYPE_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================================
// Props
// ============================================================

interface LogCommunicationDialogProps {
  contactId: string;
  bookingId?: string;
}

// ============================================================
// Communication Types & Directions
// ============================================================

const COMMUNICATION_TYPES = [
  "NOTE",
  "CALL",
  "EMAIL",
  "SMS",
  "MEETING",
  "WHATSAPP",
] as const;

const DIRECTION_LABELS: Record<string, string> = {
  INBOUND: "Inbound",
  OUTBOUND: "Outbound",
};

// ============================================================
// Log Communication Dialog Component
// ============================================================

export function LogCommunicationDialog({
  contactId,
  bookingId,
}: LogCommunicationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [type, setType] = useState<string>("NOTE");
  const [direction, setDirection] = useState<string>("OUTBOUND");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  function resetForm() {
    setType("NOTE");
    setDirection("OUTBOUND");
    setSubject("");
    setContent("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!content.trim()) {
      toast.error("Content is required");
      return;
    }

    startTransition(async () => {
      const result = await logCommunication({
        type: type as "NOTE" | "CALL" | "EMAIL" | "SMS" | "MEETING" | "WHATSAPP",
        direction: direction as "INBOUND" | "OUTBOUND",
        subject: subject.trim() || undefined,
        content: content.trim(),
        contactId,
        bookingId: bookingId || undefined,
      });

      if (result.success) {
        toast.success("Communication logged successfully");
        resetForm();
        setOpen(false);
      } else {
        toast.error(result.error || "Failed to log communication");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-2 size-4" />
          Log Communication
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Communication</DialogTitle>
          <DialogDescription>
            Record a communication with this contact.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type & Direction Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="comm-type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="comm-type" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {COMMUNICATION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {COMMUNICATION_TYPE_LABELS[t] ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="comm-direction">Direction</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger id="comm-direction" className="w-full">
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DIRECTION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="comm-subject">Subject (optional)</Label>
            <Input
              id="comm-subject"
              placeholder="Brief subject line..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="comm-content">Content</Label>
            <Textarea
              id="comm-content"
              placeholder="Details of the communication..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              required
              maxLength={10000}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
