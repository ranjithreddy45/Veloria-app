import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getOpenAIClient } from "@/lib/ai/openai-client";
import { buildEmailSystemPrompt } from "@/lib/ai/system-prompt";
import { chatCompletionWithSystem } from "@/lib/ai/openai-client";
import { aiEmailSchema } from "@/schemas/ai.schema";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 20 AI email requests per minute per user
  const identifier = session?.user?.id || req.headers.get("x-forwarded-for") || "anonymous";
  const rateCheck = checkRateLimit(`ai-email:${identifier}`, { maxRequests: 20, windowSeconds: 60 });
  if (!rateCheck.success) {
    return rateLimitResponse(rateCheck.resetIn);
  }

  // Permission check
  const role = (session.user as { role?: string }).role ?? "";
  if (!hasPermission(role, "ai:use")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = aiEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { contactId, tone, context, subject } = parsed.data;

  try {
    // Fetch contact info
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        type: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Fetch recent communications (last 5)
    const recentCommunications = await prisma.communication.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        type: true,
        subject: true,
        content: true,
        direction: true,
        createdAt: true,
      },
    });

    // Fetch recent leads for the contact (last 3)
    const recentLeads = await prisma.lead.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        title: true,
        status: true,
        eventType: true,
        eventDate: true,
        estimatedValue: true,
        guestCount: true,
      },
    });

    // Build context-aware user prompt
    const userName = session.user.name ?? "Team Member";

    let userPrompt = `Write an email for the following contact:\n`;
    userPrompt += `- Name: ${contact.firstName} ${contact.lastName}\n`;
    userPrompt += `- Email: ${contact.email ?? "N/A"}\n`;
    userPrompt += `- Phone: ${contact.phone ?? "N/A"}\n`;
    userPrompt += `- Company: ${contact.company ?? "N/A"}\n`;
    userPrompt += `- Contact Type: ${contact.type}\n`;
    userPrompt += `\nSender (sign off as): ${userName}\n`;

    if (subject) {
      userPrompt += `\nRequested Subject: ${subject}\n`;
    }

    if (context) {
      userPrompt += `\nContext/Purpose: ${context}\n`;
    }

    if (recentCommunications.length > 0) {
      userPrompt += `\nRecent Communication History:\n`;
      for (const comm of recentCommunications) {
        const date = new Date(comm.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        userPrompt += `- [${date}] ${comm.direction} ${comm.type}${comm.subject ? `: ${comm.subject}` : ""}\n`;
      }
    }

    if (recentLeads.length > 0) {
      userPrompt += `\nRecent Leads:\n`;
      for (const lead of recentLeads) {
        userPrompt += `- ${lead.title} (Status: ${lead.status})`;
        if (lead.eventType) userPrompt += ` | Event: ${lead.eventType}`;
        if (lead.eventDate) {
          const eventDate = new Date(lead.eventDate).toLocaleDateString(
            "en-IN",
            { day: "2-digit", month: "short", year: "numeric" }
          );
          userPrompt += ` | Date: ${eventDate}`;
        }
        if (lead.guestCount) userPrompt += ` | Guests: ${lead.guestCount}`;
        if (lead.estimatedValue)
          userPrompt += ` | Value: ${Number(lead.estimatedValue).toLocaleString("en-IN")}`;
        userPrompt += `\n`;
      }
    }

    userPrompt += `\nRespond ONLY with valid JSON: { "subject": "...", "body": "..." }`;

    // Check if OpenAI is configured
    const openai = getOpenAIClient();
    let emailData: { subject: string; body: string };

    if (openai) {
      // Call AI
      const systemPrompt = buildEmailSystemPrompt(tone);
      const aiResponse = await chatCompletionWithSystem({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.7,
        maxTokens: 2048,
      });

      // Parse JSON response
      try {
        let jsonStr = aiResponse.trim();
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }
        emailData = JSON.parse(jsonStr);
        if (!emailData.subject || !emailData.body) {
          throw new Error("Missing subject or body in AI response");
        }
      } catch {
        return NextResponse.json(
          { error: "Failed to parse AI response. Please try again." },
          { status: 500 }
        );
      }
    } else {
      // Template-based fallback when OpenAI is not configured
      const contactName = `${contact.firstName} ${contact.lastName}`;
      const senderName = session.user.name ?? "The Veloria Grand Team";
      const leadInfo = recentLeads[0];
      const eventDetail = leadInfo
        ? `regarding ${leadInfo.eventType ?? "your event"}${leadInfo.eventDate ? ` on ${new Date(leadInfo.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : ""}`
        : "regarding your inquiry";

      const toneGreeting = tone === "professional" ? "Dear" : tone === "friendly" ? "Hi" : "Hello";
      const toneClosing = tone === "professional" ? "Yours sincerely" : tone === "friendly" ? "Warm regards" : "Best regards";

      emailData = {
        subject: subject || `${leadInfo?.eventType ?? "Event"} Inquiry — Veloria Grand`,
        body: `${toneGreeting} ${contact.firstName},

Thank you for your interest in Veloria Grand ${eventDetail}.

${context ? `${context}\n\n` : ""}We would love to discuss how we can make your event truly special. Veloria Grand offers world-class venues, premium catering, and end-to-end event management to ensure a memorable experience.

${leadInfo?.guestCount ? `With ${leadInfo.guestCount} guests, we can recommend our premium packages that include dedicated event coordination and custom décor.\n\n` : ""}Please let us know a convenient time for a call or visit to our venue. We're happy to arrange a personalized tour.

Looking forward to hearing from you!

${toneClosing},
${senderName}
Veloria Grand — Venue Management
`,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        subject: emailData.subject,
        body: emailData.body,
      },
    });
  } catch (error) {
    console.error("[AI_EMAIL_ERROR]", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
