// ============================================================
// Workflow Executor — runs the actions configured on a Workflow
// ============================================================
//
// Replaces the original stub in `workflow.actions.ts` that just wrote
// SUCCESS rows. Each action type below has a real handler.
//
// Design notes:
//   - Each action is its own try/catch — a failure in one action does
//     NOT stop the workflow; subsequent actions still run. The result
//     of each is logged to WorkflowLog so failures are visible.
//   - The `WorkflowExecutionContext` carries IDs for the entity that
//     triggered the workflow (lead / booking / contact / invoice).
//     Actions reference those IDs to resolve recipients, statuses, etc.
//   - Templates ({{firstName}}, etc.) are resolved by `resolveTokens`
//     against a small context map. Use the same convention everywhere.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { notify } from "@/lib/notify";

// ============================================================
// Types
// ============================================================

export interface WorkflowExecutionContext {
  leadId?: string;
  bookingId?: string;
  contactId?: string;
  invoiceId?: string;
  paymentId?: string;
  /** Optional override for the user to credit for the run (defaults to system). */
  triggeredByUserId?: string;
}

interface ActionConfig {
  type: string;
  config: Record<string, unknown>;
}

interface ResolvedContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

interface RunContext extends WorkflowExecutionContext {
  contact: ResolvedContact | null;
  bookingNumber?: string | null;
  leadTitle?: string | null;
  invoiceNumber?: string | null;
}

// ============================================================
// Token resolver — replaces {{key}} placeholders
// ============================================================

function resolveTokens(template: string, ctx: RunContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    switch (key) {
      case "firstName":
        return ctx.contact?.firstName ?? "";
      case "lastName":
        return ctx.contact?.lastName ?? "";
      case "fullName":
        return ctx.contact
          ? `${ctx.contact.firstName} ${ctx.contact.lastName}`.trim()
          : "";
      case "email":
        return ctx.contact?.email ?? "";
      case "phone":
        return ctx.contact?.phone ?? "";
      case "bookingNumber":
        return ctx.bookingNumber ?? "";
      case "invoiceNumber":
        return ctx.invoiceNumber ?? "";
      case "leadTitle":
        return ctx.leadTitle ?? "";
      default:
        return `{{${key}}}`;
    }
  });
}

// ============================================================
// Context loader — fetches the entities referenced by IDs
// ============================================================

async function loadContext(
  base: WorkflowExecutionContext
): Promise<RunContext> {
  const ctx: RunContext = { ...base, contact: null };

  if (base.leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: base.leadId },
      select: {
        title: true,
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });
    if (lead) {
      ctx.leadTitle = lead.title;
      ctx.contact = lead.contact;
    }
  }

  if (!ctx.contact && base.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: base.bookingId },
      select: {
        bookingNumber: true,
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });
    if (booking) {
      ctx.bookingNumber = booking.bookingNumber;
      ctx.contact = booking.contact;
    }
  }

  if (!ctx.contact && base.contactId) {
    ctx.contact = await prisma.contact.findUnique({
      where: { id: base.contactId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });
  }

  if (base.invoiceId) {
    const inv = await prisma.invoice.findUnique({
      where: { id: base.invoiceId },
      select: { invoiceNumber: true },
    });
    if (inv) ctx.invoiceNumber = inv.invoiceNumber;
  }

  return ctx;
}

// ============================================================
// Email template loader
// ============================================================

async function loadEmailTemplate(name: string): Promise<{
  subject: string;
  body: string;
} | null> {
  const tpl = await prisma.emailTemplate.findFirst({
    where: { name, isActive: true },
    select: { subject: true, htmlContent: true },
  });
  if (!tpl) return null;
  return { subject: tpl.subject, body: tpl.htmlContent };
}

// ============================================================
// Action handlers
// ============================================================

async function handleSendEmail(
  config: Record<string, unknown>,
  ctx: RunContext
): Promise<{ ok: true; details: string } | { ok: false; error: string }> {
  const templateName = String(config.template ?? "");
  const toField = String(config.to ?? "contact");

  // Resolve recipient
  let recipient = "";
  if (toField === "contact" || toField === "" || toField === "{{email}}") {
    recipient = ctx.contact?.email ?? "";
  } else if (toField.includes("@")) {
    recipient = toField;
  } else {
    recipient = resolveTokens(toField, ctx);
  }

  if (!recipient) {
    return { ok: false, error: "No email recipient resolved" };
  }

  const tpl = templateName ? await loadEmailTemplate(templateName) : null;
  const subject = tpl
    ? resolveTokens(tpl.subject, ctx)
    : "A message from Veloria Grand";
  const html = tpl
    ? resolveTokens(tpl.body, ctx)
    : `<p>Hi ${ctx.contact?.firstName ?? "there"}, this is an automated message from Veloria Grand.</p>`;

  const result = await sendEmail({ to: recipient, subject, html });
  if (!result.success) {
    return { ok: false, error: result.error ?? "sendEmail failed" };
  }
  return { ok: true, details: `Sent to ${recipient}` };
}

