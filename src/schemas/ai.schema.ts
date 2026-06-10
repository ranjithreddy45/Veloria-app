import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

export const pageContextSchema = z.object({
  path: z.string().max(300).optional(),
  entityType: z.string().max(40).optional(),
  entityId: z.string().max(60).optional(),
  entityLabel: z.string().max(200).optional(),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  context: pageContextSchema.optional(),
});

export type PageContext = z.infer<typeof pageContextSchema>;

export const aiEmailSchema = z.object({
  contactId: z.string().min(1),
  tone: z.enum(["professional", "friendly", "urgent", "follow_up"]).default("professional"),
  context: z.string().max(500).optional(),
  subject: z.string().max(200).optional(),
});

export const aiSuggestionContextSchema = z.object({
  entityType: z.enum(["lead", "deal", "contact"]),
  entityId: z.string().min(1),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type AIEmailInput = z.infer<typeof aiEmailSchema>;
export type AISuggestionContext = z.infer<typeof aiSuggestionContextSchema>;
