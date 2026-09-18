// ============================================================
// The stored GuestList totals, recomputed in ONE place.
//
// This was written twice — once in guest.actions.ts and once in
// portal-guest.actions.ts — and the public /rsvp/[token] path called neither,
// so a link RSVP left GuestList.totalRSVP stale. That stayed invisible because
// every screen recomputes from Guest rows on read, which is exactly the kind of
// bug that surfaces the first time something trusts the stored column.
//
// Note the two columns do NOT use the same unit, and that is preserved here
// rather than quietly corrected: totalInvited counts HEADS (the guest plus
// their plus-ones) while totalRSVP counts ROWS (guests who accepted). Changing
// either would move a number that other screens already read. For headcount
// arithmetic use summariseHeadcount in ./headcount.ts, which is explicit about
// heads versus rows.
// ============================================================

import { prisma } from "@/lib/prisma";

/** Recompute and store a guest list's totals. Safe to call more than once. */
export async function recalcGuestListTotals(guestListId: string): Promise<void> {
  const guests = await prisma.guest.findMany({
    where: { guestListId },
    select: { plusOnes: true, rsvpStatus: true, isCheckedIn: true },
  });

  await prisma.guestList.update({
    where: { id: guestListId },
    data: {
      totalInvited: guests.reduce((sum, g) => sum + 1 + g.plusOnes, 0),
      totalRSVP: guests.filter((g) => g.rsvpStatus === "ACCEPTED").length,
      totalCheckedIn: guests.filter((g) => g.isCheckedIn).length,
    },
  });
}
