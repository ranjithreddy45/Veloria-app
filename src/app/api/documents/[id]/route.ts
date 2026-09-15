import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getVerifiedContactIds } from "@/lib/portal-identity";

// Get the Contact ids linked to this user's email (mirrors
// portal.actions.ts getClientContactIds) so portal/client accounts can
// only reach documents tied to their own contacts.
/**
 * Contacts this login may act for. Delegates to the portal's verified-identity
 * rule (verified email or a customer link) so an unverified account that
 * merely shares a customer's email sees nothing.
 */
async function getClientContactIds(userId: string): Promise<string[]> {
  return getVerifiedContactIds(userId);
}

// ============================================================
// GET: Redirect to Document URL (or 404)
// ============================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id },
      select: { url: true, isPublic: true, contactId: true },
    });

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    // Per-object authorization (prevents IDOR). Explicitly public documents
    // are viewable by any authenticated caller; everything else requires
    // either the documents:read permission (internal roles) or that the
    // document belongs to one of the caller's own contacts (portal/client).
    if (!document.isPublic) {
      const role = (session.user as { role?: string }).role ?? "";
      const canReadDocuments = hasPermission(role, "documents:read");

      if (!canReadDocuments) {
        const contactIds = await getClientContactIds(session.user.id);
        const ownsDocument =
          !!document.contactId && contactIds.includes(document.contactId);

        if (!ownsDocument) {
          return NextResponse.json(
            { success: false, error: "Forbidden" },
            { status: 403 }
          );
        }
      }
    }

    if (!document.url) {
      return NextResponse.json(
        { success: false, error: "Document has no URL" },
        { status: 404 }
      );
    }

    return NextResponse.redirect(document.url);
  } catch (error) {
    console.error("[DOCUMENT_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}
