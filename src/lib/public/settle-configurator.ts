// ============================================================
// Settle a paid self-serve-configurator advance (C6).
// ------------------------------------------------------------
// The /configure flow takes a 20% advance but previously reserved NOTHING and
// never flipped the draft, so a paid date could be silently dropped or double-
// sold. Called from the shared payment-capture path (apply-capture.ts): when a
// configurator advance invoice is captured, mark the draft PAID and alert the
// team to formally reserve + confirm the date — re-checking availability so a
// "paid but the slot went" race gets an urgent, actionable alert instead of a
// silent loss. Idempotent (guards on status) and never throws.
// ============================================================

import { prisma } from "@/lib/prisma";
import { reportSystemFailure } from "@/lib/ops-alert";
import { publicConfiguratorSlotFree } from "@/actions/public-hold.actions";

export async function settleConfiguratorPayment(invoiceId: string): Promise<void> {
  try {
    const draft = await prisma.publicQuoteDraft.findFirst({
      where: { invoiceId, status: { notIn: ["PAID", "CONVERTED", "ABANDONED"] } },
      select: {
        id: true, customerName: true, customerPhone: true, occasion: true,
        venueId: true, eventDate: true, timeSlot: true, advanceAmount: true,
      },
    });
    if (!draft) return; // not a configurator invoice, or already settled

    await prisma.publicQuoteDraft.update({ where: { id: draft.id }, data: { status: "PAID" } });

    let slotFree = true;
    if (draft.venueId && draft.eventDate && draft.timeSlot) {
      slotFree = await publicConfiguratorSlotFree(draft.venueId, draft.eventDate, draft.timeSlot);
    }

    const who = `${draft.customerName ?? "A customer"}${draft.customerPhone ? ` (${draft.customerPhone})` : ""}`;
    const when = draft.eventDate
      ? new Date(draft.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
      : "date TBC";
    const slot = draft.timeSlot ?? "slot TBC";
    const adv = `₹${Math.round(Number(draft.advanceAmount || 0)).toLocaleString("en-IN")}`;

    if (slotFree) {
      await reportSystemFailure({
        area: "Online booking",
        title: "Configurator advance PAID — reserve & confirm the date",
        detail: `${who} paid the ${adv} advance online for ${draft.occasion ?? "an event"} on ${when} (${slot}). Create the booking, block the slot, and call them to confirm.`,
        actionUrl: "/leads",
      });
    } else {
      await reportSystemFailure({
        area: "Online booking — ACTION NEEDED",
        title: "PAID but the slot is no longer free — refund or re-offer NOW",
        detail: `${who} paid ${adv} online for ${when} (${slot}), but that slot is now taken. Contact them immediately to re-offer another date or refund.`,
        actionUrl: "/leads",
      });
    }
  } catch (e) {
    console.error("[SETTLE_CONFIGURATOR_ERROR]", e);
  }
}
