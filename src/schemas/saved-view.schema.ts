import { z } from "zod";

export const savedViewSchema = z.object({
  name: z.string().min(1, "View name is required").max(100),
  entityType: z.enum(["CONTACT", "LEAD", "DEAL", "TASK", "INVOICE"]),
  filters: z.array(
    z.object({
      field: z.string(),
      operator: z.enum(["equals", "contains", "gt", "lt", "gte", "lte", "in", "notIn", "isNull", "isNotNull"]),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
    })
  ).default([]),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  columns: z.array(z.string()).default([]),
  isDefault: z.boolean().optional().default(false),
  isShared: z.boolean().optional().default(false),
});

export type SavedViewInput = z.input<typeof savedViewSchema>;
export type SavedViewOutput = z.output<typeof savedViewSchema>;
