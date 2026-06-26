import { z } from "zod";

// ============================================================
// WhatsApp Console — Co-pilot & Reply Schemas
// ------------------------------------------------------------
// Mirrors whatsapp.schema.ts conventions. Parsed before any DB write in
// whatsapp-console.actions.ts (generateReplyDrafts / sendReplyVariant).
// ============================================================

// ------------------------------------------------------------
// Generate Reply Drafts (AI co-pilot) — gated whatsapp:reply
// ------------------------------------------------------------

export const generateReplyDraftsSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
});

export type GenerateReplyDraftsInput = z.infer<typeof generateReplyDraftsSchema>;

// ------------------------------------------------------------
// Send Reply Variant — gated whatsapp:send
// ------------------------------------------------------------
// The rep may send a free-text variant (open 24h session) OR a template
// (closed session). The send action enforces the session-window rule; this
// schema only validates shape. `text` carries the (possibly rep-edited)
// free-text; `templateName`/`params` carry the closed-session template path.
// ------------------------------------------------------------

export const sendReplyVariantSchema = z
  .object({
    contactId: z.string().min(1, "Contact is required"),
    // Optional link back to the originating draft for one-shot send bookkeeping.
    draftId: z.string().optional().or(z.literal("")),
    // Which variant the rep chose (>= 0). -1 / absent allowed for an ad-hoc
    // (non-draft) free-text send, but the action defaults to 0 when a draft is
    // present.
    variantIdx: z.number().int().min(0).optional(),
    text: z
      .string()
      .max(4096, "Message must be at most 4096 characters")
      .optional()
      .or(z.literal("")),
    templateName: z.string().optional().or(z.literal("")),
    params: z.record(z.string(), z.string()).optional(),
  })
  .refine((data) => Boolean(data.text?.trim()) || Boolean(data.templateName), {
    message: "Either a message or a template is required",
    path: ["text"],
  });

export type SendReplyVariantInput = z.infer<typeof sendReplyVariantSchema>;