async function handleSendWhatsApp(
  config: Record<string, unknown>,
  ctx: RunContext
): Promise<{ ok: true; details: string } | { ok: false; error: string }> {
  const messageField = String(config.message ?? config.template ?? "");
  const templateName = String(config.template ?? "");
  const toField = String(config.to ?? "contact");

  // Resolve recipient phone
  let phone = "";
  if (toField === "contact" || toField === "" || toField === "{{phone}}") {
    phone = ctx.contact?.phone ?? "";
  } else {
    phone = resolveTokens(toField, ctx);
  }
  if (!phone) {
    return { ok: false, error: "No WhatsApp recipient resolved" };
  }

  const message = messageField
    ? resolveTokens(messageField, ctx)
    : `Hi ${ctx.contact?.firstName ?? "there"}, this is a message from Veloria Grand.`;

  const result = await sendWhatsApp({
    to: phone,
    message,
    template: templateName || undefined,
  });
  if (!result.success) {
    return { ok: false, error: result.error ?? "sendWhatsApp failed" };
  }

  // Mirror to inbox if we know the contact
  if (ctx.contact?.id) {
    try {
      await prisma.whatsAppMessage.create({
        data: {
          direction: "OUTBOUND",
          content: message,
          status: "SENT",
          whatsappId: result.messageId ?? null,
          contactId: ctx.contact.id,
        },
      });
    } catch {
      // Logging is best-effort
    }
  }

  return { ok: true, details: `Sent to ${phone}` };
}

async function handleCreateTask(
  config: Record<string, unknown>,
  ctx: RunContext,
  workflowName: string
): Promise<{ ok: true; details: string } | { ok: false; error: string }> {
  const titleField = String(config.title ?? "Follow up");
  const assigneeId =
    typeof config.assigneeId === "string" && config.assigneeId.length > 0
      ? (config.assigneeId as string)
      : ctx.triggeredByUserId ?? null;

  if (!assigneeId) {
    // Fall back to first admin
    const admin = await prisma.user.findFirst({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
      select: { id: true },
    });
    if (!admin) {
      return { ok: false, error: "No assignee resolvable for task" };
    }
  }

  const finalAssignee =
    assigneeId ??
    (
      await prisma.user.findFirst({
        where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
        select: { id: true },
      })
    )?.id;

  if (!finalAssignee) {
    return { ok: false, error: "No assignee resolvable for task" };
  }

  const task = await prisma.task.create({
    data: {
      title: resolveTokens(titleField, ctx),
      description: `Auto-created by workflow: ${workflowName}`,
      status: "TODO",
      priority: "MEDIUM",
      assigneeId: finalAssignee,
      creatorId: finalAssignee,
      bookingId: ctx.bookingId ?? null,
    },
  });

  return { ok: true, details: `Task ${task.id}` };
}

async function handleSendNotification(
  config: Record<string, unknown>,
  ctx: RunContext
): Promise<{ ok: true; details: string } | { ok: false; error: string }> {
  const messageField = String(config.message ?? "Workflow notification");
  const userId = ctx.triggeredByUserId;

  if (!userId) {
    return { ok: false, error: "No user to notify" };
  }

  notify({
    userId,
    title: "Workflow notification",
    message: resolveTokens(messageField, ctx),
    type: "SYSTEM",
  });

  return { ok: true, details: `Notified user ${userId}` };
}

