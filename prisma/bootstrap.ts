/**
 * Idempotent production bootstrap.
 *
 * Runs during the Vercel build (after `prisma db push`). Unlike seed.ts,
 * this NEVER deletes anything — it only creates the minimum needed for a
 * working production app if it's missing:
 *   1. A SUPER_ADMIN login
 *   2. The default sales pipeline stages
 *
 * Safe to run on every deploy.
 */
import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ---- 1. Ensure a SUPER_ADMIN exists ----
  const adminEmail =
    process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@veloriagrand.com";
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "Admin@123";
    const hashed = await bcryptjs.hash(password, 12);
    await prisma.user.create({
      data: {
        name: "Administrator",
        email: adminEmail,
        hashedPassword: hashed,
        role: "SUPER_ADMIN",
        isActive: true,
        emailVerified: new Date(),
      },
    });
    console.log(`[bootstrap] Created SUPER_ADMIN: ${adminEmail}`);
  } else {
    console.log(`[bootstrap] Admin already exists: ${adminEmail}`);
  }

  // ---- 2. Ensure default pipeline stages exist ----
  const stageCount = await prisma.pipelineStage.count();
  if (stageCount === 0) {
    await prisma.pipelineStage.createMany({
      data: [
        { name: "New Inquiry", order: 1, color: "#6366f1", isDefault: true },
        { name: "Site Visit", order: 2, color: "#8b5cf6" },
        { name: "Proposal Sent", order: 3, color: "#3b82f6" },
        { name: "Negotiation", order: 4, color: "#f59e0b" },
        { name: "Won", order: 5, color: "#10b981", isWonStage: true },
        { name: "Lost", order: 6, color: "#ef4444", isLostStage: true },
      ],
    });
    console.log("[bootstrap] Created 6 default pipeline stages");
  } else {
    console.log(`[bootstrap] Pipeline stages already exist (${stageCount})`);
  }

  console.log("[bootstrap] Done.");
}

main()
  .catch((e) => {
    console.error("[bootstrap] Failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
