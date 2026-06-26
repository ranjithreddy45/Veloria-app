"use client";

import { useState } from "react";
import { Sparkles, Send, Loader2, RotateCcw, Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  generateReplyDrafts,
  sendReplyVariant,
} from "@/actions/whatsapp-console.actions";

// ============================================================
// Co-pilot Panel — AI reply suggestions inside the chat view.
// ------------------------------------------------------------
// On-demand: "Draft replies" calls generateReplyDrafts (whatsapp:reply). Renders
// 1-3 tone-labelled variant cards the rep can edit inline, then "Send" calls
// sendReplyVariant (whatsapp:send → reuses sendWhatsAppMessage). When the AI is
// off, variants are labelled "suggested" (model === 'none'). When the 24h
// session is closed, a hint nudges the rep toward a template (the send action
// still enforces the real gate at the integration layer).
// ============================================================

interface Variant {
  tone: string;
  text: string;
}

interface CopilotPanelProps {
  contactId: string;
  /** Whether the 24h customer-service window is open (free-text allowed). */
  sessionOpen: boolean;
  /** Called after a successful send so the parent can refresh the thread. */
  onSent?: () => void;
  className?: string;
}

export function CopilotPanel({
  contactId,
  sessionOpen,
  onSent,
  className,
}: CopilotPanelProps) {
  const [generating, setGenerating] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [model, setModel] = useState<string>("none");
  const [sentDraft, setSentDraft] = useState(false);
  const [sendingIdx, setSendingIdx] = useState<number | null>(null);

  const aiOff = model === "none";

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generateReplyDrafts({ contactId });
      if (result.success && result.data) {
        const data = result.data as {
          draftId: string;
          variants: Variant[];
          model: string;
        };
        setDraftId(data.draftId);
        setVariants(data.variants);
        setDrafts(data.variants.map((v) => v.text));
        setModel(data.model);
        setSentDraft(false);
      } else {
        toast.error(result.error || "Failed to generate drafts");
      }
    } catch {
      toast.error("Failed to generate drafts");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend(idx: number) {
    const text = drafts[idx]?.trim();
    if (!text) {
      toast.error("Cannot send an empty reply");
      return;
    }
    if (sentDraft) return; // one-shot guard per draft (also enforced server-side)

    setSendingIdx(idx);
    try {
      const result = await sendReplyVariant({
        contactId,
        draftId: draftId || undefined,
        variantIdx: idx,
        text,
      });
      if (result.success) {
        toast.success("Reply sent");
        setSentDraft(true);
        onSent?.();
      } else {
        toast.error(result.error || "Failed to send reply");
      }
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSendingIdx(null);
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 p-3",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Sparkles className="size-3.5 text-violet-500" />
          AI Co-pilot
          {aiOff && variants.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              suggested
            </Badge>
          )}
        </div>
        {variants.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={handleGenerate}
            disabled={generating}
          >
            <RotateCcw className="mr-1 size-3" />
            Regenerate
          </Button>
        )}
      </div>

      {/* Closed-session hint — actual gating happens in the send action. */}
      {!sessionOpen && (
        <div className="mb-2 flex items-start gap-1.5 rounded bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <Lock className="mt-0.5 size-3 shrink-0" />
          <span>
            The 24h window is closed — free-text may be rejected by WhatsApp. Use
            a template from the composer, or send a re-engagement draft below.
          </span>
        </div>
      )}

      {variants.length === 0 ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              Drafting replies...
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 size-3.5" />
              Draft replies
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-2">
          {variants.map((variant, idx) => (
            <div
              key={idx}
              className="rounded-md border bg-background p-2"
            >
              <div className="mb-1 flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="h-4 px-1.5 text-[10px] font-medium"
                >
                  {variant.tone}
                </Badge>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Pencil className="size-2.5" />
                  editable
                </span>
              </div>
              <Textarea
                value={drafts[idx] ?? ""}
                onChange={(e) =>
                  setDrafts((prev) => {
                    const next = [...prev];
                    next[idx] = e.target.value;
                    return next;
                  })
                }
                className="min-h-[60px] resize-none text-sm"
                disabled={sentDraft}
              />
              <div className="mt-1.5 flex justify-end">
                <Button
                  size="sm"
                  className="h-7 bg-emerald-600 text-xs hover:bg-emerald-700"
                  onClick={() => handleSend(idx)}
                  disabled={
                    sentDraft ||
                    sendingIdx !== null ||
                    !drafts[idx]?.trim()
                  }
                >
                  {sendingIdx === idx ? (
                    <Loader2 className="mr-1 size-3 animate-spin" />
                  ) : (
                    <Send className="mr-1 size-3" />
                  )}
                  Send this
                </Button>
              </div>
            </div>
          ))}
          {sentDraft && (
            <p className="text-center text-[11px] text-muted-foreground">
              Reply sent. Generate fresh drafts to continue.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
