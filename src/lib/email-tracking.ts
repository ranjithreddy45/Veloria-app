import { prisma } from "@/lib/prisma";

// ============================================================
// Email Tracking Library Functions
// ============================================================
// Pure library functions — NOT server actions.
// Used by communication.actions.ts and API routes.

/**
 * Create a tracking pixel record in the database.
 * Returns the pixel ID for use in URL generation.
 */
export async function createTrackingPixel(
  communicationId: string,
  contactId: string | null,
  recipientEmail: string,
  campaignId?: string
): Promise<string> {
  const pixel = await prisma.emailTrackingPixel.create({
    data: {
      communicationId,
      contactId: contactId || null,
      recipientEmail,
      campaignId: campaignId || null,
    },
  });
  return pixel.id;
}

/**
 * Generate the tracking pixel URL for open tracking.
 * The URL points to our public GET endpoint.
 */
export function generateTrackingPixelUrl(pixelId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/api/track/open/${pixelId}`;
}

/**
 * Wrap all <a href="..."> links in the HTML content for click tracking.
 * Replaces each link with a redirect URL through our tracking endpoint.
 */
export function wrapLinksForTracking(
  htmlContent: string,
  pixelId: string
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Match <a href="..." or <a href='...' — capture the URL
  return htmlContent.replace(
    /<a\s([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (_match, before: string, url: string, after: string) => {
      // Skip mailto:, tel:, and anchor links
      if (
        url.startsWith("mailto:") ||
        url.startsWith("tel:") ||
        url.startsWith("#") ||
        url.startsWith("javascript:")
      ) {
        return _match;
      }

      // Skip tracking URLs to avoid double-wrapping
      if (url.includes("/api/track/")) {
        return _match;
      }

      const encodedUrl = encodeURIComponent(url);
      const trackingUrl = `${baseUrl}/api/track/click/${pixelId}?url=${encodedUrl}`;
      return `<a ${before}href="${trackingUrl}"${after}>`;
    }
  );
}

/**
 * Inject a 1x1 transparent tracking pixel image before the closing
 * </body> or </html> tag. Falls back to appending if no closing tag found.
 */
export function injectTrackingPixel(
  htmlContent: string,
  pixelId: string
): string {
  const pixelUrl = generateTrackingPixelUrl(pixelId);
  const pixelImg = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0;" />`;

  // Try to insert before </body>
  if (htmlContent.includes("</body>")) {
    return htmlContent.replace("</body>", `${pixelImg}</body>`);
  }

  // Try to insert before </html>
  if (htmlContent.includes("</html>")) {
    return htmlContent.replace("</html>", `${pixelImg}</html>`);
  }

  // Fallback: append at the end
  return htmlContent + pixelImg;
}

/**
 * Orchestrator: creates tracking pixel, wraps links, and injects pixel image.
 * Returns the modified HTML content with tracking enabled.
 */
export async function processEmailForTracking(
  communicationId: string,
  contactId: string | null,
  recipientEmail: string,
  htmlContent: string,
  campaignId?: string
): Promise<{ pixelId: string; trackedHtml: string }> {
  // 1. Create tracking pixel in DB
  const pixelId = await createTrackingPixel(
    communicationId,
    contactId,
    recipientEmail,
    campaignId
  );

  // 2. Wrap links for click tracking
  let trackedHtml = wrapLinksForTracking(htmlContent, pixelId);

  // 3. Inject the tracking pixel image
  trackedHtml = injectTrackingPixel(trackedHtml, pixelId);

  return { pixelId, trackedHtml };
}
