import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================
// GET: Track Link Click (Public — No Auth Required)
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pixelId: string }> }
) {
  const { pixelId } = await params;

  // Get the destination URL from query params
  const url = request.nextUrl.searchParams.get("url");

  // Validate URL — must start with http:// or https://
  const isValidUrl =
    url && (url.startsWith("http://") || url.startsWith("https://"));
  let redirectUrl = isValidUrl ? url : "/";

  // Validate URL is not an open redirect
  if (isValidUrl && url) {
    try {
      const urlObj = new URL(url);
      const allowedProtocols = ["http:", "https:"];
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return NextResponse.json({ error: "Invalid URL protocol" }, { status: 400 });
      }
    } catch {
      redirectUrl = "/";
    }
  }

  try {
    // Look up pixel (don't fail if missing)
    const pixel = await prisma.emailTrackingPixel.findUnique({
      where: { id: pixelId },
      select: { id: true },
    });

    if (pixel) {
      // Record the click event
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        null;
      const userAgent = request.headers.get("user-agent") || null;

      await prisma.emailTrackingEvent.create({
        data: {
          type: "LINK_CLICK",
          ipAddress: ip,
          userAgent,
          linkUrl: url || null,
          pixelId: pixel.id,
        },
      });
    }
  } catch (error) {
    // Log but never fail — always redirect
    console.error("[TRACK_CLICK_ERROR]", error);
  }

  // 302 redirect to the original URL
  return NextResponse.redirect(redirectUrl, 302);
}
