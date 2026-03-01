"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Edit3, RotateCcw, Loader2, Eye } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REMINDER_STAGE_LABELS } from "@/lib/constants";
import {
  upsertReminderTemplate,
  resetToDefaultTemplate,
  previewReminderMessage,
} from "@/actions/reminder.actions";

interface ReminderTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  stage: string;
}

export function ReminderTemplateDialog({
  open,
  onOpenChange,
  bookingId,
  stage,
}: ReminderTemplateDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [preview, setPreview] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (open) {
      loadPreview();
    }
  }, [open, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPreview() {
    const result = await previewReminderMessage(bookingId, stage);
    if (result.success && result.data) {
      setMessageTemplate(result.data.template);
      setPreview(result.data.preview);
      setIsCustom(result.data.isCustom);
      setSubject(REMINDER_STAGE_LABELS[stage] || stage);
    }
  }

  function handleSave() {
    startTransition(async () => {
      const result = await upsertReminderTemplate({
        bookingId,
        stage: stage as any,
        subject,
        messageTemplate,
      });

      if (result.success) {
        toast.success("Template saved");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to save template");
      }
    });
  }

  function handleReset() {
    startTransition(async () => {
      const result = await resetToDefaultTemplate(bookingId, stage);
      if (result.success) {
        toast.success("Reset to default template");
        loadPreview();
      } else {
        toast.error(result.error || "Failed to reset");
      }
    });
  }

  function handlePreview() {
    startTransition(async () => {
      // Save temporarily and preview
      const result = await previewReminderMessage(bookingId, stage);
      if (result.success && result.data) {
        setPreview(result.data.preview);
        setShowPreview(true);
      }
    });
  }

  const stageLabel = REMINDER_STAGE_LABELS[stage] || stage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="size-4 text-indigo-500" />
            Customize {stageLabel} Message
          </DialogTitle>
          <DialogDescription>
            Edit the message template for this reminder stage. Use {"{guestName}"}, {"{eventName}"}, {"{eventDate}"}, {"{eventTime}"}, {"{venueName}"}, {"{daysUntil}"} as placeholders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm text-zinc-600">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1.5"
              maxLength={200}
            />
          </div>

          <div>
            <Label className="text-sm text-zinc-600">Message Template</Label>
            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="mt-1.5 resize-none font-mono text-xs"
              rows={8}
              maxLength={4096}
            />
            <p className="mt-1 text-right text-xs text-zinc-400">
              {messageTemplate.length}/4096
            </p>
          </div>

          {showPreview && preview && (
            <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="mb-1 text-xs font-medium text-zinc-500">Preview:</p>
              <pre className="whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
                {preview}
              </pre>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {isCustom && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isPending}
              className="mr-auto"
            >
              <RotateCcw className="mr-1 size-3.5" />
              Reset to Default
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <Eye className="mr-1 size-3.5" />
            )}
            Preview
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
