import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { detectAnomalies } from "@/lib/ai/anomaly-detection";
import { notifyAwait } from "@/lib/notify";

export async function GET(request: Request) {
  try {
    // Verify cron secret (timing-safe comparison)
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

    // Run anomaly detection
    const anomalies = await detectAnomalies();

    let created = 0;
    let skippedDuplicates = 0;
    const newHighCritical: { type: string; title: string }[] = [];

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    for (const anomaly of anomalies) {
      // Check for duplicates: similar active alert in last 24h
      const existingAlert = await prisma.anomalyAlert.findFirst({
        where: {
          type: anomaly.type,
          isActive: true,
          detectedAt: { gte: twentyFourHoursAgo },
        },
      });

      if (existingAlert) {
        skippedDuplicates++;
        continue;
      }

      // Create new alert
      await prisma.anomalyAlert.create({
        data: {
          type: anomaly.type,
          severity: anomaly.severity,
          title: anomaly.title,
          description: anomaly.description,
          entityType: anomaly.entityType ?? null,
          entityId: anomaly.entityId ?? null,
          metric: anomaly.metric ?? null,
          expectedValue: anomaly.expectedValue ?? null,
          actualValue: anomaly.actualValue ?? null,
          deviationPercent: anomaly.deviationPercent ?? null,
          detectedAt: new Date(),
          isActive: true,
        },
      });

      created++;

      // Track HIGH/CRITICAL for admin notifications
      if (anomaly.severity === "HIGH" || anomaly.severity === "CRITICAL") {
        newHighCritical.push({
          type: anomaly.type,
          title: anomaly.title,
        });
      }
    }

    // Notify admin users about new HIGH/CRITICAL alerts
    if (newHighCritical.length > 0) {
      const admins = await prisma.user.findMany({
        where: {
          role: { in: ["SUPER_ADMIN", "ADMIN"] },
          isActive: true,
        },
        select: { id: true },
      });

      const pending: Promise<void>[] = [];
      for (const alert of newHighCritical) {
        for (const admin of admins) {
          pending.push(
            notifyAwait({
              userId: admin.id,
              type: "SYSTEM",
              title: "Anomaly Detected",
              message: alert.title,
              actionUrl: "/analytics/anomalies",
            })
          );
        }
      }
      // Await so the writes complete before the serverless function freezes.
      await Promise.all(pending);
    }

    return NextResponse.json({
      success: true,
      detected: anomalies.length,
      created,
      skippedDuplicates,
      notifiedAdmins: newHighCritical.length > 0,
    });
  } catch (error) {
    console.error("[ANOMALY_DETECTION_CRON_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
