import { z } from "zod";

export const bulkUpdateContactsSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one contact"),
  data: z.object({
    type: z.enum(["INDIVIDUAL", "CORPORATE"]).optional(),
    tags: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one record"),
});

export const bulkUpdateLeadsSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one lead"),
  data: z.object({
    status: z
      .enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"])
      .optional(),
    assignedToId: z.string().optional(),
    source: z
      .enum(["WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "WALK_IN", "PHONE_INQUIRY", "EMAIL", "EVENT", "PARTNER", "ADVERTISEMENT", "OTHER"])
      .optional(),
  }),
});

export const bulkAssignLeadsSchema = z.object({
  ids: z.array(z.string()).min(1, "Select at least one lead"),
  assignedToId: z.string().min(1, "Select an assignee"),
});

export type BulkUpdateContactsInput = z.infer<typeof bulkUpdateContactsSchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
export type BulkUpdateLeadsInput = z.infer<typeof bulkUpdateLeadsSchema>;
export type BulkAssignLeadsInput = z.infer<typeof bulkAssignLeadsSchema>;
