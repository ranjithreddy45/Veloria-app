/**
 * One-off: give existing leads their conversion timestamps, then write the
 * catch-up file for Google Ads.
 *
 *   npx tsx scripts/backfill-gads-conversions.ts            # dry run
 *   npx tsx scripts/backfill-gads-conversions.ts --write    # stamp the leads
 *   npx tsx scripts/backfill-gads-conversions.ts --write --strict
 *
 * WHY updatedAt. There is no lead status history in this database — nothing
 * records when a lead first became Qualified or Won. ActivityLog carries a
 * "status_changed" row with no payload saying which status, and the pipeline,
 * macro, workflow and import paths log nothing at all. So updatedAt is the only
 * signal available, and it is a ceiling rather than the truth: a lead touched
 * by the nightly engagement reconcile shows that date instead. Every stamp it
 * writes is therefore clamped to the lead's own createdAt..now range, and the
 * feed's own filters drop anything Google would reject.
 *
 * WHY --strict matters. The Qualified rules (event date, 50+ guests, event type,
 * location confirmed) are about leads arriving from now on. Applied to the
 * history they match nothing at all, because both ad webhooks used to discard
 * the form answers — so a strict run emits an empty file. The default run trusts
 * the status a human already set, which is the only qualification signal that
 * exists for those leads.
 */

import { writeFileSync } from "fs";
import path from "path";

import { PrismaClient } from "@prisma/client";

import {
  buildConversionRows,
  toFeedCsv,
  type FeedLead,
} from "../src/lib/marketing/gads-conversion-feed";
import { validateLeadStatusChange } from "../src/lib/marketing/lead-status-rules";

const prisma = new PrismaClient();

const WRITE = process.argv.includes("--write");
const STRICT = process.argv.includes("--strict");
/** The brief's cut-off: leads created on or after this date. */
const SINCE = new Date("2026-06-25T00:00:00.000Z");

/** Keep a stamp inside the only range that can be true for this lead. */
function clamp(when: Date, createdAt: Date, now: Date): Date {
  if (when < createdAt) return createdAt;
  if (when > now) return now;
  return when;
}

async function main() {
  const now = new Date();

  // ---- 1. stamp qualifiedAt / wonAt -------------------------------------
  const needsStamp = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      OR: [
        { status: "QUALIFIED", qualifiedAt: null },
        { status: "WON", OR: [{ wonAt: null }, { qualifiedAt: null }] },
        // PROPOSAL_SENT and NEGOTIATION are past Qualified by definition.
        { status: { in: ["PROPOSAL_SENT", "NEGOTIATION"] }, qualifiedAt: null },
      ],
    },
    select: { id: true, status: true, createdAt: true, updatedAt: true, qualifiedAt: true, wonAt: true },
  });

  let stamped = 0;
  for (const lead of needsStamp) {
    const at = clamp(lead.updatedAt, lead.createdAt, now);
    const data: { qualifiedAt?: Date; wonAt?: Date } = {};
    if (!lead.qualifiedAt) data.qualifiedAt = at;
    // A lead that was won was qualified — at the same instant, since that is
    // all the history can tell us.
    if (lead.status === "WON" && !lead.wonAt) data.wonAt = at;
    if (!Object.keys(data).length) continue;
    if (WRITE) await prisma.lead.update({ where: { id: lead.id }, data });
    stamped++;
  }
  console.log(
    `${WRITE ? "Stamped" : "Would stamp"} ${stamped} of ${needsStamp.length} leads (qualifiedAt / wonAt from updatedAt).`
  );

  // ---- 2. the catch-up file ---------------------------------------------
  const leads = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      source: "GOOGLE_ADS",
      createdAt: { gte: SINCE },
      attribution: { gclid: { not: null } },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      qualifiedAt: true,
      wonAt: true,
      bookingValue: true,
      eventDate: true,
      guestCount: true,
      eventType: true,
      locationConfirmed: true,
      attribution: { select: { gclid: true } },
    },
  });

  let droppedByRules = 0;
  const feedLeads: FeedLead[] = [];
  for (const lead of leads) {
    if (STRICT) {
      const ok = validateLeadStatusChange("QUALIFIED", {
        eventDate: lead.eventDate,
        guestCount: lead.guestCount,
        eventType: lead.eventType,
        locationConfirmed: lead.locationConfirmed,
        bookingValue: lead.bookingValue,
      }).ok;
      if (!ok) {
        droppedByRules++;
        continue;
      }
    }
    const qualifiedAt =
      lead.qualifiedAt ??
      (["QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"].includes(lead.status)
        ? clamp(lead.updatedAt, lead.createdAt, now)
        : null);
    const wonAt =
      lead.wonAt ?? (lead.status === "WON" ? clamp(lead.updatedAt, lead.createdAt, now) : null);

    feedLeads.push({
      id: lead.id,
      createdAt: lead.createdAt,
      qualifiedAt,
      wonAt,
      bookingValue: lead.bookingValue == null ? null : Number(lead.bookingValue),
      gclid: lead.attribution?.gclid ?? null,
    });
  }

  // The window is wide here on purpose: this file is the history, and Google
  // still applies its own 90-days-after-the-click rule, which the builder
  // enforces for us.
  const rows = buildConversionRows(feedLeads, { now, windowDays: 3650 });
  const csv = toFeedCsv(rows);
  const out = path.resolve(process.cwd(), `gads-conversions-backfill-${now.toISOString().slice(0, 10)}.csv`);
  writeFileSync(out, csv, "utf8");

  const qualified = rows.filter((r) => r.conversionName.includes("Qualified")).length;
  const won = rows.length - qualified;
  console.log(
    `Google Ads leads since ${SINCE.toISOString().slice(0, 10)} with a click id: ${leads.length}` +
      (STRICT ? ` · dropped by the strict rules: ${droppedByRules}` : "")
  );
  console.log(`Rows written: ${rows.length} (${qualified} qualified, ${won} booking)`);
  console.log(`File: ${out}`);
  if (!WRITE) console.log("\nDry run — no lead was modified. Re-run with --write to stamp them.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
