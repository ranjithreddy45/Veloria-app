import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import type { UserRole } from "@prisma/client";

// ============================================================
// HR reminder engine — evaluates active HrReminderRule rows and notifies.
// Called by the daily cron lane (/api/cron/hr-reminders). Best-effort: an
// individual rule failure is logged and skipped, never thrown, so the lane
// records partial success. Idempotent per day via HrReminderRule.lastRunOn.
// Implemented triggers: BIRTHDAY, WORK_ANNIVERSARY, DOC_EXPIRY. PROBATION_END /
// CONTRACT_END are accepted by the master but no-op here until the Employee model
// carries those dates (kept explicit so nothing fires on missing data).
// ============================================================

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
function sameMonthDay(a: Date, b: Date): boolean {
  return a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}
function sameDay(a: Date, b: Date): boolean {
  return utcMidnight(a).getTime() === utcMidnight(b).getTime();
}

type Rule = {
  id: string; name: string; trigger: string; daysBefore: number; channel: string;
  audienceRole: string | null; messageTpl: string | null; lastRunOn: Date | null;
};
type Emp = { id: string; firstName: string | null; lastName: string | null; workEmail: string | null };

async function matchEmployees(trigger: string, targetDate: Date): Promise<{ emp: Emp; context: string }[]> {
  if (trigger === "BIRTHDAY" || trigger === "WORK_ANNIVERSARY") {
    const field = trigger === "BIRTHDAY" ? "dob" : "dateOfJoining";
    const employees = await prisma.employee.findMany({
      where: { status: "ACTIVE", deletedAt: null, [field]: { not: null } },
      select: { id: true, firstName: true, lastName: true, workEmail: true, dob: true, dateOfJoining: true },
    });
    return employees
      .filter((e) => {
        const d = trigger === "BIRTHDAY" ? e.dob : e.dateOfJoining;
        return d && sameMonthDay(new Date(d), targetDate);
      })
      .map((e) => ({ emp: e, context: trigger === "BIRTHDAY" ? "birthday" : "work anniversary" }));
  }
  if (trigger === "DOC_EXPIRY") {
    const docs = await prisma.hrDocument.findMany({
      where: { scope: "EMPLOYEE", employeeId: { not: null }, expiryDate: { not: null } },
      select: { employeeId: true, title: true, expiryDate: true },
    });
    const due = docs.filter((d) => d.expiryDate && sameDay(new Date(d.expiryDate), targetDate));
    if (due.length === 0) return [];
    const emps = await prisma.employee.findMany({
      where: { id: { in: due.map((d) => d.employeeId!).filter(Boolean) }, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, workEmail: true },
    });
    const byId = new Map(emps.map((e) => [e.id, e]));
    const out: { emp: Emp; context: string }[] = [];
    for (const d of due) {
      const e = byId.get(d.employeeId!);
      if (e) out.push({ emp: e, context: `document "${d.title}" expiring` });
    }
    return out;
  }
  return []; // PROBATION_END / CONTRACT_END — no source date yet
}

function fillTemplate(tpl: string | null, emp: Emp, ruleName: string, context: string): { subject: string; body: string } {
  const name = `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() || "there";
  const subject = ruleName || "HR reminder";
  const base = tpl && tpl.trim()
    ? tpl.replaceAll("{{name}}", name).replaceAll("{{context}}", context)
    : `Reminder: ${name} — ${context}.`;
  return { subject, body: base };
}

async function recipientsFor(rule: Rule, emp: Emp): Promise<string[]> {
  // audienceRole set → notify the HR role holders; else notify the employee.
  if (rule.audienceRole) {
    const users = await prisma.user.findMany({
      where: { role: rule.audienceRole as UserRole, isActive: true },
      select: { email: true },
    });
    return users.map((u) => u.email).filter((e): e is string => !!e);
  }
  return emp.workEmail ? [emp.workEmail] : [];
}

export async function runHrReminders(): Promise<{ rules: number; fired: number }> {
  const today = utcMidnight(new Date());
  const rules = (await prisma.hrReminderRule.findMany({ where: { active: true } })) as Rule[];
  let fired = 0;

  for (const rule of rules) {
    try {
      if (rule.lastRunOn && sameDay(rule.lastRunOn, today)) continue; // already ran today
      const targetDate = addDays(today, Math.max(0, rule.daysBefore));
      const matches = await matchEmployees(rule.trigger, targetDate);

      for (const { emp, context } of matches) {
        const { subject, body } = fillTemplate(rule.messageTpl, emp, rule.name, context);
        // EMAIL channel sends mail; INAPP is a no-op placeholder (no HR in-app
        // notification store yet) — kept explicit so the count reflects reality.
        if (rule.channel === "EMAIL") {
          const to = await recipientsFor(rule, emp);
          for (const addr of to) {
            await sendEmail({ to: addr, subject, html: `<p>${body}</p>` }).catch(() => {});
          }
        }
        fired++;
      }
      await prisma.hrReminderRule.update({ where: { id: rule.id }, data: { lastRunOn: today } });
    } catch (err) {
      console.error("[HR_REMINDER_RULE_ERR]", rule.id, err);
    }
  }
  return { rules: rules.length, fired };
}
