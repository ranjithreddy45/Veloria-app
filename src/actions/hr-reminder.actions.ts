"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; role?: string; name?: string | null };
}
function can(role: string | undefined, perm: string) {
  return !!role && hasPermission(role, perm);
}

const TRIGGERS = ["BIRTHDAY", "WORK_ANNIVERSARY", "DOC_EXPIRY", "PROBATION_END", "CONTRACT_END"];
const CHANNELS = ["EMAIL", "INAPP"];

const SETTINGS_PATH = "/people/settings/reminders";

export interface ReminderRuleListItem {
  id: string;
  name: string;
  trigger: string;
  daysBefore: number;
  channel: string;
  audienceRole: string | null;
  messageTpl: string | null;
  active: boolean;
  lastRunOn: Date | null;
}

// ============================================================
// HR Reminder Rules — admin CRUD master. The daily HR cron
// evaluates these rules; this module only manages them.
// ============================================================

export async function listReminderRules(): Promise<ReminderRuleListItem[]> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return [];
  const rules = await prisma.hrReminderRule.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      trigger: true,
      daysBefore: true,
      channel: true,
      audienceRole: true,
      messageTpl: true,
      active: true,
      lastRunOn: true,
    },
  });
  return rules;
}

export interface ReminderRuleInput {
  id?: string;
  name: string;
  trigger: string;
  daysBefore: number;
  channel: string;
  audienceRole?: string | null;
  messageTpl?: string | null;
  active?: boolean;
}

export async function upsertReminderRule(input: ReminderRuleInput): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };

  const name = input.name?.trim();
  if (!name) return { success: false, error: "Name is required." };
  if (!TRIGGERS.includes(input.trigger)) return { success: false, error: "Pick a valid trigger." };
  if (!CHANNELS.includes(input.channel)) return { success: false, error: "Pick a valid channel." };

  const daysBefore = Number(input.daysBefore);
  if (!Number.isFinite(daysBefore) || !Number.isInteger(daysBefore) || daysBefore < 0)
    return { success: false, error: "Days before must be a whole number of 0 or more." };

  const data = {
    name,
    trigger: input.trigger,
    daysBefore,
    channel: input.channel,
    audienceRole: input.audienceRole?.trim() || null,
    messageTpl: input.messageTpl?.trim() || null,
    active: input.active ?? true,
  };

  try {
    if (input.id) {
      await prisma.hrReminderRule.update({ where: { id: input.id }, data });
      revalidatePath(SETTINGS_PATH);
      return { success: true, data: { id: input.id } };
    }
    const created = await prisma.hrReminderRule.create({
      data: { ...data, createdById: u!.id },
    });
    revalidatePath(SETTINGS_PATH);
    return { success: true, data: { id: created.id } };
  } catch {
    return { success: false, error: "Could not save the reminder rule." };
  }
}

export async function toggleReminderRule(id: string): Promise<Result<{ id: string; active: boolean }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  const rule = await prisma.hrReminderRule.findUnique({ where: { id }, select: { active: true } });
  if (!rule) return { success: false, error: "Reminder rule not found." };
  try {
    await prisma.hrReminderRule.update({ where: { id }, data: { active: !rule.active } });
    revalidatePath(SETTINGS_PATH);
    return { success: true, data: { id, active: !rule.active } };
  } catch {
    return { success: false, error: "Could not update the reminder rule." };
  }
}

export async function deleteReminderRule(id: string): Promise<Result<{ id: string }>> {
  const u = await requireUser();
  if (!can(u?.role, "hr:admin")) return { success: false, error: "Not authorized." };
  try {
    await prisma.hrReminderRule.delete({ where: { id } });
    revalidatePath(SETTINGS_PATH);
    return { success: true, data: { id } };
  } catch {
    return { success: false, error: "Could not delete the reminder rule." };
  }
}
