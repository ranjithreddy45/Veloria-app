// ============================================================
// Scoring Engine — Pure Evaluation Function
// ============================================================
// No database calls. The caller must pass entity data
// (including communication counts) and rules.

interface ScoringRuleDef {
  name: string;
  category: string;
  points: number;
  conditions: unknown[];
  isActive: boolean;
}

interface BreakdownItem {
  name: string;
  points: number;
  applied: boolean;
  earnedPoints: number;
}

interface EvaluationResult {
  total: number;
  breakdown: BreakdownItem[];
}

// ============================================================
// Field-Based Condition Operators
// ============================================================

function evaluateFieldCondition(
  entityData: Record<string, unknown>,
  condition: Record<string, unknown>
): boolean {
  const field = String(condition.field ?? "");
  const operator = String(condition.operator ?? "equals");
  const condValue = condition.value;
  const fieldValue = entityData[field];

  switch (operator) {
    case "equals":
      return String(fieldValue ?? "") === String(condValue ?? "");
    case "contains":
      return String(fieldValue ?? "")
        .toLowerCase()
        .includes(String(condValue ?? "").toLowerCase());
    case "gt":
      return Number(fieldValue) > Number(condValue);
    case "gte":
      return Number(fieldValue) >= Number(condValue);
    case "lt":
      return Number(fieldValue) < Number(condValue);
    case "lte":
      return Number(fieldValue) <= Number(condValue);
    case "in": {
      const list = Array.isArray(condValue) ? condValue : [];
      return list.includes(String(fieldValue));
    }
    default:
      return false;
  }
}

// ============================================================
// Category Evaluators
// ============================================================

function evaluateFieldBased(
  entityData: Record<string, unknown>,
  conditions: unknown[]
): boolean {
  // All conditions must match (AND logic)
  for (const cond of conditions) {
    const condition = cond as Record<string, unknown>;
    if (!evaluateFieldCondition(entityData, condition)) {
      return false;
    }
  }
  return conditions.length > 0;
}

function evaluateActivityBased(
  entityData: Record<string, unknown>,
  conditions: unknown[]
): boolean {
  // Conditions like [{activityWithinDays: 7}]
  // Caller should pass `_communicationCount_<days>` in entityData
  for (const cond of conditions) {
    const condition = cond as Record<string, unknown>;
    const withinDays = Number(condition.activityWithinDays ?? 0);
    if (withinDays <= 0) return false;
    const countKey = `_communicationCount_${withinDays}`;
    const count = Number(entityData[countKey] ?? 0);
    if (count <= 0) return false;
  }
  return conditions.length > 0;
}

function evaluateProfileCompleteness(
  entityData: Record<string, unknown>,
  conditions: unknown[],
  points: number
): number {
  // Conditions like [{fields: ["email", "phone", "eventType"]}]
  // Award proportional points based on how many fields are non-null
  for (const cond of conditions) {
    const condition = cond as Record<string, unknown>;
    const fields = Array.isArray(condition.fields) ? condition.fields : [];
    if (fields.length === 0) return 0;

    let filled = 0;
    for (const field of fields) {
      const val = entityData[String(field)];
      if (val !== null && val !== undefined && val !== "") {
        filled++;
      }
    }

    return Math.round((filled / fields.length) * points);
  }
  return 0;
}

function evaluateDecay(
  entityData: Record<string, unknown>,
  conditions: unknown[],
  points: number
): number {
  // Conditions like [{decayField: "updatedAt", decayIntervalDays: 7}]
  // Calculate how many intervals have passed and multiply by the (negative) points
  for (const cond of conditions) {
    const condition = cond as Record<string, unknown>;
    const decayField = String(condition.decayField ?? "updatedAt");
    const decayIntervalDays = Number(condition.decayIntervalDays ?? 7);
    if (decayIntervalDays <= 0) return 0;

    const fieldValue = entityData[decayField];
    if (!fieldValue) return 0;

    const fieldDate = new Date(String(fieldValue));
    if (isNaN(fieldDate.getTime())) return 0;

    const now = new Date();
    const diffMs = now.getTime() - fieldDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const intervals = Math.floor(diffDays / decayIntervalDays);

    if (intervals <= 0) return 0;

    // Points should be negative for decay; multiply intervals by points
    return intervals * points;
  }
  return 0;
}

// ============================================================
// Main Evaluation
// ============================================================

export function evaluateScore(
  entityData: Record<string, unknown>,
  rules: ScoringRuleDef[],
  maxScore: number
): EvaluationResult {
  const breakdown: BreakdownItem[] = [];
  let rawTotal = 0;

  for (const rule of rules) {
    if (!rule.isActive) {
      breakdown.push({
        name: rule.name,
        points: rule.points,
        applied: false,
        earnedPoints: 0,
      });
      continue;
    }

    const conditions = rule.conditions as Record<string, unknown>[];
    let earnedPoints = 0;
    let applied = false;

    switch (rule.category) {
      case "FIELD_BASED": {
        const matches = evaluateFieldBased(entityData, conditions);
        if (matches) {
          earnedPoints = rule.points;
          applied = true;
        }
        break;
      }
      case "ACTIVITY_BASED": {
        const hasActivity = evaluateActivityBased(entityData, conditions);
        if (hasActivity) {
          earnedPoints = rule.points;
          applied = true;
        }
        break;
      }
      case "PROFILE_COMPLETENESS": {
        earnedPoints = evaluateProfileCompleteness(entityData, conditions, rule.points);
        applied = earnedPoints > 0;
        break;
      }
      case "DECAY": {
        earnedPoints = evaluateDecay(entityData, conditions, rule.points);
        applied = earnedPoints !== 0;
        break;
      }
      default:
        break;
    }

    rawTotal += earnedPoints;
    breakdown.push({
      name: rule.name,
      points: rule.points,
      applied,
      earnedPoints,
    });
  }

  // Clamp between 0 and maxScore
  const total = Math.max(0, Math.min(maxScore, rawTotal));

  return { total, breakdown };
}
