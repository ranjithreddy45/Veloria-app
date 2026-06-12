import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRedirect } from "@/lib/email-tracking";

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
  const sig = request.nextUrl.searchParams.get("sig");

  // Open-redirect guard: only redirect to the raw destination if either (a) it
  // carries a valid HMAC signature we generated, or (b) it points at our OWN
  // app host. Anything else falls back to the home page. This prevents the
  // public tracking endpoint from being used as a phishing redirector.
  let redirectUrl = "/";
  if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
    try {
      const u = new URL(url);
      if (u.protocol === "http:" || u.protocol === "https:") {
        let appHost = "";
        try {
          appHost = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://app.theveloriagrand.com").host;
        } catch {
          appHost = "";
        }
        if (verifyRedirect(url, sig) || (appHost && u.host === appHost)) {
          redirectUrl = url;
        }
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
