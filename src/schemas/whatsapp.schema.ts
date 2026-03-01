import { z } from "zod";

// ============================================================
// Send WhatsApp Message Schema
// ============================================================

export const sendWhatsAppMessageSchema = z
  .object({
    contactId: z.string().min(1, "Contact is required"),
    content: z
      .string()
      .max(4096, "Message must be at most 4096 characters")
      .optional()
      .or(z.literal("")),
    templateName: z.string().optional().or(z.literal("")),
    params: z.record(z.string(), z.string()).optional(),
  })
  .refine((data) => data.content || data.templateName, {
    message: "Either a message or a template is required",
    path: ["content"],
  });

export type SendWhatsAppMessageInput = z.infer<
  typeof sendWhatsAppMessageSchema
>;

// ============================================================
// Get Conversation Schema
// ============================================================

export const getConversationSchema = z.object({
  contactId: z.string().min(1, "Contact ID is required"),
});

export type GetConversationInput = z.infer<typeof getConversationSchema>;

// ============================================================
// Bulk Send WhatsApp Schema
// ============================================================

export const bulkSendWhatsAppSchema = z.object({
  contactIds: z
    .array(z.string().min(1))
    .min(1, "At least one contact is required"),
  templateName: z.string().min(1, "Template name is required"),
  params: z.record(z.string(), z.string()).optional(),
});

export type BulkSendWhatsAppInput = z.infer<typeof bulkSendWhatsAppSchema>;

// ============================================================
// Get WhatsApp Stats Schema
// ============================================================

export const getWhatsAppStatsSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type GetWhatsAppStatsInput = z.infer<typeof getWhatsAppStatsSchema>;
