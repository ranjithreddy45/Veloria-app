"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { awardVelos } from "@/lib/velos/award";

// ============================================================
// Demo engagement data — lets an admin populate THEIR OWN account with sample
// Velos points + activity to preview the engagement features (chip, confetti,
// standing, live feed). Every row is tagged so it can be cleared again. Awards
// flow through the real awardVelos() engine (idempotent), so re-seeding is safe.
// ============================================================

const DEMO_EVENT = "demo_seed";
const DEMO_PREFIX = "demo-"; // entityId marker for clean removal

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const id = session?.user?.id;
  if (!id || !["SUPER_ADMIN", "ADMIN"].includes(role ?? "")) return null;
  return { id };
}

export async function seedEngagementDemo(): Promise<{
  success: boolean;
  pointsAwarded?: number;
  activity?: number;
  error?: string;
}> {
  const u = await requireAdmin();
  if (!u) return { success: false, error: "Admins only" };

  // --- Velos points (through the real engine; idempotent on re-run) ---
  const awards = [
    { pts: 30, note: "Closed a deal" },
    { pts: 25, note: "Confirmed a booking" },
    { pts: 20, note: "Qualified a hot lead" },
    { pts: 15, note: "Collected a payment" },
    { pts: 10, note: "Completed today's tasks" },
  ];
  let pointsAwarded = 0;
  for (let i = 0; i < awards.length; i++) {
    const r = await awardVelos(prisma, {
      userId: u.id,
      eventType: DEMO_EVENT,
      entityType: "demo",
      entityId: `${DEMO_PREFIX}velos-${i + 1}`,
      pointsOverride: awards[i].pts,
      note: `Demo · ${awards[i].note}`,
    });
    if (r.awarded) pointsAwarded += r.points;
  }

  // --- Activity feed rows (staggered timestamps for a realistic feel) ---
  const acts = [
    { action: "CONFIRMED", entityType: "Booking" },
    { action: "CREATED", entityType: "Lead" },
    { action: "SENT", entityType: "Quotation" },
    { action: "RECORDED", entityType: "Payment" },
    { action: "COMPLETED", entityType: "Task" },
    { action: "WON", entityType: "Deal" },
  ];
  // Replace any prior demo activity so re-seeding doesn't pile up duplicates.
  await prisma.activityLog.deleteMany({
    where: { userId: u.id, entityId: { startsWith: DEMO_PREFIX } },
  });
  const now = Date.now();
  await prisma.activityLog.createMany({
    data: acts.map((a, i) => ({
      userId: u.id,
      action: a.action,
      entityType: a.entityType,
      entityId: `${DEMO_PREFIX}act-${i + 1}`,
      // 4m, 18m, 40m, 1.2h, 2.1h, 3.5h ago
      createdAt: new Date(now - [4, 18, 40, 72, 126, 210][i] * 60_000),
    })),
  });

  revalidatePath("/dashboard");
  revalidatePath("/performance/velos");
  return { success: true, pointsAwarded, activity: acts.length };
}

export async function clearEngagementDemo(): Promise<{
  success: boolean;
  removedPoints?: number;
  removedActivity?: number;
  error?: string;
}> {
  const u = await requireAdmin();
  if (!u) return { success: false, error: "Admins only" };

  const [v, a] = await Promise.all([
    prisma.velosLedger.deleteMany({ where: { userId: u.id, eventType: DEMO_EVENT } }),
    prisma.activityLog.deleteMany({
      where: { userId: u.id, entityId: { startsWith: DEMO_PREFIX } },
    }),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/performance/velos");
  return { success: true, removedPoints: v.count, removedActivity: a.count };
}
