import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { captureLeadFromExternal } from "@/lib/lead-capture";

// ============================================================
// Cron · Self-serve configurator abandonment sweep.
// ------------------------------------------------------------
// Marks stale PublicQuoteDraft rows ABANDONED: still in DRAFT/PRICED/LINK_SENT,
// older than N days, and NOT backed by a PAID invoice. For LINK_SENT drafts
// that have a phone, best-effort enqueue a follow-up lead so sales can chase.
// Idempotent (updateMany with a status guard) and never throws — mirrors the
// CRON_SECRET gate in api/cron/hold-expiry/route.ts.
// ============================================================

const ABANDON_AFTER_DAYS = 3;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (
    !authHeader ||
    !process.env.CRON_SECRET ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - ABANDON_AFTER_DAYS * 24 * 60 * 60 * 1000);
  let abandoned = 0;
  let followUps = 0;

  try {
    // Best-effort follow-up leads for LINK_SENT drafts with a phone BEFORE we
    // flip them, so we only chase abandoned-but-interested customers once.
    try {
      const linkSent = await prisma.publicQuoteDraft.findMany({
        where: {
          status: "LINK_SENT",
          updatedAt: { lt: cutoff },
          customerPhone: { not: null },
          leadId: null, // no CRM lead yet
        },
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          occasion: true,
          eventDate: true,
          guestCount: true,
          grandTotal: true,
          venueId: true,
        },
        take: 200,
      });

      for (const d of linkSent) {
        if (!d.customerPhone) continue;
        try {
          const lead = await captureLeadFromExternal({
            name: d.customerName || "Configurator visitor",
            email: d.customerEmail || undefined,
            phone: d.customerPhone,
            source: "website",
            eventType: d.occasion || undefined,
            eventDate: d.eventDate ? d.eventDate.toISOString() : undefined,
            guestCount: d.guestCount || undefined,
            estimatedValue: Number(d.grandTotal) || undefined,
            venueId: d.venueId || undefined,
            message: "Abandoned self-serve configurator quote — follow up to close.",
          });
          if (lead?.success && lead.leadId) {
            followUps++;
            await prisma.publicQuoteDraft.update({
              where: { id: d.id },
              data: { leadId: lead.leadId },
            });
          }
        } catch (e) {
          console.error("[CONFIGURATOR_ABANDON_FOLLOWUP_ERROR]", e);
        }
      }
    } catch (e) {
      console.error("[CONFIGURATOR_ABANDON_FOLLOWUP_SWEEP_ERROR]", e);
    }

    // Flip stale, unpaid drafts to ABANDONED. The PAID/CONVERTED statuses are
    // excluded by the status guard, so re-runs never disturb closed drafts.
    const res = await prisma.publicQuoteDraft.updateMany({
      where: {
        status: { in: ["DRAFT", "PRICED", "LINK_SENT"] },
        updatedAt: { lt: cutoff },
      },
      data: { status: "ABANDONED" },
    });
    abandoned = res.count;
  } catch (e) {
    console.error("[CONFIGURATOR_ABANDONMENT_ERROR]", e);
    // Never throw from a cron — report a soft failure.
    return NextResponse.json({
      success: false,
      ranAt: now.toISOString(),
      abandoned,
      followUps,
    });
  }

  return NextResponse.json({
    success: true,
    ranAt: now.toISOString(),
    abandoned,
    followUps,
  });
}
