import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { captureLeadFromExternal } from "@/lib/lead-capture";
import { leadCaptureSchema } from "@/schemas/lead-capture.schema";
import crypto from "crypto";

/**
 * POST /api/leads/capture
 * Universal lead capture API — for IndiaMart, JustDial, Sulekha, 99Acres, or any custom integration.
 * Requires API key authentication via x-api-key header.
 */
export async function POST(request: NextRequest) {
  try {
    // API Key authentication
    const apiKey = request.headers.get("x-api-key");

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required. Pass it via x-api-key header." },
        { status: 401 }
      );
    }

    // Hash the key and look it up
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    const storedKey = await prisma.apiKey.findFirst({
      where: { keyHash, isActive: true },
    });

    if (!storedKey) {
      return NextResponse.json(
        { error: "Invalid or inactive API key" },
        { status: 401 }
      );
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: storedKey.id },
      data: { lastUsedAt: new Date() },
    });

    // Parse and validate body
    const body = await request.json();
    const parsed = leadCaptureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await captureLeadFromExternal({
      name: parsed.data.name,
      email: parsed.data.email || undefined,
      phone: parsed.data.phone || undefined,
      source: parsed.data.source,
      message: parsed.data.message || undefined,
      eventType: parsed.data.eventType || undefined,
      eventDate: parsed.data.eventDate || undefined,
      guestCount: parsed.data.guestCount,
    });

    if (result.success) {
      return NextResponse.json(
        { success: true, leadId: result.leadId, contactId: result.contactId },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { error: result.error || "Failed to capture lead" },
      { status: 500 }
    );
  } catch (error) {
    console.error("[LeadCaptureAPI] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
