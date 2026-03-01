"use client";

import { useState } from "react";
import { Sparkles, Loader2, Copy, Send, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { logCommunication } from "@/actions/communication.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
// Types
// ============================================================

interface AIEmailComposerProps {
  contactId: string;
  contactName: string;
  contactEmail?: string | null;
  bookingId?: string;
  defaultContext?: string;
}

// ============================================================
// Component
// ============================================================

export function AIEmailComposer({
  contactId,
  contactName,
  contactEmail,
  bookingId,
  defaultContext,
}: AIEmailComposerProps) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState("professional");
  const [context, setContext] = useState(defaultContext ?? "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Generated email state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generated, setGenerated] = useState(false);

  // Reset state when dialog closes
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setTone("professional");
      setContext(defaultContext ?? "");
      setSubject("");
      setBody("");
      setGenerated(false);
      setIsGenerating(false);
      setIsSending(false);
    }
  }

  // Generate email via API
  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          tone,
          context: context || undefined,
          subject: subject || undefined,
        }),
      });

      if (res.status === 503) {
        toast.error("AI is not configured. Please set the OPENAI_API_KEY.");
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      if (data.success && data.data) {
        setSubject(data.data.subject);
        setBody(data.data.body);
        setGenerated(true);
      } else {
        throw new Error(data.error || "Failed to generate email");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to generate email";
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }

  // Copy email to clipboard
  async function handleCopy() {
    try {
      const text = `Subject: ${subject}\n\n${body.replace(/<[^>]*>/g, "")}`;
      await navigator.clipboard.writeText(text);
      toast.success("Email copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  // Send / log the email
  async function handleSend() {
    if (!subject || !body) {
      toast.error("Please generate an email first");
      return;
    }

    setIsSending(true);
    try {
      const result = await logCommunication({
        type: "EMAIL",
        direction: "OUTBOUND",
        subject,
        content: body,
        contactId,
        bookingId: bookingId || undefined,
        metadata: { generatedByAI: true, tone },
      });

      if (result.success) {
        toast.success("Email logged successfully");
        handleOpenChange(false);
      } else {
        throw new Error(result.error || "Failed to log email");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send email";
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Sparkles className="mr-2 size-4" />
          AI Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            AI Email Composer
          </DialogTitle>
          <p className="text-muted-foreground text-sm">
            Generate a personalized email for{" "}
            <span className="font-medium text-foreground">{contactName}</span>
            {contactEmail && (
              <span className="text-muted-foreground">
                {" "}
                ({contactEmail})
              </span>
            )}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tone Selector */}
          <div className="space-y-2">
            <Label htmlFor="tone">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger id="tone">
                <SelectValue placeholder="Select tone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Context */}
          <div className="space-y-2">
            <Label htmlFor="context">Context (optional)</Label>
            <Textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g., Follow up on venue visit, Share wedding packages..."
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Generating...
              </>
            ) : generated ? (
              <>
                <RefreshCw className="mr-2 size-4" />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                Generate Email
              </>
            )}
          </Button>

          {/* Generated Email */}
          {generated && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Body</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {generated && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={handleCopy} disabled={isSending}>
              <Copy className="mr-2 size-4" />
              Copy to Clipboard
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 size-4" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
