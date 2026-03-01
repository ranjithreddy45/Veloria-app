import { z } from "zod";

export const macroActionSchema = z.object({
  type: z.enum(["UPDATE_FIELD", "CREATE_TASK", "LOG_COMMUNICATION", "UPDATE_STATUS"]),
  config: z.record(z.string(), z.unknown()),
});

export const macroSchema = z.object({
  name: z.string().min(1, "Macro name is required").max(100),
  description: z.string().optional(),
  entityType: z.enum(["LEAD", "CONTACT", "DEAL", "BOOKING"]),
  icon: z.string().default("Zap"),
  color: z.string().default("#6366f1"),
  actions: z.array(macroActionSchema).min(1, "At least one action is required"),
  isShared: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type MacroInput = z.input<typeof macroSchema>;
export type MacroAction = z.infer<typeof macroActionSchema>;
