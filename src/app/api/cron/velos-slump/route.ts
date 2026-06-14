import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runSlumpCatch, settleTeamQuests } from "@/actions/velos-quests.actions";

// Nightly: surface recovery quests for slumping staff (B7) and settle any
// team quests that hit their target. Cron-secret protected.
export async function GET(request: Request) {
  try {
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

    const slump = await runSlumpCatch(process.env.CRON_SECRET);
    const team = await settleTeamQuests(process.env.CRON_SECRET);
    return NextResponse.json({ ok: true, recoveryQuestsCreated: slump.created, usersChecked: slump.checked, teamQuestsSettled: team.settled });
  } catch (e) {
    console.error("[VELOS_SLUMP_CRON_ERROR]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
