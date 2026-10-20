/**
 * Import Meta lead-ads leads from a sheet export (the Google "Leads Sheet" Meta
 * fills) while the CRM has no working Meta token.
 *
 * Input: a JSON file — an array of rows, each { "<sheet header>": cell } —
 * converted from the sheet. Every row goes through processMetaLeadPayload, the
 * same path as an API lead: Meta-lead-id dedupe (re-running, or a later API
 * import, adds nothing twice), original enquiry date, past-enquiry quiet mode,
 * Hotel sales / Venue acquisition held back, fold into an existing lead of the
 * same person. Then the sales team's sheet columns are written onto the lead:
 * a note (owner, remarks, venue shared…), the named owner for a lead this run
 * created, and a NOT_CONNECTED / CONTACTED status from the remarks for a lead
 * still at NEW.
 *
 *   DATABASE_URL=… npx tsx scripts/import-meta-sheet.ts <rows.json> [--dry]
 *
 * --dry reads only: what would be imported, held back or already present.
 */
import { readFileSync } from "fs";

import { prisma } from "@/lib/prisma";
import { getMetaCredentials } from "@/lib/meta/graph";
import { processMetaLeadPayload } from "@/lib/meta/process-lead";
import { excludedCampaignMatch } from "@/lib/meta/exclusions";
import {
  describeTeamNotes,
  ownerFirstName,
  sheetRowToLead,
  statusFromRemarks,
  type SheetLead,
} from "@/lib/meta/sheet-import";

const SHEET_MARKER = (metaLeadId: string) => `[sheet:${metaLeadId}]`;

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) throw new Error("usage: import-meta-sheet.ts <rows.json> [--dry]");
  const dry = flags.includes("--dry");

  const rows = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>[];
  const seen = new Set<string>();
  const leads: SheetLead[] = [];
  let noId = 0;
  for (const row of rows) {
    const lead = sheetRowToLead(row);
    if (!lead) {
      noId++;
      continue;
    }
    if (seen.has(lead.payload.id!)) continue; // the same lead on two tabs/sheets
    seen.add(lead.payload.id!);
    leads.push(lead);
  }

  // Staff a sheet's "Lead Owner" can name: active, matched by first name, unique.
  const staff = await prisma.user.findMany({
    where: { isActive: true, name: { not: null } },
    select: { id: true, name: true, role: true },
  });
  const byFirstName = new Map<string, string[]>();
  for (const u of staff) {
    if (["CLIENT", "VENUE_OWNER"].includes(u.role)) continue;
    const fn = u.name!.trim().split(/\s+/)[0].toLowerCase();
    byFirstName.set(fn, [...(byFirstName.get(fn) ?? []), u.id]);
  }
  const ownerId = (owner: string | undefined) => {
    const fn = ownerFirstName(owner);
    const ids = fn ? byFirstName.get(fn) : undefined;
    return ids && ids.length === 1 ? ids[0] : null;
  };

  const summary = {
    rows: rows.length,
    uniqueLeads: leads.length,
    rowsWithoutId: noId,
    imported: 0,
    alreadyInCrm: 0,
    heldBack: 0,
    skipped: 0,
    errors: 0,
    ownersSet: 0,
    statusesSet: 0,
    notesAdded: 0,
    unmatchedOwners: {} as Record<string, number>,
    byCampaign: {} as Record<string, number>,
  };

  for (const l of leads) {
    const owner = l.team.owner;
    if (owner && !ownerId(owner)) summary.unmatchedOwners[owner] = (summary.unmatchedOwners[owner] ?? 0) + 1;
    const camp = l.payload.campaign_name ?? "(unknown campaign)";
    summary.byCampaign[camp] = (summary.byCampaign[camp] ?? 0) + 1;
  }

  if (dry) {
    const ids = leads.map((l) => l.payload.id!);
    const present = await prisma.metaLeadCapture.findMany({ where: { metaLeadId: { in: ids } }, select: { metaLeadId: true } });
    const presentSet = new Set(present.map((p) => p.metaLeadId));
    for (const l of leads) {
      if (presentSet.has(l.payload.id!)) summary.alreadyInCrm++;
      else if (excludedCampaignMatch({ campaignName: l.payload.campaign_name, adsetName: l.payload.adset_name, formName: l.payload.form_name })) summary.heldBack++;
      else summary.imported++;
    }
    console.log(JSON.stringify({ dryRun: true, ...summary, note: "imported = would be imported (new or folded into an existing lead)" }, null, 2));
    return;
  }

  const creds = await getMetaCredentials();
  const systemUser = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, isActive: true },
    select: { id: true },
  });

  for (const l of leads) {
    const metaLeadId = l.payload.id!;
    try {
      const out = await processMetaLeadPayload(l.payload, creds);
      if (out.status === "skipped") {
        if (out.reason.startsWith("Campaign excluded")) summary.heldBack++;
        else summary.skipped++;
        continue;
      }
      if (out.status === "duplicate") summary.alreadyInCrm++;
      else summary.imported++;

      const leadId = out.leadId;
      if (!leadId) continue;
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, description: true, status: true, createdAt: true, assignedToId: true },
      });
      if (!lead) continue;

      const data: { description?: string; assignedToId?: string; status?: "NOT_CONNECTED" | "CONTACTED" } = {};
      const note = describeTeamNotes(l.team);
      if (note && !(lead.description ?? "").includes(SHEET_MARKER(metaLeadId))) {
        data.description = [lead.description, `${note} ${SHEET_MARKER(metaLeadId)}`].filter(Boolean).join("\n");
        summary.notesAdded++;
      }
      // The sheet's owner is who actually worked the lead — but only for a lead
      // this import created (dated at the enquiry), never one a rep already owns.
      const createdByThisImport =
        l.payload.created_time && lead.createdAt.toISOString() === l.payload.created_time;
      const named = ownerId(l.team.owner);
      if (named && createdByThisImport && lead.assignedToId !== named) {
        data.assignedToId = named;
        summary.ownersSet++;
      }
      const status = statusFromRemarks(l.team.remarks);
      if (status && lead.status === "NEW") {
        data.status = status;
        summary.statusesSet++;
      }
      if (Object.keys(data).length) {
        await prisma.lead.update({ where: { id: lead.id }, data });
        if (systemUser) {
          await prisma.activityLog.create({
            data: {
              action: "imported_from_leads_sheet",
              entityType: "Lead",
              entityId: lead.id,
              userId: systemUser.id,
              changes: { metaLeadId, ...("assignedToId" in data ? { owner: l.team.owner } : {}), ...(data.status ? { status: data.status } : {}) },
            },
          });
        }
      }
    } catch (e) {
      summary.errors++;
      console.error("[import-meta-sheet] lead failed", metaLeadId, e instanceof Error ? e.message : e);
    }
  }

  // Let fire-and-forget provider syncs settle before exiting.
  await new Promise((r) => setTimeout(r, 3000));
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
