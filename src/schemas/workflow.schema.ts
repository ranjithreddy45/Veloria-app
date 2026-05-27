import { z } from "zod";

// ============================================================
// Workflow Trigger & Action Type Enum Values (matching Prisma)
// ============================================================

const workflowTriggerValues = [
  "EVENT_CREATED",
  "BOOKING_CONFIRMED",
  "PAYMENT_DUE",
  "EVENT_TOMORROW",
  "POST_EVENT",
  "LEAD_CREATED",
] as const;

const workflowActionTypeValues = [
  "SEND_EMAIL",
  "CREATE_TASK",
  "SEND_NOTIFICATION",
  "UPDATE_STATUS",
  "SEND_WHATSAPP",
] as const;

// ============================================================
// Workflow Action Config Schemas
// ============================================================

const sendEmailConfigSchema = z.object({
  template: z.string().min(1, "Email template is required"),
  to: z.string().min(1, "Recipient is required"),
});

const createTaskConfigSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  assigneeId: z.string().optional().or(z.literal("")),
});

const sendNotificationConfigSchema = z.object({
  message: z.string().min(1, "Notification message is required"),
});

const updateStatusConfigSchema = z.object({
  status: z.string().min(1, "Status is required"),
});

// ============================================================
// Workflow Action Schema
// ============================================================

export const workflowActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SEND_EMAIL"),
    config: sendEmailConfigSchema,
  }),
  z.object({
    type: z.literal("CREATE_TASK"),
    config: createTaskConfigSchema,
  }),
  z.object({
    type: z.literal("SEND_NOTIFICATION"),
    config: sendNotificationConfigSchema,
  }),
  z.object({
    type: z.literal("UPDATE_STATUS"),
    config: updateStatusConfigSchema,
  }),
]);

export type WorkflowAction = z.infer<typeof workflowActionSchema>;

// ============================================================
// Workflow Create/Update Schema
// ============================================================

export const workflowSchema = z.object({
  name: z
    .string()
    .min(1, "Workflow name is required")
    .max(200, "Workflow name must be at most 200 characters"),
  trigger: z.enum(workflowTriggerValues, {
    error: "Trigger is required",
  }),
  actions: z
    .array(workflowActionSchema)
    .min(1, "At least one action is required"),
  isActive: z.boolean().optional().default(true),
  delayMinutes: z
    .number({ error: "Delay must be a number" })
    .int("Delay must be a whole number")
    .min(0, "Delay cannot be negative")
    .optional()
    .nullable(),
});

export type WorkflowInput = z.infer<typeof workflowSchema>;

// ============================================================
// Execute Workflow Context Schema
// ============================================================

export const executeWorkflowContextSchema = z.object({
  bookingId: z.string().optional(),
  contactId: z.string().optional(),
});

export type ExecuteWorkflowContext = z.infer<typeof executeWorkflowContextSchema>;

// ============================================================
// Exported Constants
// ============================================================

export { workflowTriggerValues, workflowActionTypeValues };
