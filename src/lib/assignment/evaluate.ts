// ============================================================
// Assignment-rule evaluation — INTERNAL engine.
// ------------------------------------------------------------
// Moved out of assignment-rule.actions.ts ("use server") on purpose: every
// export of a "use server" file is a publicly invokable HTTP endpoint, and this
// evaluator must be callable from unauthenticated server contexts (webhooks,
// the public landing form, cron) — which means it can carry NO auth gate of its
// own and therefore must NOT be an action. As a plain lib function it is only
// reachable from server code. The rule CRUD actions remain in the actions file,
// fully gated.
// ============================================================

import { prisma } from "@/lib/prisma";
import type { AssignmentRuleCondition } from "@/schemas/assignment-rule.schema";

// Roles a lead can be auto-assigned to (mirrors lead.actions.ts ASSIGNABLE_ROLES
// and the new/edit form's user list). A rule's stored assignToUserId/assignToTeam
// ids are NOT re-validated at config time, so a rep who is later deactivated or
// role-changed can linger in a rule. Re-check the candidate here before returning
// it, so leads never auto-route to a non-functional account (dead queue).
const ASSIGNABLE_ROLES = [
  "SALES_EXEC",
  "SALES_HEAD",
  "EVENT_COORDINATOR",
  "ADMIN",
  "SUPER_ADMIN",
];

// Returns true if the id is a real, active, assignable user.
async function isAssignableUser(userId: string): Promise<boolean> {
  if (!userId) return false;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });
  return !!u && u.isActive && ASSIGNABLE_ROLES.includes(u.role);
}

// Round-robin over a rule's team, advancing past members who are no longer
// active/assignable. Persists the index actually used so the rotation stays fair
// and returns the chosen id, or null if the whole pool is non-assignable.
async function pickRoundRobinAssignee(rule: {
  id: string;
  assignToTeam: string[];
  lastAssignedIdx: number;
}): Promise<string | null> {
  const team = rule.assignToTeam;
  if (team.length === 0) return null;
  for (let step = 1; step <= team.length; step++) {
    const idx = (rule.lastAssignedIdx + step) % team.length;
    const candidate = team[idx];
    if (await isAssignableUser(candidate)) {
      await prisma.assignmentRule.update({
        where: { id: rule.id },
        data: { lastAssignedIdx: idx },
      });
      return candidate;
    }
  }
  return null;
}

export async function evaluateAssignmentRules(
  leadData: Record<string, unknown>
): Promise<string | null> {
  try {
    const rules = await prisma.assignmentRule.findMany({
      where: { entityType: "LEAD", isActive: true },
      orderBy: { priority: "asc" },
    });

    for (const rule of rules) {
      const conditions = rule.conditions as unknown as AssignmentRuleCondition[];
      let allMatch = true;

      for (const condition of conditions) {
        const fieldValue = leadData[condition.field];
        const condValue = condition.value;

        switch (condition.operator) {
          case "equals":
            if (String(fieldValue) !== String(condValue)) allMatch = false;
            break;
          case "contains":
            if (!String(fieldValue ?? "").toLowerCase().includes(String(condValue).toLowerCase()))
              allMatch = false;
            break;
          case "in":
            if (Array.isArray(condValue) && !condValue.includes(String(fieldValue)))
              allMatch = false;
            break;
          case "gt":
            if (Number(fieldValue) <= Number(condValue)) allMatch = false;
            break;
          case "gte":
            if (Number(fieldValue) < Number(condValue)) allMatch = false;
            break;
          case "lt":
            if (Number(fieldValue) >= Number(condValue)) allMatch = false;
            break;
          case "lte":
            if (Number(fieldValue) > Number(condValue)) allMatch = false;
            break;
          default:
            allMatch = false;
        }

        if (!allMatch) break;
      }

      if (allMatch) {
        if (rule.assignmentMethod === "DIRECT" && rule.assignToUserId) {
          // Skip a deactivated/role-changed direct assignee so the lead falls
          // through to the next rule / capture's fallbacks instead of landing
          // in a dead queue.
          if (await isAssignableUser(rule.assignToUserId)) {
            return rule.assignToUserId;
          }
          continue;
        }

        // SMART: pick the available, lightest-loaded, best-matched rep from the
        // rule's candidate pool. On a miss, fall through to ROUND_ROBIN over the
        // same pool so leads are never dropped. Never throws on the hot path.
        if (rule.assignmentMethod === "SMART") {
          try {
            const { chooseSmartAssignee, recordRoutingDecision } = await import(
              "@/lib/routing/smart-router"
            );
            const choice = await chooseSmartAssignee({
              team: rule.assignToTeam,
              eventType: String(leadData.eventType ?? ""),
              languageHints: leadData.language ? [String(leadData.language)] : [],
            });
            if (choice) {
              const leadId = leadData.id ? String(leadData.id) : null;
              if (leadId) {
                await recordRoutingDecision({
                  leadId,
                  assignedToId: choice.assigneeId,
                  method: "SMART",
                  matchedEventType: choice.matchedEventType,
                  matchedLanguage: choice.matchedLanguage,
                  repLoadAtDecision: choice.repLoadAtDecision,
                  ruleId: rule.id,
                  scoreBreakdown: choice.scoreBreakdown as unknown as Record<
                    string,
                    unknown
                  >,
                });
              }
              return choice.assigneeId;
            }
          } catch (e) {
            console.error("[evaluateAssignmentRules] SMART error:", e);
          }
          // SMART miss → graceful ROUND_ROBIN over the same candidate pool.
          if (rule.assignToTeam.length > 0) {
            const picked = await pickRoundRobinAssignee(rule);
            if (picked) return picked;
          }
        }

        if (rule.assignmentMethod === "ROUND_ROBIN" && rule.assignToTeam.length > 0) {
          const picked = await pickRoundRobinAssignee(rule);
          if (picked) return picked;
          // No assignable member in the pool → fall through to the next rule.
          continue;
        }
      }
    }

    return null;
  } catch (error) {
    console.error("evaluateAssignmentRules error:", error);
    return null;
  }
}
