import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

// ============================================================
// Cron lane lease — one run per lane at a time.
//
// Several schedulers can fire the same lane (GitHub Actions, the server
// crontab, vercel.json), and the 5-minute `fast` job also runs inside the
// hourly lane. Without a lock two runs overlap and every sender in them can
// message a customer twice. The lease is one row per lane, claimed with a
// guarded updateMany (only when the current lease has expired), so exactly one
// concurrent caller wins. The TTL outlives the lane's maxDuration: a run that
// is killed mid-way releases nothing, and the next run waits for expiry rather
// than racing a zombie.
// ============================================================

/** Claim the lease; returns the holder token, or null when another run holds it. */
export async function claimCronLease(name: string, ttlMs: number, now: Date = new Date()): Promise<string | null> {
  const holder = randomUUID();
  await prisma.cronLaneLease.createMany({
    data: [{ lane: name, leaseUntil: new Date(0) }],
    skipDuplicates: true,
  });
  const won = await prisma.cronLaneLease.updateMany({
    where: { lane: name, leaseUntil: { lt: now } },
    data: { leaseUntil: new Date(now.getTime() + ttlMs), holder },
  });
  return won.count === 1 ? holder : null;
}

/** Give the lease back early — only if we still hold it. */
export async function releaseCronLease(name: string, holder: string): Promise<void> {
  try {
    await prisma.cronLaneLease.updateMany({
      where: { lane: name, holder },
      data: { leaseUntil: new Date(0), holder: null }, // expired outright, not "now" (same-ms runs)
    });
  } catch (e) {
    // The lease expires on its own; failing to release only delays the next run.
    console.error("[CRON_LEASE_RELEASE_ERROR]", name, e);
  }
}

/** Run `fn` under the lease, or report that another run holds it. */
export async function withCronLease<T>(
  name: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<{ ran: true; value: T } | { ran: false }> {
  const holder = await claimCronLease(name, ttlMs);
  if (!holder) {
    console.warn(`[CRON_LEASE_SKIPPED] ${name}: another run holds the lease`);
    return { ran: false };
  }
  try {
    return { ran: true, value: await fn() };
  } finally {
    await releaseCronLease(name, holder);
  }
}
