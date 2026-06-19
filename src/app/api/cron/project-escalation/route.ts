import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { computePortfolio } from "@/lib/projects/portfolio";
import { notify } from "@/lib/notify";

// Daily: escalate at-risk venue projects (open critical snags / over budget /
// overdue) to the project leadership. Cron-secret protected, best-effort notify.
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!authHeader || !process.env.CRON_SECRET || authHeader.length !== expected.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const portfolio = await computePortfolio();
    const atRisk = (portfolio?.rows ?? []).filter((r) => r.atRisk);
    if (atRisk.length === 0) return NextResponse.json({ ok: true, atRisk: 0, notified: 0 });

    const leads = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["PROJECTS_HEAD", "PROJECTS_EXEC", "SUPER_ADMIN", "ADMIN"] } },
      select: { id: true },
    });

    const lines = atRisk.slice(0, 8).map((r) => {
      const why = [r.openCritical > 0 ? `${r.openCritical} critical snag${r.openCritical > 1 ? "s" : ""}` : null, r.overBudget ? "over budget" : null, r.overdue ? "overdue" : null].filter(Boolean).join(", ");
      return `${r.name} — ${why}`;
    });
    const message = `${atRisk.length} venue${atRisk.length > 1 ? "s" : ""} at risk: ${lines.join("; ")}`;

    let notified = 0;
    for (const l of leads) {
      try {
        await notify({ userId: l.id, type: "SYSTEM", title: "Projects at risk", message, actionUrl: "/projects/portfolio" });
        notified++;
      } catch { /* best-effort */ }
    }
    return NextResponse.json({ ok: true, atRisk: atRisk.length, notified });
  } catch (e) {
    console.error("[PROJECT_ESCALATION_CRON_ERROR]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
