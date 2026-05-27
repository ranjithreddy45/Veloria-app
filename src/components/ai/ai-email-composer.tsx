"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  Copy,
  Send,
  RefreshCw,
  Bot,
  FileText,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

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
  const [provider, setProvider] = useState<string>("");

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
      setProvider("");
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
        const err = await res
          .json()
          .catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      if (data.success && data.data) {
        setSubject(data.data.subject);
        setBody(data.data.body);
        setGenerated(true);
        setProvider(data.provider || "template");
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
      const plainBody = body
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>\s*<p>/gi, "\n\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]*>/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      const text = `Subject: ${subject}\n\n${plainBody}`;
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

    if (!contactEmail) {
      toast.error("Contact has no email address");
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
        metadata: { generatedByAI: true, tone, provider },
      });

      if (result.success) {
        toast.success(`Email sent to ${contactEmail}`);
        handleOpenChange(false);
      } else {
        throw new Error(result.error || "Failed to send email");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send email";
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  }

  // Convert HTML body to readable plain text for editing
  const bodyPlainText = body
    .replace(/<br\s*\/?>/gi, "\n")       // <br/> → newline
    .replace(/<\/p>\s*<p>/gi, "\n\n")    // </p><p> → double newline (paragraph break)
    .replace(/<\/p>/gi, "\n\n")          // trailing </p> → double newline
    .replace(/<[^>]*>/g, "")             // strip remaining tags
    .replace(/\n{3,}/g, "\n\n")          // collapse 3+ newlines to 2
    .trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Sparkles className="mr-2 size-4" />
          AI Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            AI Email Composer
          </DialogTitle>
          <p className="text-muted-foreground text-sm">
            Generate a personalized email for{" "}
            <span className="font-medium text-foreground">{contactName}</span>
            {contactEmail ? (
              <span className="text-muted-foreground">
                {" "}
                ({contactEmail})
              </span>
            ) : (
              <span className="text-destructive text-xs ml-1">
                (no email on file)
              </span>
            )}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tone & Context Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="custom-subject">Subject (optional)</Label>
              <Input
                id="custom-subject"
                value={generated ? "" : subject}
                onChange={(e) => !generated && setSubject(e.target.value)}
                placeholder="Leave blank to auto-generate"
                disabled={generated}
              />
            </div>
          </div>

          {/* Context / Instruction */}
          <div className="space-y-2">
            <Label htmlFor="context">
              What should this email be about?
            </Label>
            <Textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g., Send a quote for their wedding reception on March 15th with 200 guests, include our premium package pricing..."
              rows={3}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-muted-foreground text-xs">
              Be specific — the more detail you give, the better the email.
              Leave blank for a general intro email.
            </p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full"
            size="lg"
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
              {/* Provider Badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Generated Email
                </span>
                <Badge
                  variant="secondary"
                  className="text-xs"
                >
                  {provider === "openai" ? (
                    <>
                      <Bot className="mr-1 size-3" />
                      OpenAI
                    </>
                  ) : provider === "gemini" ? (
                    <>
                      <Bot className="mr-1 size-3" />
                      Gemini AI
                    </>
                  ) : provider === "groq" ? (
                    <>
                      <Bot className="mr-1 size-3" />
                      Groq AI
                    </>
                  ) : (
                    <>
                      <FileText className="mr-1 size-3" />
                      Template
                    </>
                  )}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gen-subject">Subject</Label>
                <Input
                  id="gen-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gen-body">Body</Label>
                <Textarea
                  id="gen-body"
                  value={bodyPlainText || body}
                  onChange={(e) => {
                    // Convert plain text back to basic HTML paragraphs
                    const html = e.target.value
                      .split("\n\n")
                      .filter(Boolean)
                      .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
                      .join("\n");
                    setBody(html || e.target.value);
                  }}
                  rows={12}
                  className="text-sm leading-relaxed"
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
              Copy
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || !contactEmail}
            >
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
