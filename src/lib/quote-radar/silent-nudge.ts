// ============================================================
// Quote Radar — "opened-but-silent 24h" recovery sweep (cron worker).
// ------------------------------------------------------------
// Plain lib (no auth, never throws). Finds ACTIVE QuoteShareLinks that were
// opened (firstViewedAt set), have gone quiet (lastViewedAt < now-24h), have
// NOT yet fired the recovery (silentNudgeFiredAt null), and whose backing
// quotation has NOT converted (invoice unpaid / no booking). For each:
//   1. Stamp silentNudgeFiredAt FIRST via a conditional updateMany (count===1
//      wins) so two overlapping cron runs can't enroll/notify the same lead
//      twice (first-writer-wins, mirrors the slaEscalatedAt one-shot pattern).
//   2. Best-effort enroll the linked lead into the recovery cadence (if one is
//      configured + ACTIVE), then notify the rep who shared the link.
//
// Reads persisted lastViewedAt (not in-memory state) so it survives serverless
// freeze. Batches ~200 per run (overflow spills to the next run — acceptable).
// ============================================================

import { prisma } from "@/lib/prisma";
import { notifyAwait } from "@/lib/notify";
import { enrollEntity } from "@/actions/cadence.actions";

export interface SilentNudgeSummary {
  scanned: number;
  nudged: number;
  enrolled: number;
  notified: number;
  skipped: number;
  errors: number;
}

const BATCH = 200;
const SILENT_AFTER_MS = 24 * 60 * 60 * 1000;
const PENDING = "__pending__";

/** Is the link's backing quotation already converted (paid/booked)? */
async function isConverted(
  primaryQuotationId: string | null,
  payInvoiceId: string | null
): Promise<boolean> {
  // Booked → converted.
  if (primaryQuotationId) {
    const q = await prisma.salesQuotation.findUnique({
      where: { id: primaryQuotationId },
      select: { bookingId: true, invoiceId: true },
    });
    if (q?.bookingId) return true;
    // Use the quotation's own invoice if the link doesn't carry one.
    if (!payInvoiceId && q?.invoiceId && q.invoiceId !== PENDING) payInvoiceId = q.invoiceId;
  }
  if (payInvoiceId && payInvoiceId !== PENDING) {
    const inv = await prisma.invoice.findUnique({
      where: { id: payInvoiceId },
      select: { status: true, balanceDue: true, paidAmount: true },
    });
    if (inv && (inv.status === "PAID" || Number(inv.balanceDue) <= 0 || Number(inv.paidAmount) > 0)) {
      return true;
    }
  }
  return false;
}

export async function runQuoteSilentNudgeSweep(): Promise<SilentNudgeSummary> {
  const summary: SilentNudgeSummary = {
    scanned: 0,
    nudged: 0,
    enrolled: 0,
    notified: 0,
    skipped: 0,
    errors: 0,
  };

  const cadenceId = (process.env.QUOTE_RECOVERY_CADENCE_ID ?? "").trim() || null;
  const now = new Date();
  const silentCutoff = new Date(now.getTime() - SILENT_AFTER_MS);

  let candidates: Array<{
    id: string;
    leadId: string | null;
    contactId: string | null;
    createdById: string | null;
    clientName: string | null;
    primaryQuotationId: string | null;
    payInvoiceId: string | null;
  }>;
  try {
    candidates = await prisma.quoteShareLink.findMany({
      where: {
        status: "ACTIVE",
        firstViewedAt: { not: null },
        lastViewedAt: { lt: silentCutoff },
        silentNudgeFiredAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { lastViewedAt: "asc" },
      take: BATCH,
      select: {
        id: true,
        leadId: true,
        contactId: true,
        createdById: true,
        clientName: true,
        primaryQuotationId: true,
        payInvoiceId: true,
      },
    });
  } catch (e) {
    console.error("[QUOTE_SILENT_NUDGE_QUERY_ERROR]", e);
    summary.errors++;
    return summary;
  }

  summary.scanned = candidates.length;

  for (const link of candidates) {
    try {
      // Skip rows that already converted (paid / booked) — never nag a customer
      // who already paid (brand damage).
      if (await isConverted(link.primaryQuotationId, link.payInvoiceId)) {
        summary.skipped++;
        continue;
      }

      // One-shot guard: stamp silentNudgeFiredAt FIRST. Only the first writer
      // (count===1) proceeds; overlapping cron runs get count===0 and bail.
      const claimed = await prisma.quoteShareLink.updateMany({
        where: { id: link.id, silentNudgeFiredAt: null, status: "ACTIVE" },
        data: { silentNudgeFiredAt: now },
      });
      if (claimed.count !== 1) {
        summary.skipped++;
        continue;
      }
      summary.nudged++;

      // Best-effort enroll the lead into the recovery cadence (if configured).
      // enrollEntity is session-gated; in the cron context it has no session and
      // will simply return Unauthorized — we treat that as "cadence unavailable"
      // and fall back to notifying the rep (still recovers the lead via a human).
      if (cadenceId && link.leadId) {
        try {
          const res = await enrollEntity(cadenceId, link.leadId);
          if (res.success) summary.enrolled++;
        } catch {
          /* cadence enroll best-effort */
        }
      }

      // Notify the rep who shared the link (awaited — survives serverless freeze).
      if (link.createdById) {
        await notifyAwait({
          userId: link.createdById,
          type: "SYSTEM",
          title: "Quote opened but silent",
          message: `${link.clientName ?? "A customer"} opened your shared quote but hasn't replied in 24h. Time for a nudge.`,
          actionUrl: link.primaryQuotationId ? `/quotations/${link.primaryQuotationId}` : "/quotations",
        });
        summary.notified++;
      }
    } catch (e) {
      console.error("[QUOTE_SILENT_NUDGE_ROW_ERROR]", e);
      summary.errors++;
    }
  }

  return summary;
}
