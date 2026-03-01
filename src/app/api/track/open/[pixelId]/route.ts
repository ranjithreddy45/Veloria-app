import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ============================================================
// 1x1 Transparent GIF (binary)
// ============================================================

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// ============================================================
// GET: Track Email Open (Public — No Auth Required)
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pixelId: string }> }
) {
  try {
    const { pixelId } = await params;

    // Look up pixel (don't fail if missing)
    const pixel = await prisma.emailTrackingPixel.findUnique({
      where: { id: pixelId },
      select: { id: true },
    });

    if (pixel) {
      // Record the open event
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        null;
      const userAgent = request.headers.get("user-agent") || null;

      await prisma.emailTrackingEvent.create({
        data: {
          type: "EMAIL_OPEN",
          ipAddress: ip,
          userAgent,
          pixelId: pixel.id,
        },
      });
    }
  } catch (error) {
    // Log but never fail — always return the GIF
    console.error("[TRACK_OPEN_ERROR]", error);
  }

  // Always return 1x1 transparent GIF
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
