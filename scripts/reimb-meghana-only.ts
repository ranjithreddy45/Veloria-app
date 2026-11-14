/**
 * One-off (owner request, 2026-11-14): reimbursements become
 *   Employee submits → Meghana N approves → Finance pays → Paid.
 *
 *   1. Everyone whose reporting manager is Dilkash now reports to Meghana N.
 *   2. Venkat, Dilkash, Nickson and the Finance approval step leave the
 *      approval flow: every 2nd-level rule and every named/team route is
 *      removed, so every claim takes the default route — Meghana (1st-level
 *      rule "ALL", unchanged), then Finance's payment list.
 *   3. In-flight claims (src/lib/hr/meghana-only-flow.ts): already approved by
 *      Meghana → Finance ("Approved – Pending Payment"); otherwise → Meghana.
 *      Past approvals and the claim history are never changed; each moved
 *      claim gets one trail entry saying why.
 *
 * Dry run by default — prints exactly what it would do. With --apply it first
 * writes every row it is about to change to a JSON backup, then makes all the
 * changes in ONE transaction; each claim update is guarded on the status and
 * version it read, so a claim that moves meanwhile aborts the whole run.
 *
 *   DATABASE_URL=… npx tsx scripts/reimb-meghana-only.ts            # dry run
 *   DATABASE_URL=… npx tsx scripts/reimb-meghana-only.ts --apply --backup /root/reimb-backup.json
 */
import { writeFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseChain } from "@/lib/hr/claim-chain";
import { AWAITING_STATUSES } from "@/lib/hr/claim-labels";
import { planClaimMove, type ClaimMove } from "@/lib/hr/meghana-only-flow";

// Production ids, read 2026-11-14 and re-checked by name below.
const MEGHANA_USER = "cmqf5mpo00000gw04cg3qow4x";
const MEGHANA_EMP = "cmrenez280004l204awuduebq";
const DILKASH_EMP = "cmsylnc1g0001kx04l57w0io3";
const TODAY = "14 Nov 2026";

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

