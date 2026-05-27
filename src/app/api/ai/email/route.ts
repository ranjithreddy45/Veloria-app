import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { getOpenAIClient, getAIProvider } from "@/lib/ai/openai-client";
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
  const identifier =
    session?.user?.id || req.headers.get("x-forwarded-for") || "anonymous";
  const rateCheck = checkRateLimit(`ai-email:${identifier}`, {
    maxRequests: 20,
    windowSeconds: 60,
  });
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
        city: true,
        tags: true,
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
        source: true,
        description: true,
      },
    });

    // Fetch recent bookings (last 2)
    const recentBookings = await prisma.booking.findMany({
      where: { contactId },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: {
        eventType: true,
        date: true,
        guestCount: true,
        status: true,
        totalAmount: true,
        venue: { select: { name: true } },
      },
    });

    const userName = session.user.name ?? "Team Member";
    const contactName = `${contact.firstName}${contact.lastName ? " " + contact.lastName : ""}`;
    const primaryLead = recentLeads[0];

    // Check if AI is configured
    const openai = getOpenAIClient();
    const provider = getAIProvider();

    let emailData: { subject: string; body: string };

    if (openai && provider !== "none") {
      // ====================================================
      // AI-powered generation (OpenAI or Gemini)
      // ====================================================
      const systemPrompt = buildEmailSystemPrompt(tone);

      let userPrompt = `Write a personalized email for this contact:\n\n`;
      userPrompt += `**Contact Details:**\n`;
      userPrompt += `- Name: ${contactName}\n`;
      if (contact.email) userPrompt += `- Email: ${contact.email}\n`;
      if (contact.company) userPrompt += `- Company: ${contact.company}\n`;
      if (contact.city) userPrompt += `- City: ${contact.city}\n`;
      userPrompt += `- Type: ${contact.type}\n`;
      if (contact.tags && contact.tags.length > 0)
        userPrompt += `- Tags: ${contact.tags.join(", ")}\n`;

      userPrompt += `\n**Sender (sign off as):** ${userName}\n`;

      if (subject) {
        userPrompt += `\n**Subject line to use:** ${subject}\n`;
      }

      if (context) {
        userPrompt += `\n**User's instruction / email purpose:** ${context}\n`;
        userPrompt += `(IMPORTANT: Follow this instruction precisely. The email MUST be about this topic.)\n`;
      }

      if (recentLeads.length > 0) {
        userPrompt += `\n**Active Leads:**\n`;
        for (const lead of recentLeads) {
          userPrompt += `- "${lead.title}" (Status: ${lead.status}, Source: ${lead.source ?? "Direct"})`;
          if (lead.eventType) userPrompt += ` | Event: ${lead.eventType}`;
          if (lead.eventDate) {
            userPrompt += ` | Date: ${new Date(lead.eventDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
          }
          if (lead.guestCount) userPrompt += ` | Guests: ${lead.guestCount}`;
          if (lead.estimatedValue)
            userPrompt += ` | Budget: ₹${Number(lead.estimatedValue).toLocaleString("en-IN")}`;
          if (lead.description)
            userPrompt += `\n  Details: ${lead.description.slice(0, 200)}`;
          userPrompt += `\n`;
        }
      }

      if (recentBookings.length > 0) {
        userPrompt += `\n**Past/Upcoming Bookings:**\n`;
        for (const booking of recentBookings) {
          userPrompt += `- ${booking.eventType} (${booking.status})`;
          if (booking.date)
            userPrompt += ` | ${new Date(booking.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
          if (booking.guestCount)
            userPrompt += ` | ${booking.guestCount} guests`;
          if (booking.venue?.name) userPrompt += ` | Venue: ${booking.venue.name}`;
          userPrompt += `\n`;
        }
      }

      if (recentCommunications.length > 0) {
        userPrompt += `\n**Recent Communication History:**\n`;
        for (const comm of recentCommunications) {
          const date = new Date(comm.createdAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          });
          const snippet = comm.content
            ? comm.content.replace(/<[^>]*>/g, "").slice(0, 100)
            : "";
          userPrompt += `- [${date}] ${comm.direction} ${comm.type}`;
          if (comm.subject) userPrompt += `: "${comm.subject}"`;
          if (snippet) userPrompt += ` — ${snippet}`;
          userPrompt += `\n`;
        }
      }

      userPrompt += `\nRespond with ONLY the JSON object: { "subject": "...", "body": "..." }`;

      // Call AI
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
          jsonStr = jsonStr
            .replace(/^```(?:json)?\s*\n?/, "")
            .replace(/\n?\s*```$/, "");
        }
        emailData = JSON.parse(jsonStr);
        if (!emailData.subject || !emailData.body) {
          throw new Error("Missing subject or body in AI response");
        }
      } catch {
        console.error("[AI_EMAIL_PARSE_ERROR] Raw response:", aiResponse);
        return NextResponse.json(
          { error: "Failed to parse AI response. Please try again." },
          { status: 500 }
        );
      }
    } else {
      // ====================================================
      // Smart template fallback (no AI configured)
      // ====================================================
      const senderName = userName;
      const eventType =
        primaryLead?.eventType ?? recentBookings[0]?.eventType ?? "event";
      const eventDate =
        primaryLead?.eventDate ?? recentBookings[0]?.date ?? null;
      const guestCount =
        primaryLead?.guestCount ?? recentBookings[0]?.guestCount ?? null;
      const budget = primaryLead?.estimatedValue
        ? `₹${Number(primaryLead.estimatedValue).toLocaleString("en-IN")}`
        : null;
      const leadStatus = primaryLead?.status ?? null;

      const greeting =
        tone === "professional"
          ? `Dear ${contact.firstName}`
          : tone === "friendly"
            ? `Hi ${contact.firstName}`
            : `Hello ${contact.firstName}`;

      const closing =
        tone === "professional"
          ? "Yours sincerely"
          : tone === "friendly"
            ? "Warm regards"
            : "Best regards";

      // Build subject
      let emailSubject = subject || "";
      if (!emailSubject) {
        if (tone === "follow_up") {
          emailSubject = `Following Up — ${eventType} at Veloria Grand`;
        } else if (tone === "urgent") {
          emailSubject = `Time-Sensitive: ${eventType} Availability Update`;
        } else if (context) {
          const contextWords = context.split(" ").slice(0, 5).join(" ");
          emailSubject = `${contextWords} — Veloria Grand`;
        } else {
          emailSubject = `Your ${eventType} at Veloria Grand`;
        }
      }

      // Build body based on tone and available data
      const parts: string[] = [];

      parts.push(`<p>${greeting},</p>`);

      // Opening based on context and tone
      if (context) {
        parts.push(`<p>${context}</p>`);
      } else if (tone === "follow_up") {
        parts.push(
          `<p>I wanted to follow up on our recent conversation about your upcoming ${eventType}. We're excited about the possibility of hosting your celebration at Veloria Grand.</p>`
        );
      } else if (tone === "urgent") {
        parts.push(
          `<p>I'm reaching out because we have limited availability for your preferred ${eventDate ? `date of ${new Date(eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : "dates"}, and I wanted to ensure we can accommodate your ${eventType}.</p>`
        );
      } else {
        parts.push(
          `<p>Thank you for considering Veloria Grand for your ${eventType}. We would love to be a part of your special celebration.</p>`
        );
      }

      // Event details
      if (guestCount || eventDate || budget) {
        let detailLine = `<p>Based on your requirements`;
        const details: string[] = [];
        if (guestCount) details.push(`${guestCount} guests`);
        if (eventDate)
          details.push(
            `date: ${new Date(eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
          );
        if (budget) details.push(`budget: ${budget}`);
        if (details.length > 0) detailLine += ` (${details.join(", ")})`;
        detailLine += `, we can curate a bespoke experience tailored perfectly to your vision.</p>`;
        parts.push(detailLine);
      }

      // CTA based on lead status
      if (leadStatus === "NEW" || leadStatus === "CONTACTED") {
        parts.push(
          `<p>I'd love to schedule a venue visit so you can experience Veloria Grand firsthand. Would any day this week work for you? We can arrange a guided tour along with a tasting session.</p>`
        );
      } else if (
        leadStatus === "QUALIFIED" ||
        leadStatus === "PROPOSAL_SENT"
      ) {
        parts.push(
          `<p>Please review the proposal at your convenience. If you have any questions or would like to discuss customisation options, I'm happy to arrange a call or meeting.</p>`
        );
      } else if (leadStatus === "NEGOTIATION") {
        parts.push(
          `<p>I'd love to finalise the details and ensure everything aligns with your vision. Could we schedule a quick call to go over the remaining specifics?</p>`
        );
      } else {
        parts.push(
          `<p>Please let me know a convenient time for a call or a visit to our venue. We'd be delighted to walk you through our offerings and discuss how we can make your event extraordinary.</p>`
        );
      }

      parts.push(`<p>${closing},<br/>${senderName}<br/>Veloria Grand</p>`);

      emailData = {
        subject: emailSubject,
        body: parts.join("\n"),
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        subject: emailData.subject,
        body: emailData.body,
      },
      provider: provider !== "none" ? provider : "template",
    });
  } catch (error) {
    console.error("[AI_EMAIL_ERROR]", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate email";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
