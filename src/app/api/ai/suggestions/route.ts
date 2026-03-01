import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { hasPermission } from "@/lib/permissions";
import { generateSuggestions } from "@/lib/ai/suggestions";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 30 AI suggestion requests per minute per user
    const identifier = session?.user?.id || request.headers.get("x-forwarded-for") || "anonymous";
    const rateCheck = checkRateLimit(`ai-suggestions:${identifier}`, { maxRequests: 30, windowSeconds: 60 });
    if (!rateCheck.success) {
      return rateLimitResponse(rateCheck.resetIn);
    }

    // Permission check
    const role = (session.user as { role?: string }).role ?? "";
    if (!hasPermission(role, "ai:use")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") as
      | "lead"
      | "deal"
      | "contact"
      | null;
    const entityId = searchParams.get("entityId");

    if (
      !entityType ||
      !entityId ||
      !["lead", "deal", "contact"].includes(entityType)
    ) {
      return NextResponse.json(
        { error: "Invalid parameters. Required: entityType (lead|deal|contact) and entityId." },
        { status: 400 }
      );
    }

    const suggestions = await generateSuggestions(entityType, entityId);

    return NextResponse.json({ success: true, data: suggestions });
  } catch (error) {
    console.error("[AI_SUGGESTIONS_ERROR]", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate suggestions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