async function handleUpdateStatus(
  config: Record<string, unknown>,
  ctx: RunContext
): Promise<{ ok: true; details: string } | { ok: false; error: string }> {
  const newStatus = String(config.status ?? "");
  if (!newStatus) return { ok: false, error: "Status not provided" };

  // Pick the entity to update based on the context
  if (ctx.leadId) {
    await prisma.lead.update({
      where: { id: ctx.leadId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: newStatus as any },
    });
    return { ok: true, details: `Lead ${ctx.leadId} → ${newStatus}` };
  }
  if (ctx.bookingId) {
    await prisma.booking.update({
      where: { id: ctx.bookingId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: newStatus as any },
    });
    return { ok: true, details: `Booking ${ctx.bookingId} → ${newStatus}` };
  }
  if (ctx.invoiceId) {
    await prisma.invoice.update({
      where: { id: ctx.invoiceId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { status: newStatus as any },
    });
    return { ok: true, details: `Invoice ${ctx.invoiceId} → ${newStatus}` };
  }

  return { ok: false, error: "No entity in context to update status on" };
}

// ============================================================
// Public API — run a single workflow's actions
// ============================================================

// Re-entrancy guard: prevents the same workflow firing twice for the same
// entity within a single process lifetime (e.g. an UPDATE_STATUS action that
// indirectly re-triggers the workflow). Keyed by workflow+entity.
const inFlight = new Set<string>();

export async function runWorkflowActions(
  workflowId: string,
  baseCtx: WorkflowExecutionContext
): Promise<{ executed: number; succeeded: number; failed: number }> {
  const guardKey = `${workflowId}:${baseCtx.leadId ?? baseCtx.bookingId ?? baseCtx.contactId ?? baseCtx.invoiceId ?? "global"}`;
  if (inFlight.has(guardKey)) {
    console.warn(`[workflow-executor] Skipping re-entrant run: ${guardKey}`);
    return { executed: 0, succeeded: 0, failed: 0 };
  }
  inFlight.add(guardKey);

  try {
    return await runWorkflowActionsInner(workflowId, baseCtx);
  } finally {
    inFlight.delete(guardKey);
  }
}

async function runWorkflowActionsInner(
  workflowId: string,
  baseCtx: WorkflowExecutionContext
): Promise<{ executed: number; succeeded: number; failed: number }> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    select: { id: true, name: true, isActive: true, actions: true },
  });

  if (!workflow || !workflow.isActive) {
    return { executed: 0, succeeded: 0, failed: 0 };
  }

  const ctx = await loadContext(baseCtx);
  const actions = (workflow.actions as unknown as ActionConfig[]) ?? [];
  let succeeded = 0;
  let failed = 0;

  for (const action of actions) {
    let result:
      | { ok: true; details: string }
      | { ok: false; error: string };

    try {
      switch (action.type) {
        case "SEND_EMAIL":
          result = await handleSendEmail(action.config, ctx);
          break;
        case "SEND_WHATSAPP":
          result = await handleSendWhatsApp(action.config, ctx);
          break;
        case "CREATE_TASK":
          result = await handleCreateTask(action.config, ctx, workflow.name);
          break;
        case "SEND_NOTIFICATION":
          result = await handleSendNotification(action.config, ctx);
          break;
        case "UPDATE_STATUS":
          result = await handleUpdateStatus(action.config, ctx);
          break;
        default:
          result = {
            ok: false,
            error: `Unknown action type: ${action.type}`,
          };
      }
    } catch (e) {
      result = {
        ok: false,
        error: e instanceof Error ? e.message : "Action handler threw",
      };
    }

    try {
      await prisma.workflowLog.create({
        data: {
          workflowId,
          action: action.type,
          status: result.ok ? "SUCCESS" : "FAILED",
          error: result.ok ? null : result.error,
          bookingId: baseCtx.bookingId ?? null,
          contactId: ctx.contact?.id ?? baseCtx.contactId ?? null,
        },
      });
    } catch {
      // Logging itself shouldn't fail the run
    }

    if (result.ok) succeeded++;
    else failed++;
  }

  return { executed: actions.length, succeeded, failed };
}

// ============================================================
// triggerWorkflows — fire all workflows matching a trigger type
// ============================================================
// Call this from create/update hooks on Lead, Booking, Invoice, etc.
// Runs fire-and-forget by default — does NOT block the main flow.

export async function triggerWorkflows(
  trigger:
    | "LEAD_CREATED"
    | "EVENT_CREATED"
    | "BOOKING_CONFIRMED"
    | "PAYMENT_DUE"
    | "EVENT_TOMORROW"
    | "POST_EVENT",
  ctx: WorkflowExecutionContext
): Promise<void> {
  try {
    const workflows = await prisma.workflow.findMany({
      where: { trigger, isActive: true },
      select: { id: true, delayMinutes: true },
    });

    for (const wf of workflows) {
      // delayMinutes is honored for scheduled-style triggers. For now,
      // we execute immediately and rely on cron for time-based triggers.
      // A future improvement is to schedule via a job queue.
      runWorkflowActions(wf.id, ctx).catch((e) => {
        console.error(
          `[triggerWorkflows] Workflow ${wf.id} failed for trigger ${trigger}:`,
          e
        );
      });
    }
  } catch (e) {
    console.error(`[triggerWorkflows] Lookup failed for ${trigger}:`, e);
  }
}
