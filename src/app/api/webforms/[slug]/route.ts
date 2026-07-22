import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webformSubmissionSchema } from "@/schemas/webform.schema";
import { notify } from "@/lib/notify";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { evaluateAssignmentRules } from "@/actions/assignment-rule.actions";
import { runLeadIntake, leadSlaDeadline } from "@/lib/lead-pipeline";
import { attachAttributionToLead, parseAttributionFromRequest } from "@/lib/attribution";
import type { Prisma, LeadSource } from "@prisma/client";

// ============================================================
// Simple In-Memory Rate Limiter
// ============================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

// Cleanup stale entries periodically (every 100 requests)
let cleanupCounter = 0;
function maybeCleanup() {
  cleanupCounter++;
  if (cleanupCounter >= 100) {
    cleanupCounter = 0;
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }
}

// ============================================================
// CORS Headers
// ============================================================

function corsHeaders(req?: NextRequest) {
  return {
    // TODO: Restrict to known domains in production
    "Access-Control-Allow-Origin": req?.headers.get("origin") || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// ============================================================
// OPTIONS: CORS Preflight
// ============================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// ============================================================
// POST: Submit Webform (Public — No Auth Required)
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Rate limit by IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    maybeCleanup();

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many submissions. Please try again later." },
        { status: 429, headers: corsHeaders(request) }
      );
    }

    // Fetch the webform
    const webform = await prisma.webform.findUnique({
      where: { slug },
    });

    if (!webform || !webform.isActive) {
      return NextResponse.json(
        { success: false, error: "Form not found or inactive" },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    // Parse body
    const body = await request.json();

    // Validate with Zod
    const parsed = webformSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join(".");
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      return NextResponse.json(
        { success: false, error: "Validation failed", details: fieldErrors },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    const submissionData = parsed.data;

    // Check honeypot field (spam detection)
    let isSpam = false;
    if (
      webform.honeypotField &&
      submissionData.honeypot &&
      submissionData.honeypot.trim() !== ""
    ) {
      isSpam = true;
    }

    // Extract email from submitted data for contact lookup/creation
    const formData = submissionData.data as Record<string, unknown>;
    const email = (formData.email as string) || (formData.Email as string) || null;
    const firstName =
      (formData.first_name as string) ||
      (formData.firstName as string) ||
      (formData.name as string) ||
      (formData.Name as string) ||
      // fullName is what the shipped Event Inquiry form actually uses; without
      // it every submission created a contact literally named "Unknown".
      (formData.fullName as string) ||
      (formData.full_name as string) ||
      (formData.fullname as string) ||
      "";
    const lastName =
      (formData.last_name as string) ||
      (formData.lastName as string) ||
      "";
    const phone =
      (formData.phone as string) ||
      (formData.Phone as string) ||
      (formData.mobile as string) ||
      (formData.phoneNumber as string) ||
      (formData.phone_number as string) ||
      null;

    let contactId: string | null = null;
    let leadId: string | null = null;

    // Skip contact/lead creation for spam
    if (!isSpam) {
      // Create or find existing contact
      if (email) {
        const existingContact = await prisma.contact.findFirst({
          where: { email },
        });

        if (existingContact) {
          contactId = existingContact.id;
        } else {
          const newContact = await prisma.contact.create({
            data: {
              firstName: firstName || "Unknown",
              lastName: lastName || "",
              email,
              phone,
            },
          });
          contactId = newContact.id;
        }
      } else if (firstName || phone) {
        // No email (common on high-converting landing-page forms that only ask
        // for name + phone). A phone alone is still a real, contactable lead —
        // never drop it just because the name field wasn't recognised.
        const newContact = await prisma.contact.create({
          data: {
            firstName: firstName || "Unknown",
            lastName: lastName || "",
            phone,
          },
        });
        contactId = newContact.id;
      }

      // Create Lead if we have a contact
      if (contactId && !isSpam) {
        const leadSource = (webform.defaultSource || "WEBSITE") as LeadSource;

        // Resolve assignment: static autoAssignTo, else the rules engine.
        let assignedToId: string | null = webform.autoAssignTo || null;
        if (!assignedToId) {
          try {
            assignedToId =
              (await evaluateAssignmentRules({ source: leadSource })) || null;
          } catch {
            /* assignment optional */
          }
        }

        const score = calculateLeadScore({ source: leadSource, status: "NEW" });

        const lead = await prisma.lead.create({
          data: {
            title: `${webform.name} - ${firstName || email || "New Submission"}`,
            source: leadSource,
            contactId,
            createdById: webform.createdById,
            score,
            firstContactDue: leadSlaDeadline(),
            ...(assignedToId ? { assignedToId } : {}),
          },
        });
        leadId = lead.id;

        // First-touch marketing attribution (best-effort; helper swallows
        // errors). Awaited so the write isn't dropped on a serverless freeze.
        await attachAttributionToLead(
          lead.id,
          await parseAttributionFromRequest(request, body)
        );

        // Intake: instant auto-reply (LEAD_CREATED workflows) + auto-enrol.
        await runLeadIntake({
          lead: {
            id: lead.id,
            contactId,
            source: lead.source,
            status: lead.status,
            score: lead.score,
          },
          triggeredByUserId: assignedToId ?? webform.createdById,
        });
      }
    }

    // Create submission record
    const userAgent = request.headers.get("user-agent") || null;

    const submission = await prisma.webformSubmission.create({
      data: {
        data: formData as Prisma.InputJsonValue,
        ipAddress: ip,
        userAgent,
        isSpam,
        webformId: webform.id,
        contactId,
        leadId,
      },
    });

    // Notify users
    if (!isSpam && webform.notifyUserIds.length > 0) {
      for (const userId of webform.notifyUserIds) {
        notify({
          userId,
          type: "LEAD_ASSIGNED",
          title: "New Form Submission",
          message: `New submission on "${webform.name}" from ${firstName || email || "Unknown"}.`,
          actionUrl: `/settings/webforms/${webform.id}`,
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: submission.id,
          message:
            webform.thankYouMessage ||
            "Thank you for your submission!",
          redirectUrl: webform.thankYouUrl || null,
        },
      },
      { status: 201, headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error("[WEBFORM_SUBMIT_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit form" },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