async function main() {
  const apply = process.argv.includes("--apply");
  const bi = process.argv.indexOf("--backup");
  const backupPath = bi > 0 ? process.argv[bi + 1] : `reimb-meghana-only-backup-${Date.now()}.json`;

  // ---- who ---------------------------------------------------------------
  const [mUser, mEmp, dEmp] = await Promise.all([
    prisma.user.findUnique({ where: { id: MEGHANA_USER }, select: { id: true, name: true, isActive: true } }),
    prisma.employee.findUnique({ where: { id: MEGHANA_EMP }, select: { firstName: true, lastName: true, userId: true } }),
    prisma.employee.findUnique({ where: { id: DILKASH_EMP }, select: { firstName: true, lastName: true } }),
  ]);
  if (!mUser?.isActive || !/meghana/i.test(mUser.name ?? "") || mEmp?.userId !== MEGHANA_USER || !/^dilkash/i.test(dEmp?.firstName ?? "")) {
    throw new Error("Meghana / Dilkash ids don't match this database — stopping without changes.");
  }
  const meghana = { id: mUser.id, name: mUser.name ?? "Meghana" };

  // ---- what ----------------------------------------------------------------
  const reports = await prisma.employee.findMany({
    where: { reportingManagerId: DILKASH_EMP },
    select: { id: true, empCode: true, firstName: true, lastName: true, status: true, reportingManagerId: true },
  });
  const rules = await prisma.hrReimbursementApprover.findMany({ where: { level: { gte: 2 } } });
  const routes = await prisma.hrReimbursementRoute.findMany();
  const claims = await prisma.hrReimbursementClaim.findMany({
    where: { status: { in: [...AWAITING_STATUSES] } },
    select: {
      id: true, employeeId: true, title: true, amount: true, status: true, stageIndex: true, approvalChain: true,
      decidedById: true, decidedAt: true, updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const emps = await prisma.employee.findMany({
    where: { id: { in: Array.from(new Set(claims.map((c) => c.employeeId))) } },
    select: { id: true, firstName: true, lastName: true, userId: true },
  });
  const empOf = new Map(emps.map((e) => [e.id, e]));
  const plans = claims.map((c) => ({
    claim: c,
    emp: empOf.get(c.employeeId),
    move: planClaimMove({ status: c.status, chain: parseChain(c.approvalChain), claimantUserId: empOf.get(c.employeeId)?.userId ?? null }, meghana),
  }));

  // ---- report --------------------------------------------------------------
  console.log(`\n1. Reporting manager Dilkash → Meghana N (${reports.length}):`);
  for (const r of reports) console.log(`   ${r.empCode}  ${r.firstName} ${r.lastName}  (${r.status})`);
  console.log(`\n2. Approval rules removed: ${rules.length} second-level rule(s), ${routes.length} named/team route(s). 1st-level "ALL" = Meghana stays.`);
  const by = (k: ClaimMove["kind"]) => plans.filter((p) => p.move.kind === k);
  for (const [k, title] of [["TO_FINANCE", "→ Finance (Approved – Pending Payment)"], ["TO_MEGHANA", "→ Meghana for approval"], ["SKIP", "left as they are"]] as const) {
    const ps = by(k);
    const total = ps.reduce((s, p) => s + Number(p.claim.amount), 0);
    console.log(`\n3. ${ps.length} claim(s) ${title}${ps.length ? ` — ${inr(total)}` : ""}`);
    for (const p of ps) {
      const who = `${p.emp?.firstName ?? "?"} ${p.emp?.lastName ?? ""}`.trim();
      const extra = p.move.kind === "SKIP" ? p.move.reason : p.move.dropped.length ? `no longer needed: ${p.move.dropped.join(", ")}` : "";
      console.log(`   ${p.claim.id}  ${who.padEnd(20)} ${inr(Number(p.claim.amount)).padStart(10)}  ${p.claim.status.padEnd(10)} ${extra}`);
    }
  }

  if (!apply) {
    console.log("\nDry run — nothing changed. Re-run with --apply to make these changes.\n");
    return;
  }

  // ---- backup --------------------------------------------------------------
  writeFileSync(backupPath, JSON.stringify({ takenAt: new Date().toISOString(), reports, rules, routes, claims }, null, 1));
  console.log(`\nBackup written: ${backupPath}`);

  // ---- apply ---------------------------------------------------------------
  const moved = plans.filter((p) => p.move.kind !== "SKIP");
  await prisma.$transaction(
    async (tx) => {
      const r = await tx.employee.updateMany({ where: { reportingManagerId: DILKASH_EMP }, data: { reportingManagerId: MEGHANA_EMP } });
      if (r.count !== reports.length) throw new Error(`Reporting managers changed meanwhile (${r.count} ≠ ${reports.length}) — rolled back.`);
      await tx.hrReimbursementApprover.deleteMany({ where: { id: { in: rules.map((x) => x.id) } } });
      await tx.hrReimbursementRoute.deleteMany({ where: { id: { in: routes.map((x) => x.id) } } });

      for (const { claim: c, move: m } of moved) {
        const guard = { id: c.id, status: c.status, updatedAt: c.updatedAt };
        let res;
        let note: string;
        let to: string;
        if (m.kind === "TO_FINANCE") {
          to = "APPROVED";
          const when = new Date(m.decidedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
          note = `Approval flow changed on ${TODAY}: Meghana N's approval (${when}) is now the only approval needed${m.dropped.length ? ` — ${m.dropped.join(" and ")}'s approval no longer required` : ""}. Sent to Finance for payment.`;
          res = await tx.hrReimbursementClaim.updateMany({
            where: guard,
            data: {
              status: "APPROVED", stageIndex: m.stageIndex, approvalChain: m.chain as unknown as Prisma.InputJsonValue,
              decidedById: m.decidedById, decidedAt: new Date(m.decidedAt),
            },
          });
        } else if (m.kind === "TO_MEGHANA") {
          to = m.status;
          note = `Approval flow changed on ${TODAY}: now with Meghana N for approval, then Finance pays${m.dropped.length ? ` (${m.dropped.join(" and ")} no longer in the route)` : ""}.`;
          res = await tx.hrReimbursementClaim.updateMany({
            where: guard,
            data: { status: m.status, stageIndex: m.stageIndex, approvalChain: m.chain as unknown as Prisma.InputJsonValue },
          });
        } else continue;
        if (res.count !== 1) throw new Error(`Claim ${c.id} changed while this ran — rolled back, nothing applied.`);
        await tx.hrClaimEvent.create({ data: { claimId: c.id, action: "ROUTED", fromStatus: c.status, toStatus: to, note, actorName: "System" } });
      }
    },
    { timeout: 120_000 },
  );
  console.log(`Applied: ${reports.length} reporting manager(s), ${rules.length} rule(s) + ${routes.length} route(s) removed, ${moved.length} claim(s) moved.`);

  // ---- tell people (in-app; after the commit, best-effort) ------------------
  const toFinance = moved.filter((p) => p.move.kind === "TO_FINANCE");
  const toMeghana = moved.filter((p) => p.move.kind === "TO_MEGHANA");
  const notes: Prisma.NotificationCreateManyInput[] = [];
  const finance = await prisma.user.findMany({ where: { role: "FINANCE", isActive: true }, select: { id: true } });
  if (toFinance.length) {
    const total = toFinance.reduce((s, p) => s + Number(p.claim.amount), 0);
    for (const f of finance) {
      notes.push({ userId: f.id, type: "SYSTEM", title: "Reimbursements ready for payment",
        message: `The approval flow is now Meghana N → Finance. ${toFinance.length} claims (${inr(total)}) that Meghana had already approved are now Approved – Pending Payment.`,
        actionUrl: "/finance/reimbursements" });
    }
  }
  if (toMeghana.length) {
    notes.push({ userId: meghana.id, type: "SYSTEM", title: "Reimbursement approvals: you are now the only approver",
      message: `Claims now go Employee → you → Finance. ${toMeghana.length} claim(s) are waiting for your approval.`, actionUrl: "/me/approvals" });
  }
  const perEmployee = new Map<string, { userId: string; finance: number; meghana: number }>();
  for (const p of moved) {
    if (!p.emp?.userId) continue;
    const e = perEmployee.get(p.emp.id) ?? { userId: p.emp.userId, finance: 0, meghana: 0 };
    if (p.move.kind === "TO_FINANCE") e.finance++; else e.meghana++;
    perEmployee.set(p.emp.id, e);
  }
  for (const e of perEmployee.values()) {
    const parts = [
      e.finance ? `${e.finance} claim${e.finance === 1 ? " is" : "s are"} now Approved – Pending Payment with Finance` : null,
      e.meghana ? `${e.meghana} claim${e.meghana === 1 ? " is" : "s are"} now with Meghana N for approval` : null,
    ].filter(Boolean);
    notes.push({ userId: e.userId, type: "SYSTEM", title: "Your reimbursement claims moved to the new approval flow",
      message: `Claims now need only Meghana N's approval before Finance pays. ${parts.join("; ")}.`, actionUrl: "/me/reimbursements" });
  }
  try {
    const n = await prisma.notification.createMany({ data: notes });
    console.log(`Notified: ${n.count} in-app notice(s).`);
  } catch (e) {
    console.error("Notifications failed (the changes above are applied):", e);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
