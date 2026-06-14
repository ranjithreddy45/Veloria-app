import { prisma } from "@/lib/prisma";

// ============================================================
// AI Lead Scoring (Rule-Based Placeholder)
// ============================================================
// Mimics AI-powered lead scoring using deterministic rules.
// Will be replaced with real OpenAI-based scoring later.

// ============================================================
// Source Score Map
// ============================================================

const SOURCE_SCORES: Record<string, number> = {
  REFERRAL: 20,
  WEBSITE: 15,
  PARTNER: 15,
  EVENT: 12,
  SOCIAL_MEDIA: 12,
  PHONE_INQUIRY: 10,
  EMAIL: 10,
  WALK_IN: 10,
  ADVERTISEMENT: 8,
  OTHER: 5,
};

// ============================================================
// Status Progression Score Map
// ============================================================

const STATUS_SCORES: Record<string, number> = {
  NEW: 5,
  CONTACTED: 10,
  QUALIFIED: 20,
  PROPOSAL_SENT: 25,
  NEGOTIATION: 30,
  WON: 0, // Excluded from scoring
  LOST: 0, // Excluded from scoring
};

// ============================================================
// Score a Single Lead
// ============================================================

export async function scoreLeadWithAI(
  leadId: string
): Promise<{ score: number; reason: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      contact: {
        select: {
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  // Closed leads (Won/Lost) are out of the nurture funnel — they must not be
  // scored as early-stage prospects or flagged for "re-engagement" (S-3).
  // Short-circuit with a deterministic, status-accurate assessment.
  if (lead.status === "WON" || lead.status === "LOST") {
    const won = lead.status === "WON";
    const score = won ? 100 : 0;
    const reason =
      `AI Score: ${score}/100\n\n` +
      (won
        ? "This lead is Won — already converted. No further prioritisation needed."
        : "This lead is Lost — closed out. It is excluded from active nurture and follow-up scoring.");
    return { score, reason };
  }

  let score = 0;
  const reasons: string[] = [];

  // 1. Lead source scoring
  const sourceScore = SOURCE_SCORES[lead.source] ?? 5;
  score += sourceScore;
  reasons.push(
    `Lead source "${lead.source}" contributes ${sourceScore} points — ${
      sourceScore >= 15
        ? "high-quality acquisition channel"
        : sourceScore >= 10
          ? "moderate acquisition channel"
          : "standard acquisition channel"
    }.`
  );

  // 2. Status progression scoring
  const statusScore = STATUS_SCORES[lead.status] ?? 0;
  score += statusScore;
  if (statusScore > 0) {
    reasons.push(
      `Current status "${lead.status}" adds ${statusScore} points — ${
        statusScore >= 25
          ? "advanced pipeline stage indicates strong buying intent"
          : statusScore >= 15
            ? "progressed stage shows active engagement"
            : "early-stage lead with room for progression"
      }.`
    );
  }

  // 3. Contact email availability
  if (lead.contact.email) {
    score += 10;
    reasons.push(
      "Contact has email on file (+10) — enables direct digital outreach and nurturing campaigns."
    );
  }

  // 4. Contact phone availability
  if (lead.contact.phone) {
    score += 5;
    reasons.push(
      "Contact has phone number (+5) — allows personal follow-up calls."
    );
  }

  // 5. Budget / estimated value scoring
  const budgetValue = lead.estimatedValue ? Number(lead.estimatedValue) : 0;
  if (budgetValue > 500000) {
    score += 15;
    reasons.push(
      `High estimated value of ${budgetValue.toLocaleString("en-IN")} (+15) — premium event opportunity with strong revenue potential.`
    );
  } else if (budgetValue > 200000) {
    score += 10;
    reasons.push(
      `Solid estimated value of ${budgetValue.toLocaleString("en-IN")} (+10) — mid-tier event with good revenue potential.`
    );
  } else if (budgetValue > 100000) {
    score += 5;
    reasons.push(
      `Estimated value of ${budgetValue.toLocaleString("en-IN")} (+5) — standard event budget.`
    );
  } else {
    reasons.push(
      "No significant budget specified — consider confirming budget expectations with the client."
    );
  }

  // 6. Event type filled
  if (lead.eventType) {
    score += 5;
    reasons.push(
      `Event type "${lead.eventType}" specified (+5) — client has a clear vision for the event.`
    );
  }

  // 7. Recent activity (updated within the last 7 days)
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceUpdate <= 7) {
    score += 5;
    reasons.push(
      "Recent activity within the past 7 days (+5) — lead is actively being worked."
    );
  } else {
    reasons.push(
      `No activity for ${daysSinceUpdate} days — consider re-engaging this lead.`
    );
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Build AI-style summary
  const overallAssessment =
    score >= 70
      ? "This is a high-priority lead with strong conversion potential. Recommend prioritizing immediate follow-up."
      : score >= 40
        ? "This lead shows moderate potential. Continued nurturing and timely follow-up could move it forward."
        : "This lead has limited signals for conversion at this time. Consider qualifying further or deprioritizing.";

  const reason = `AI Score: ${score}/100\n\n${overallAssessment}\n\nFactor Analysis:\n${reasons.map((r) => `  - ${r}`).join("\n")}`;

  return { score, reason };
}
