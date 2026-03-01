import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { widgetInquirySchema } from "@/schemas/widget.schema";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// ============================================================
// POST: Submit Widget Inquiry (Public — No Auth Required)
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 widget inquiry requests per minute per IP
    const identifier = request.headers.get("x-forwarded-for") || "unknown";
    const rateCheck = checkRateLimit(`widget-inquiry:${identifier}`, { maxRequests: 5, windowSeconds: 60 });
    if (!rateCheck.success) {
      return rateLimitResponse(rateCheck.resetIn);
    }

    const body = await request.json();

    // Validate with Zod
    const parsed = widgetInquirySchema.safeParse(body);
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
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Create widget inquiry
    const inquiry = await prisma.widgetInquiry.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        eventType: data.eventType || null,
        eventDate: data.eventDate || null,
        guestCount: data.guestCount || null,
        venueId: data.venueId || null,
        message: data.message,
        source: "WIDGET",
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: { id: inquiry.id },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[WIDGET_INQUIRY_POST_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit inquiry" },
      { status: 500 }
    );
  }
}
