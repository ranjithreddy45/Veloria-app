// ============================================================
// /api/draw/winner
//   POST   (staff, bookings:read) — draw ONE winner for a month (CSPRNG)
//   DELETE (admin)                — re-draw: delete the month's winner (logged)
// ============================================================

import { randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { isDrawMonthKey, drawMonthRange, maskPhone, drawEventLabel } from "@/lib/draw";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const isAdmin = (role?: string) => role === "SUPER_ADMIN" || role === "ADMIN";

async function winnerPayload(winner: { drawMonth: string; entryId: number; poolSize: number; drawnAt: Date; prizeDelivered: boolean; announced: boolean }) {
  const entry = await prisma.drawEntry.findUnique({ where: { id: winner.entryId } });
  return {
    draw_month: winner.drawMonth,
    pool_size: winner.poolSize,
    drawn_at: winner.drawnAt.toISOString(),
    prize_delivered: winner.prizeDelivered,
    announced: winner.announced,
    entry: entry
      ? {
          entry_code: entry.entryCode,
          guest_name: entry.guestName,
          phone_masked: maskPhone(entry.phone),
          host_name: entry.hostName,
          event_type_label: drawEventLabel(entry.eventType),
          event_date: entry.eventDate.toISOString().slice(0, 10),
        }
      : null,
  };
}

// ---- GET: the winner for a month (or current), for the stats row ----------
export async function GET(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role) return json({ error: "Unauthorized" }, 401);
  if (!hasPermission(role, "bookings:read")) return json({ error: "Forbidden" }, 403);

  const { drawMonthKey } = await import("@/lib/draw");
  const month = new URL(req.url).searchParams.get("draw_month") || drawMonthKey(new Date());
  if (!isDrawMonthKey(month)) return json({ error: "Invalid month." }, 422);
  const w = await prisma.drawWinner.findUnique({ where: { drawMonth: month } });
  return json({ draw_month: month, winner: w ? await winnerPayload(w) : null });
}

// ---- POST: run the draw ---------------------------------------------------
export async function POST(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role) return json({ error: "Unauthorized" }, 401);
  if (!hasPermission(role, "bookings:read")) return json({ error: "Forbidden" }, 403);

  let body: { draw_month?: unknown };
  try { body = (await req.json()) as { draw_month?: unknown }; } catch { return json({ error: "Invalid body." }, 400); }
  if (!isDrawMonthKey(body.draw_month)) return json({ error: "A valid draw month (YYYY-MM) is required." }, 422);
  const drawMonth = body.draw_month as string;

  // Already drawn? Return the existing winner (idempotent, not an error the UI hides).
  const existing = await prisma.drawWinner.findUnique({ where: { drawMonth } });
  if (existing) return json({ already_drawn: true, winner: await winnerPayload(existing) }, 409);

  const { start, end } = drawMonthRange(drawMonth);
  const pool = await prisma.drawEntry.findMany({
    where: { createdAt: { gte: start, lt: end }, optedOut: false },
    select: { id: true },
  });
  if (pool.length === 0) return json({ error: "No eligible entries for this month." }, 422);

  // Cryptographically-random selection — this is a prize draw, never Math.random.
  const winnerId = pool[randomInt(0, pool.length)].id;

  try {
    const winner = await prisma.drawWinner.create({
      data: { drawMonth, entryId: winnerId, poolSize: pool.length, drawnById: session!.user!.id },
    });
    return json({ winner: await winnerPayload(winner) }, 201);
  } catch (e) {
    // Two staff drew at once — the unique drawMonth held; return the winner that landed.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const w = await prisma.drawWinner.findUnique({ where: { drawMonth } });
      if (w) return json({ already_drawn: true, winner: await winnerPayload(w) }, 409);
    }
    console.error("[DRAW_WINNER_ERROR]", e);
    return json({ error: "Could not run the draw. Please try again." }, 500);
  }
}

// ---- PATCH: toggle prize delivered / announced (staff) --------------------
export async function PATCH(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role) return json({ error: "Unauthorized" }, 401);
  if (!hasPermission(role, "bookings:read")) return json({ error: "Forbidden" }, 403);

  let body: { draw_month?: unknown; prize_delivered?: unknown; announced?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return json({ error: "Invalid body." }, 400); }
  if (!isDrawMonthKey(body.draw_month)) return json({ error: "A valid draw month is required." }, 422);

  const data: { prizeDelivered?: boolean; announced?: boolean } = {};
  if (typeof body.prize_delivered === "boolean") data.prizeDelivered = body.prize_delivered;
  if (typeof body.announced === "boolean") data.announced = body.announced;
  if (Object.keys(data).length === 0) return json({ error: "Nothing to update." }, 422);

  try {
    const w = await prisma.drawWinner.update({ where: { drawMonth: body.draw_month as string }, data });
    return json({ winner: await winnerPayload(w) });
  } catch {
    return json({ error: "No winner for this month yet." }, 404);
  }
}

// ---- DELETE: re-draw (admin only, logged) ---------------------------------
export async function DELETE(req: Request) {
  const session = await auth();
  const role = session?.user?.role;
  if (!role) return json({ error: "Unauthorized" }, 401);
  if (!isAdmin(role)) return json({ error: "Only an admin can re-draw." }, 403);

  const drawMonth = new URL(req.url).searchParams.get("draw_month") || "";
  if (!isDrawMonthKey(drawMonth)) return json({ error: "A valid draw month is required." }, 422);

  const existing = await prisma.drawWinner.findUnique({ where: { drawMonth } });
  if (!existing) return json({ error: "No winner to re-draw for this month." }, 404);

  await prisma.$transaction([
    prisma.drawWinner.delete({ where: { drawMonth } }),
    prisma.activityLog.create({
      data: {
        action: "DRAW_WINNER_REDRAW", entityType: "DRAW_WINNER", entityId: String(existing.id),
        userId: session!.user!.id,
        changes: { drawMonth, previousEntryId: existing.entryId, poolSize: existing.poolSize },
      },
    }),
  ]);
  return json({ ok: true });
}
