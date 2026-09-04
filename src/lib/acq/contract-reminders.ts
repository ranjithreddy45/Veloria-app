// ============================================================
// Contract signing reminders — cron-only internals.
// ------------------------------------------------------------
// Lives in lib/ (NOT an actions file): the daily cron route is its only
// caller and it must not exist as a public "use server" endpoint — invoking
// it repeatedly would spam every manager with duplicate SLA notifications.
// The route (/api/cron/contract-reminders) gates on CRON_SECRET.
// ============================================================

import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

/** Notify the BD owner + managers about contracts whose target sign date is
 *  near (≤3 days) or overdue and not yet active/terminated. */
export async function remindContractSignings(): Promise<number> {
  const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  let reminded = 0;
  try {
    const due = await prisma.acqContract.findMany({
      where: {
        deletedAt: null,
        status: { in: ["DRAFT", "APPROVED", "NEGOTIATED", "SIGNED"] },
        signByDate: { not: null, lte: soon },
      },
      select: { id: true, title: true, propertyName: true, signByDate: true, bdExecutiveId: true },
      take: 200,
    });
    if (due.length === 0) return 0;
    const managers = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["SUPER_ADMIN", "ADMIN", "BD_HEAD"] } },
      select: { id: true },
    });
    const now = new Date();
    for (const c of due) {
      const overdue = c.signByDate! < now;
      const ids = new Set<string>([c.bdExecutiveId, ...managers.map((m) => m.id)]);
      for (const id of ids) {
        notify({
          userId: id,
          type: "SLA_WARNING",
          title: overdue ? "⏰ Contract signing overdue" : "Contract signing due soon",
          message: `${c.propertyName} — ${c.title}`,
          actionUrl: `/bd/contracts/${c.id}`,
        });
      }
      reminded++;
    }
  } catch (e) {
    console.error("[remindContractSignings] error:", e);
  }
  return reminded;
}
