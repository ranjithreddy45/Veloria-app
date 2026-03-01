import { prisma } from "@/lib/prisma";
import { chatCompletionJSON, getOpenAIClient } from "@/lib/ai/openai-client";

// ============================================================
// Types
// ============================================================

export interface SmartSuggestion {
  id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  type: "ACTION" | "INSIGHT" | "WARNING";
  title: string;
  description: string;
  icon: string; // lucide-react icon name (e.g., "Mail", "Phone", "Calendar", "AlertTriangle")
  actionLabel?: string; // e.g., "Send Email", "Schedule Call"
  actionHref?: string; // optional link
}

// ============================================================
// Lead status ordering for comparison
// ============================================================

const LEAD_STATUS_ORDER: Record<string, number> = {
  NEW: 0,
  CONTACTED: 1,
  QUALIFIED: 2,
  PROPOSAL_SENT: 3,
  NEGOTIATION: 4,
  WON: 5,
  LOST: 6,
};

// ============================================================
// Helper: days between two dates
// ============================================================

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

// ============================================================
// Main: Generate Suggestions
// ============================================================

export async function generateSuggestions(
  entityType: "lead" | "deal" | "contact",
  entityId: string
): Promise<SmartSuggestion[]> {
  try {
    let heuristicSuggestions: SmartSuggestion[] = [];

    if (entityType === "lead") {
      heuristicSuggestions = await generateLeadSuggestions(entityId);
    } else if (entityType === "deal") {
      heuristicSuggestions = await generateDealSuggestions(entityId);
    } else if (entityType === "contact") {
      heuristicSuggestions = await generateContactSuggestions(entityId);
    }

    // Attempt LLM refinement if OpenAI is available
    const refined = await refineSuggestionsWithAI(
      entityType,
      entityId,
      heuristicSuggestions
    );

    // Sort by priority: HIGH first, then MEDIUM, then LOW
    const priorityOrder: Record<string, number> = {
      HIGH: 0,
      MEDIUM: 1,
      LOW: 2,
    };
    refined.sort(
      (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
    );

    // Limit to 7 suggestions max
    return refined.slice(0, 7);
  } catch (error) {
    console.error("[SmartSuggestions] Error generating suggestions:", error);
    return [];
  }
}

// ============================================================
// Lead Suggestions
// ============================================================

async function generateLeadSuggestions(
  leadId: string
): Promise<SmartSuggestion[]> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      contact: true,
      deal: {
        include: { stage: true },
      },
    },
  });

  if (!lead) return [];

  // Fetch last 10 communications for the contact
  const communications = await prisma.communication.findMany({
    where: { contactId: lead.contactId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const suggestions: SmartSuggestion[] = [];
  const now = new Date();
  let counter = 1;

  const addSuggestion = (
    s: Omit<SmartSuggestion, "id">
  ) => {
    suggestions.push({ id: `lead-${counter++}`, ...s });
  };

  const statusOrder = LEAD_STATUS_ORDER[lead.status] ?? 0;
  const daysSinceCreated = daysBetween(new Date(lead.createdAt), now);
  const lastComm = communications[0];
  const daysSinceLastComm = lastComm
    ? daysBetween(new Date(lastComm.createdAt), now)
    : Infinity;

  // 1. NEW lead older than 2 days
  if (lead.status === "NEW" && daysSinceCreated > 2) {
    addSuggestion({
      priority: "HIGH",
      type: "ACTION",
      title: "Follow up on new lead",
      description: `This lead was created ${daysSinceCreated} days ago and is still in NEW status. Reach out to establish initial contact.`,
      icon: "Phone",
      actionLabel: "Log Call",
      actionHref: `/contacts/${lead.contactId}`,
    });
  }

  // 2. CONTACTED with no communication in last 5 days
  if (lead.status === "CONTACTED" && daysSinceLastComm > 5) {
    addSuggestion({
      priority: "HIGH",
      type: "ACTION",
      title: "Re-engage lead",
      description: `No communication in ${daysSinceLastComm} days. Send a follow-up to keep the conversation going.`,
      icon: "Mail",
      actionLabel: "Send Email",
      actionHref: `/contacts/${lead.contactId}`,
    });
  }

  // 3. High-value lead not yet at PROPOSAL_SENT
  if (
    lead.estimatedValue &&
    Number(lead.estimatedValue) > 500000 &&
    statusOrder < LEAD_STATUS_ORDER.PROPOSAL_SENT
  ) {
    const formattedValue = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(lead.estimatedValue));
    addSuggestion({
      priority: "HIGH",
      type: "INSIGHT",
      title: "Fast-track high-value lead",
      description: `This lead is valued at ${formattedValue}. Consider prioritizing and fast-tracking to proposal stage.`,
      icon: "TrendingUp",
    });
  }

  // 4. Event date within 30 days and status below QUALIFIED
  if (lead.eventDate) {
    const daysToEvent = daysBetween(now, new Date(lead.eventDate));
    if (daysToEvent <= 30 && daysToEvent > 0 && statusOrder < LEAD_STATUS_ORDER.QUALIFIED) {
      addSuggestion({
        priority: "HIGH",
        type: "WARNING",
        title: "Urgent: Event date approaching",
        description: `The event is only ${daysToEvent} days away but the lead hasn't been qualified yet. Accelerate the qualification process.`,
        icon: "AlertTriangle",
      });
    }
  }

  // 5. No email on contact
  if (!lead.contact.email) {
    addSuggestion({
      priority: "MEDIUM",
      type: "ACTION",
      title: "Collect email address",
      description:
        "The contact does not have an email address on file. Collecting it will enable email outreach and follow-ups.",
      icon: "Mail",
      actionLabel: "Edit Contact",
      actionHref: `/contacts/${lead.contactId}/edit`,
    });
  }

  // 6. No phone on contact
  if (!lead.contact.phone) {
    addSuggestion({
      priority: "LOW",
      type: "ACTION",
      title: "Get phone number for direct contact",
      description:
        "Having a phone number enables faster communication. Request it during your next interaction.",
      icon: "Phone",
      actionLabel: "Edit Contact",
      actionHref: `/contacts/${lead.contactId}/edit`,
    });
  }

  // 7. Low AI score
  if (lead.aiScore !== null && lead.aiScore !== undefined && lead.aiScore < 30) {
    addSuggestion({
      priority: "MEDIUM",
      type: "WARNING",
      title: "Low AI score - consider re-qualifying",
      description: `The AI score is ${lead.aiScore}/100. Review the lead qualification criteria and consider re-assessing.`,
      icon: "AlertTriangle",
    });
  }

  // 8. Overdue follow-up
  if (lead.followUpDate) {
    const followUpDate = new Date(lead.followUpDate);
    if (followUpDate < now) {
      const overdueDays = daysBetween(followUpDate, now);
      addSuggestion({
        priority: "HIGH",
        type: "WARNING",
        title: "Overdue follow-up",
        description: `The follow-up was due ${overdueDays} day${overdueDays === 1 ? "" : "s"} ago. Take action immediately to avoid losing the lead.`,
        icon: "Clock",
        actionLabel: "Follow Up Now",
        actionHref: `/contacts/${lead.contactId}`,
      });
    }
  }

  // 9. QUALIFIED without a deal
  if (lead.status === "QUALIFIED" && !lead.deal) {
    addSuggestion({
      priority: "HIGH",
      type: "ACTION",
      title: "Create deal and move to pipeline",
      description:
        "This lead is qualified but doesn't have a deal yet. Create a deal to track it through the sales pipeline.",
      icon: "Target",
      actionLabel: "Create Deal",
      actionHref: `/pipeline`,
    });
  }

  // 10. Large guest count
  if (lead.guestCount && lead.guestCount > 200) {
    addSuggestion({
      priority: "MEDIUM",
      type: "INSIGHT",
      title: "Large event - consider premium package",
      description: `With ${lead.guestCount} guests expected, this is a large event. Consider offering premium or custom packages for higher revenue.`,
      icon: "Users",
    });
  }

  return suggestions;
}

// ============================================================
// Deal Suggestions
// ============================================================

async function generateDealSuggestions(
  dealId: string
): Promise<SmartSuggestion[]> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      stage: true,
      lead: {
        include: { contact: true },
      },
      booking: true,
    },
  });

  if (!deal) return [];

  // Fetch last 10 communications for the contact
  const communications = await prisma.communication.findMany({
    where: { contactId: deal.lead.contactId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const suggestions: SmartSuggestion[] = [];
  const now = new Date();
  let counter = 1;

  const addSuggestion = (
    s: Omit<SmartSuggestion, "id">
  ) => {
    suggestions.push({ id: `deal-${counter++}`, ...s });
  };

  const lastComm = communications[0];
  const daysSinceLastComm = lastComm
    ? daysBetween(new Date(lastComm.createdAt), now)
    : Infinity;

  const isActiveDeal = !deal.stage.isWonStage && !deal.stage.isLostStage;

  // 1. No communication in last 7 days
  if (daysSinceLastComm > 7 && isActiveDeal) {
    addSuggestion({
      priority: "HIGH",
      type: "ACTION",
      title: "Maintain engagement",
      description: `No communication in ${daysSinceLastComm} days. Reach out to the contact to keep momentum going.`,
      icon: "MessageSquare",
      actionLabel: "Send Message",
      actionHref: `/contacts/${deal.lead.contactId}`,
    });
  }

  // 2. Low probability
  if (deal.probability < 30 && isActiveDeal) {
    addSuggestion({
      priority: "MEDIUM",
      type: "WARNING",
      title: "Low probability - review deal viability",
      description: `Deal probability is only ${deal.probability}%. Review and assess whether this deal should be continued or deprioritized.`,
      icon: "AlertTriangle",
    });
  }

  // 3. Expected close date is past and deal still active
  if (deal.expectedCloseDate && isActiveDeal) {
    const closeDate = new Date(deal.expectedCloseDate);
    if (closeDate < now) {
      const overdueDays = daysBetween(closeDate, now);
      addSuggestion({
        priority: "HIGH",
        type: "WARNING",
        title: "Update expected close date",
        description: `The expected close date was ${overdueDays} days ago. Update the timeline to reflect current reality.`,
        icon: "Calendar",
        actionLabel: "Update Deal",
      });
    }
  }

  // 4. Expected close date within 7 days
  if (deal.expectedCloseDate && isActiveDeal) {
    const daysToClose = daysBetween(now, new Date(deal.expectedCloseDate));
    if (daysToClose > 0 && daysToClose <= 7) {
      addSuggestion({
        priority: "HIGH",
        type: "ACTION",
        title: "Closing soon - prepare final proposal",
        description: `This deal is expected to close in ${daysToClose} day${daysToClose === 1 ? "" : "s"}. Prepare the final proposal and confirm all details.`,
        icon: "FileText",
        actionLabel: "Prepare Proposal",
      });
    }
  }

  // 5. Premium deal (value > 10,00,000)
  if (Number(deal.value) > 1000000) {
    const formattedValue = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(deal.value));
    addSuggestion({
      priority: "HIGH",
      type: "INSIGHT",
      title: "Premium deal - involve senior management",
      description: `This is a high-value deal worth ${formattedValue}. Consider involving senior management for strategic guidance and relationship building.`,
      icon: "Star",
    });
  }

  // 6. Advanced stage without booking
  if (deal.stage.order > 3 && !deal.booking && isActiveDeal) {
    addSuggestion({
      priority: "MEDIUM",
      type: "ACTION",
      title: "Advanced deal without booking - create booking",
      description: `This deal is in an advanced stage (${deal.stage.name}) but has no booking associated. Create a booking to secure the date.`,
      icon: "CalendarPlus",
      actionLabel: "Create Booking",
      actionHref: `/bookings/new`,
    });
  }

  // 7. Low AI score
  if (deal.aiScore !== null && deal.aiScore !== undefined && deal.aiScore < 40 && isActiveDeal) {
    addSuggestion({
      priority: "MEDIUM",
      type: "WARNING",
      title: "AI flags low win probability",
      description: `The AI win probability score is ${deal.aiScore}/100. Review the deal factors and consider adjusting your strategy.`,
      icon: "AlertTriangle",
    });
  }

  return suggestions;
}

// ============================================================
// Contact Suggestions
// ============================================================

async function generateContactSuggestions(
  contactId: string
): Promise<SmartSuggestion[]> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      leads: {
        include: {
          deal: {
            include: { stage: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!contact) return [];

  // Fetch last 10 communications
  const communications = await prisma.communication.findMany({
    where: { contactId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const suggestions: SmartSuggestion[] = [];
  const now = new Date();
  let counter = 1;

  const addSuggestion = (
    s: Omit<SmartSuggestion, "id">
  ) => {
    suggestions.push({ id: `contact-${counter++}`, ...s });
  };

  const lastComm = communications[0];
  const daysSinceLastComm = lastComm
    ? daysBetween(new Date(lastComm.createdAt), now)
    : Infinity;

  // 1. No communication in last 30 days
  if (daysSinceLastComm > 30) {
    addSuggestion({
      priority: "MEDIUM",
      type: "ACTION",
      title: "Re-engage dormant contact",
      description:
        daysSinceLastComm === Infinity
          ? "No communications recorded yet. Initiate contact to build the relationship."
          : `No communication in ${daysSinceLastComm} days. Re-engage to maintain the relationship.`,
      icon: "UserPlus",
      actionLabel: "Reach Out",
      actionHref: `/contacts/${contactId}`,
    });
  }

  // 2. CORPORATE with no recent leads
  const hasRecentLeads = contact.leads.some((lead) => {
    const daysSinceCreated = daysBetween(new Date(lead.createdAt), now);
    return daysSinceCreated < 90;
  });
  if (contact.type === "CORPORATE" && !hasRecentLeads) {
    addSuggestion({
      priority: "LOW",
      type: "INSIGHT",
      title: "Explore new opportunities",
      description:
        "This is a corporate contact with no recent leads. Explore potential new business opportunities or event needs.",
      icon: "Briefcase",
    });
  }

  // 3. Has won deals in the past
  const hasWonDeals = contact.leads.some(
    (lead) => lead.deal?.stage?.isWonStage === true
  );
  if (hasWonDeals) {
    addSuggestion({
      priority: "MEDIUM",
      type: "INSIGHT",
      title: "Upsell to existing customer",
      description:
        "This contact has previously won deals. Consider upselling with additional services or future event packages.",
      icon: "TrendingUp",
      actionLabel: "Create Lead",
      actionHref: `/leads/new?contactId=${contactId}`,
    });
  }

  // 4. Last communication was INBOUND
  if (lastComm && lastComm.direction === "INBOUND") {
    const daysSinceInbound = daysBetween(new Date(lastComm.createdAt), now);
    if (daysSinceInbound <= 3) {
      addSuggestion({
        priority: "HIGH",
        type: "ACTION",
        title: "Respond to incoming inquiry",
        description: `The last communication was an inbound ${lastComm.type.toLowerCase()}${lastComm.subject ? ` about "${lastComm.subject}"` : ""}. Respond promptly to show engagement.`,
        icon: "Reply",
        actionLabel: "Respond",
        actionHref: `/contacts/${contactId}`,
      });
    }
  }

  // 5. Multiple active leads
  const activeLeads = contact.leads.filter(
    (lead) => lead.status !== "WON" && lead.status !== "LOST"
  );
  if (activeLeads.length > 1) {
    addSuggestion({
      priority: "MEDIUM",
      type: "INSIGHT",
      title: "Consolidate communication strategy",
      description: `This contact has ${activeLeads.length} active leads. Coordinate messaging to present a unified approach.`,
      icon: "GitMerge",
    });
  }

  return suggestions;
}

// ============================================================
// LLM Refinement (Optional)
// ============================================================

interface AISuggestionsResponse {
  suggestions: Array<{
    id: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    type: "ACTION" | "INSIGHT" | "WARNING";
    title: string;
    description: string;
    icon: string;
    actionLabel?: string;
  }>;
}

async function refineSuggestionsWithAI(
  entityType: "lead" | "deal" | "contact",
  entityId: string,
  heuristicSuggestions: SmartSuggestion[]
): Promise<SmartSuggestion[]> {
  // If no OpenAI client, return heuristic suggestions as-is
  const client = getOpenAIClient();
  if (!client) {
    return heuristicSuggestions;
  }

  // If we have no heuristic suggestions, return empty
  if (heuristicSuggestions.length === 0) {
    return heuristicSuggestions;
  }

  try {
    // Fetch a summary of the entity for AI context
    const entitySummary = await getEntitySummary(entityType, entityId);

    const systemPrompt = `You are a CRM assistant for an Indian wedding/event venue business (Veloria Grand). Your task is to review and refine smart suggestions for a ${entityType}.

Given the current heuristic suggestions and entity data, you should:
1. Validate which suggestions are most relevant (keep the good ones, adjust if needed)
2. Add 1-2 additional AI-powered insights specific to the data patterns you observe
3. Return refined suggestions with improved descriptions that are specific and actionable

Return ONLY a JSON object with this structure:
{
  "suggestions": [
    {
      "id": "ai-1",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "type": "ACTION" | "INSIGHT" | "WARNING",
      "title": "Short title",
      "description": "Specific, actionable description",
      "icon": "LucideIconName",
      "actionLabel": "optional button text"
    }
  ]
}

Valid icon names: Mail, Phone, Calendar, AlertTriangle, TrendingUp, Users, Clock, Target, Star, FileText, MessageSquare, Briefcase, UserPlus, GitMerge, Reply, CalendarPlus, Zap, Lightbulb, IndianRupee, Award.

Keep at most 8 suggestions total. All currency references should use INR (Indian Rupees).`;

    const userPrompt = `Entity Data:
${entitySummary}

Current Heuristic Suggestions:
${JSON.stringify(heuristicSuggestions, null, 2)}

Please refine these suggestions and add any additional AI insights.`;

    const result = await chatCompletionJSON<AISuggestionsResponse>({
      system: systemPrompt,
      user: userPrompt,
    });

    if (result && result.suggestions && Array.isArray(result.suggestions)) {
      // Map AI suggestions, preserving actionHref from originals where possible
      const hrefMap = new Map<string, string>();
      for (const s of heuristicSuggestions) {
        if (s.actionHref) {
          hrefMap.set(s.title.toLowerCase(), s.actionHref);
        }
      }

      return result.suggestions.map((s, idx) => ({
        id: s.id || `ai-${idx + 1}`,
        priority: s.priority,
        type: s.type,
        title: s.title,
        description: s.description,
        icon: s.icon,
        actionLabel: s.actionLabel,
        actionHref: hrefMap.get(s.title.toLowerCase()),
      }));
    }

    // If AI response is malformed, return heuristic suggestions
    return heuristicSuggestions;
  } catch (error) {
    console.error("[SmartSuggestions] AI refinement failed, using heuristics:", error);
    return heuristicSuggestions;
  }
}

// ============================================================
// Helper: Get entity summary for AI prompt
// ============================================================

async function getEntitySummary(
  entityType: "lead" | "deal" | "contact",
  entityId: string
): Promise<string> {
  try {
    if (entityType === "lead") {
      const lead = await prisma.lead.findUnique({
        where: { id: entityId },
        include: {
          contact: { select: { firstName: true, lastName: true, email: true, phone: true, company: true, type: true } },
          deal: { select: { title: true, value: true, probability: true, stage: { select: { name: true } } } },
        },
      });
      if (!lead) return "Lead not found.";
      return `Lead: ${lead.title}
Status: ${lead.status}, Source: ${lead.source}
Estimated Value: ${lead.estimatedValue ? Number(lead.estimatedValue).toLocaleString("en-IN") : "N/A"} INR
Event Date: ${lead.eventDate ? new Date(lead.eventDate).toLocaleDateString("en-IN") : "N/A"}
Event Type: ${lead.eventType ?? "N/A"}, Guest Count: ${lead.guestCount ?? "N/A"}
Follow-up Date: ${lead.followUpDate ? new Date(lead.followUpDate).toLocaleDateString("en-IN") : "N/A"}
AI Score: ${lead.aiScore ?? "N/A"}
Contact: ${lead.contact.firstName} ${lead.contact.lastName} (${lead.contact.type}), Email: ${lead.contact.email ?? "N/A"}, Phone: ${lead.contact.phone ?? "N/A"}, Company: ${lead.contact.company ?? "N/A"}
Deal: ${lead.deal ? `${lead.deal.title} - Stage: ${lead.deal.stage.name}, Value: ${Number(lead.deal.value).toLocaleString("en-IN")} INR, Probability: ${lead.deal.probability}%` : "No deal created"}
Created: ${new Date(lead.createdAt).toLocaleDateString("en-IN")}`;
    }

    if (entityType === "deal") {
      const deal = await prisma.deal.findUnique({
        where: { id: entityId },
        include: {
          stage: true,
          lead: { select: { title: true, status: true, contact: { select: { firstName: true, lastName: true, email: true, company: true } } } },
          booking: { select: { bookingNumber: true, status: true, eventName: true, date: true } },
        },
      });
      if (!deal) return "Deal not found.";
      return `Deal: ${deal.title}
Stage: ${deal.stage.name}, Value: ${Number(deal.value).toLocaleString("en-IN")} INR
Probability: ${deal.probability}%, Expected Close: ${deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString("en-IN") : "N/A"}
AI Score: ${deal.aiScore ?? "N/A"}
Lead: ${deal.lead.title} (${deal.lead.status})
Contact: ${deal.lead.contact.firstName} ${deal.lead.contact.lastName}, Company: ${deal.lead.contact.company ?? "N/A"}
Booking: ${deal.booking ? `${deal.booking.bookingNumber} - ${deal.booking.eventName} (${deal.booking.status})` : "No booking"}
Created: ${new Date(deal.createdAt).toLocaleDateString("en-IN")}`;
    }

    if (entityType === "contact") {
      const contact = await prisma.contact.findUnique({
        where: { id: entityId },
        include: {
          leads: {
            select: { title: true, status: true, estimatedValue: true },
            take: 5,
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!contact) return "Contact not found.";
      return `Contact: ${contact.firstName} ${contact.lastName}
Type: ${contact.type}, Email: ${contact.email ?? "N/A"}, Phone: ${contact.phone ?? "N/A"}
Company: ${contact.company ?? "N/A"}
Recent Leads: ${contact.leads.length > 0 ? contact.leads.map((l) => `${l.title} (${l.status})`).join(", ") : "None"}
Created: ${new Date(contact.createdAt).toLocaleDateString("en-IN")}`;
    }

    return "Unknown entity type.";
  } catch {
    return "Error fetching entity data.";
  }
}
