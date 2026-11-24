/**
 * Bring the BD CRM in line with "VG_Bangalore_Leads_Overview.xlsx" (owner
 * request, 2026-11-24). Rules: src/lib/bd/sheet-import.ts.
 *
 * Input is the sheet's "Source data" tab as JSON rows (SheetRow[]). For each
 * phone number: the live BD lead with that number is updated — owner, name,
 * email, status (+ drop reason), follow-up, venue type/stage — and gets one
 * CALL activity carrying the sheet's conversation, plus a meeting record when
 * the sheet has one. A number not in the CRM becomes a new lead.
 *
 * Safe to re-run: a lead that already carries this import's note is skipped.
 * Each lead is its own transaction, guarded on the version it read, so a lead
 * someone edits meanwhile is skipped and reported rather than overwritten.
 * Dry run by default.
 *
 *   DATABASE_URL=… npx tsx scripts/import-bd-sheet.ts rows.json            # dry run
 *   DATABASE_URL=… npx tsx scripts/import-bd-sheet.ts rows.json --apply
 */
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { readVenueAnswer } from "@/lib/meta/owner-venue";
import { IMPORT_MARK, groupByPhone, planLead, type LeadPlan, type SheetRow } from "@/lib/bd/sheet-import";

// Production users, checked by name below.
const USERS = { RAKSHITH: "cmrsw8al70001js04dyr0xfah", NICK: "cmrkbj2ts0000jw04tj1vpaoc" } as const;

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!file) throw new Error("Usage: import-bd-sheet.ts rows.json [--apply]");
  const rows = JSON.parse(readFileSync(file, "utf8")) as SheetRow[];
  const now = new Date();

  const people = await prisma.user.findMany({ where: { id: { in: Object.values(USERS) } }, select: { id: true, name: true, isActive: true } });
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "?";
  if (!/^rakshith/i.test(nameOf(USERS.RAKSHITH)) || !/^nick/i.test(nameOf(USERS.NICK)) || people.some((p) => !p.isActive)) {
    throw new Error("Rakshith / Nickson user ids don't match this database — stopping without changes.");
  }

  const plans = groupByPhone(rows).map((g) => planLead(g, { now }));
  const report = { update: 0, create: 0, alreadyImported: 0, ambiguous: [] as string[], beyondLead: [] as string[], changed: [] as string[] };
  const byStatus: Record<string, number> = {};
  const ownerMoves: Record<string, number> = {};
  let moved = 0, meetings = 0, hot = 0;

  type Work = { plan: LeadPlan; lead: { id: string; status: string; bdExecutiveId: string; contactAttempts: number; firstContactAt: Date | null; updatedAt: Date } | null };
  const work: Work[] = [];
  for (const plan of plans) {
    const leads = await prisma.acqLead.findMany({
      where: { mobilePrimary: plan.phone, deletedAt: null },
      select: { id: true, status: true, bdExecutiveId: true, contactAttempts: true, firstContactAt: true, updatedAt: true, bdExecutive: { select: { name: true } } },
    });
    if (leads.length > 1) { report.ambiguous.push(`${plan.leadId} ${plan.phone}`); continue; }
    const lead = leads[0] ?? null;
    if (lead) {
      if (lead.status === "QUALIFIED" || lead.status === "DEAL_CREATED") { report.beyondLead.push(`${plan.leadId} (${lead.status})`); continue; }
      const done = await prisma.acqLeadActivity.count({ where: { leadId: lead.id, note: { startsWith: `${IMPORT_MARK} (` } } });
      if (done > 0) { report.alreadyImported++; continue; }
      const to = USERS[plan.owner];
      if (lead.bdExecutiveId !== to) {
        const k = `${lead.bdExecutive.name} → ${nameOf(to)}`;
        ownerMoves[k] = (ownerMoves[k] ?? 0) + 1;
      }
      report.update++;
    } else report.create++;
    byStatus[`${lead?.status ?? "(new)"} → ${plan.status}`] = (byStatus[`${lead?.status ?? "(new)"} → ${plan.status}`] ?? 0) + 1;
    if (plan.followUpMoved) moved++;
    if (plan.meeting) meetings++;
    if (plan.hot) hot++;
    work.push({ plan, lead });
  }

  console.log(`\nSheet: ${rows.length} rows → ${plans.length} leads (one per phone number).`);
  console.log(`Update ${report.update} existing BD leads · create ${report.create} new · already imported ${report.alreadyImported}`);
  console.log("Status changes:", byStatus);
  console.log("Owner changes:", ownerMoves);
  console.log(`🔥 Hot (left CONTACTED for "Qualify lead"): ${hot} · meetings recorded: ${meetings} · past follow-ups moved to tomorrow: ${moved}`);
  if (report.ambiguous.length) console.log("SKIPPED — more than one live lead with this phone:", report.ambiguous);
  if (report.beyondLead.length) console.log("SKIPPED — already qualified / has a deal:", report.beyondLead);
  console.log("New leads:", work.filter((w) => !w.lead).map((w) => `${w.plan.leadId} ${w.plan.ownerName} → ${w.plan.owner}`));
  if (!apply) {
    console.log("\nDry run — nothing changed. Re-run with --apply.\n");
    return;
  }

  let ok = 0;
  for (const { plan, lead } of work) {
    const exec = USERS[plan.owner];
    const actorName = nameOf(exec);
    const shared = {
      ownerName: plan.ownerName,
      ...(plan.email ? { email: plan.email } : {}),
      bdExecutiveId: exec,
      status: plan.status,
      disqualifyReason: plan.disqualifyReason,
      nextFollowupAt: plan.nextFollowupAt,
      followupNotifiedFor: null,
      ...(plan.propertyType ? { propertyType: plan.propertyType } : {}),
      ...(plan.propertyStage ? { propertyStage: plan.propertyStage } : {}),
    };
    try {
      await prisma.$transaction(async (tx) => {
        let leadId: string;
        let from: string | null;
        if (lead) {
          const upd = await tx.acqLead.updateMany({
            where: { id: lead.id, updatedAt: lead.updatedAt, deletedAt: null },
            data: {
              ...shared,
              contactAttempts: Math.max(lead.contactAttempts, 1),
              ...(plan.reached && !lead.firstContactAt ? { firstContactAt: now } : {}),
            },
          });
          if (upd.count !== 1) throw new Error("CHANGED");
          leadId = lead.id;
          from = lead.status;
        } else {
          const v = readVenueAnswer(plan.venue, "Bengaluru");
          const created = await tx.acqLead.create({
            data: {
              ...shared,
              mobilePrimary: plan.phone,
              propertyName: v.propertyName,
              propertyType: plan.propertyType ?? "BANQUET",
              city: v.city,
              locality: v.locality,
              leadSource: "OTHER",
              ownerType: "MANAGER",
              contactAttempts: 1,
              firstContactDue: now,
              ...(plan.reached ? { firstContactAt: now } : {}),
            },
            select: { id: true },
          });
          leadId = created.id;
          from = null;
        }
        await tx.acqLeadActivity.create({
          data: { leadId, channel: "CALL", outcome: plan.outcome, note: plan.note, actorId: exec, actorName },
        });
        if (from !== plan.status) {
          await tx.acqStageTransition.create({
            data: { entity: "LEAD", entityId: leadId, fromState: from, toState: plan.status, actorId: exec, reason: `${IMPORT_MARK} (${plan.leadId})` },
          });
        }
        if (plan.meeting) {
          await tx.acqSiteVisit.create({
            data: {
              leadId, type: "MEETING", scheduledAt: plan.meeting.scheduledAt, status: plan.meeting.status,
              location: plan.venue, assignedToId: exec, assignedToName: actorName,
              completedAt: plan.meeting.status === "COMPLETED" ? plan.meeting.scheduledAt : null,
              createdByName: "Sheet import",
              agenda: `From ${plan.leadId} in the VG Bangalore leads sheet.`,
            },
          });
        }
      });
      ok++;
    } catch (e) {
      if (e instanceof Error && e.message === "CHANGED") report.changed.push(plan.leadId);
      else throw e;
    }
  }
  console.log(`\nApplied: ${ok} lead(s).`);
  if (report.changed.length) console.log("SKIPPED — edited by someone while this ran (re-run to pick them up):", report.changed);

  // One in-app notice per owner.
  for (const key of ["RAKSHITH", "NICK"] as const) {
    const mine = work.filter((w) => w.plan.owner === key);
    if (!mine.length) continue;
    const open = mine.filter((w) => w.plan.status !== "DISQUALIFIED").length;
    const hotMine = mine.filter((w) => w.plan.hot).length;
    await prisma.notification.create({
      data: {
        userId: USERS[key], type: "SYSTEM", title: "Your BD leads were updated from the VG Bangalore sheet",
        message: `${mine.length} leads are yours, with the sheet's status, conversation and follow-up dates: ${open} open${hotMine ? `, ${hotMine} 🔥 hot ready to qualify` : ""}. Past follow-up dates were moved to tomorrow.`,
        actionUrl: "/bd/followups",
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
