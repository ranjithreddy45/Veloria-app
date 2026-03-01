// ============================================================
// Anomaly Detection Engine
// ============================================================
// Analyzes business metrics and detects anomalies across revenue,
// leads, bookings, payments, and conversion rates.

import { prisma } from "@/lib/prisma";
import { chatCompletionWithSystem } from "@/lib/ai/openai-client";

// ============================================================
// Types
// ============================================================

export interface DetectedAnomaly {
  type: string; // REVENUE_DROP, REVENUE_SPIKE, LEAD_VOLUME_CHANGE, BOOKING_CANCELLATION_CLUSTER, PAYMENT_DELAY, CONVERSION_RATE_DROP
  severity: string; // LOW, MEDIUM, HIGH, CRITICAL
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  metric?: string;
  expectedValue?: number;
  actualValue?: number;
  deviationPercent?: number;
}

// ============================================================
// Helpers
// ============================================================

function startOfWeek(weeksAgo: number): Date {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const diff = now.getDate() - dayOfWeek - weeksAgo * 7;
  const d = new Date(now);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(monthsAgo: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(monthsAgo: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo + 1);
  d.setDate(0); // last day of previous month
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================================
// 1. Revenue Anomalies
// ============================================================

async function detectRevenueAnomalies(): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = [];

  try {
    // Current week revenue (invoiced totalAmount for SENT, PAID, PARTIALLY_PAID)
    const thisWeekStart = startOfWeek(0);
    const now = new Date();

    const currentWeekInvoices = await prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: {
        createdAt: { gte: thisWeekStart, lte: now },
        status: { in: ["SENT", "PAID", "PARTIALLY_PAID"] },
      },
    });

    const currentWeekRevenue = Number(currentWeekInvoices._sum.totalAmount ?? 0);

    // Last 4 weeks average
    const weeklyRevenues: number[] = [];
    for (let w = 1; w <= 4; w++) {
      const weekStart = startOfWeek(w);
      const weekEnd = startOfWeek(w - 1);

      const weekInvoices = await prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: {
          createdAt: { gte: weekStart, lt: weekEnd },
          status: { in: ["SENT", "PAID", "PARTIALLY_PAID"] },
        },
      });

      weeklyRevenues.push(Number(weekInvoices._sum.totalAmount ?? 0));
    }

    const avgWeeklyRevenue =
      weeklyRevenues.length > 0
        ? weeklyRevenues.reduce((a, b) => a + b, 0) / weeklyRevenues.length
        : 0;

    if (avgWeeklyRevenue > 0) {
      const ratio = currentWeekRevenue / avgWeeklyRevenue;
      const deviationPercent = Math.round((ratio - 1) * 100);

      if (ratio < 0.7) {
        anomalies.push({
          type: "REVENUE_DROP",
          severity: "HIGH",
          title: "Revenue Drop Detected",
          description: `This week's invoiced revenue (${formatINR(currentWeekRevenue)}) is ${Math.abs(deviationPercent)}% below the 4-week average (${formatINR(avgWeeklyRevenue)}). This may indicate a slowdown in sales or billing activity.`,
          metric: "weekly_revenue",
          expectedValue: Math.round(avgWeeklyRevenue),
          actualValue: Math.round(currentWeekRevenue),
          deviationPercent,
        });
      } else if (ratio > 1.5) {
        anomalies.push({
          type: "REVENUE_SPIKE",
          severity: "MEDIUM",
          title: "Revenue Spike Detected",
          description: `This week's invoiced revenue (${formatINR(currentWeekRevenue)}) is ${deviationPercent}% above the 4-week average (${formatINR(avgWeeklyRevenue)}). This is a positive anomaly worth investigating to understand the cause.`,
          metric: "weekly_revenue",
          expectedValue: Math.round(avgWeeklyRevenue),
          actualValue: Math.round(currentWeekRevenue),
          deviationPercent,
        });
      }
    }
  } catch (error) {
    console.error("[ANOMALY_DETECTION] Revenue detection error:", error);
  }

  return anomalies;
}

// ============================================================
// 2. Lead Volume Changes
// ============================================================

async function detectLeadVolumeChanges(): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = [];

  try {
    const thisWeekStart = startOfWeek(0);
    const now = new Date();

    const currentWeekLeads = await prisma.lead.count({
      where: {
        createdAt: { gte: thisWeekStart, lte: now },
      },
    });

    // Last 4 weeks average
    const weeklyLeads: number[] = [];
    for (let w = 1; w <= 4; w++) {
      const weekStart = startOfWeek(w);
      const weekEnd = startOfWeek(w - 1);

      const count = await prisma.lead.count({
        where: {
          createdAt: { gte: weekStart, lt: weekEnd },
        },
      });
      weeklyLeads.push(count);
    }

    const avgWeeklyLeads =
      weeklyLeads.length > 0
        ? weeklyLeads.reduce((a, b) => a + b, 0) / weeklyLeads.length
        : 0;

    if (avgWeeklyLeads > 0) {
      const ratio = currentWeekLeads / avgWeeklyLeads;
      const deviationPercent = Math.round((ratio - 1) * 100);

      if (ratio < 0.5) {
        anomalies.push({
          type: "LEAD_VOLUME_CHANGE",
          severity: "HIGH",
          title: "Significant Lead Volume Drop",
          description: `This week's new leads (${currentWeekLeads}) is ${Math.abs(deviationPercent)}% below the 4-week average (${Math.round(avgWeeklyLeads)}). This may indicate issues with marketing channels or seasonal changes.`,
          metric: "weekly_lead_count",
          expectedValue: Math.round(avgWeeklyLeads),
          actualValue: currentWeekLeads,
          deviationPercent,
        });
      } else if (ratio > 2.0) {
        anomalies.push({
          type: "LEAD_VOLUME_CHANGE",
          severity: "MEDIUM",
          title: "Lead Volume Surge Detected",
          description: `This week's new leads (${currentWeekLeads}) is ${deviationPercent}% above the 4-week average (${Math.round(avgWeeklyLeads)}). Investigate lead quality and ensure follow-up capacity.`,
          metric: "weekly_lead_count",
          expectedValue: Math.round(avgWeeklyLeads),
          actualValue: currentWeekLeads,
          deviationPercent,
        });
      }
    }
  } catch (error) {
    console.error("[ANOMALY_DETECTION] Lead volume detection error:", error);
  }

  return anomalies;
}

// ============================================================
// 3. Booking Cancellation Clusters
// ============================================================

async function detectBookingCancellationClusters(): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = [];

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCancellations = await prisma.booking.count({
      where: {
        status: "CANCELLED",
        updatedAt: { gte: sevenDaysAgo },
      },
    });

    if (recentCancellations > 3) {
      const severity = recentCancellations > 5 ? "CRITICAL" : "HIGH";

      anomalies.push({
        type: "BOOKING_CANCELLATION_CLUSTER",
        severity,
        title: "Booking Cancellation Cluster",
        description: `${recentCancellations} bookings have been cancelled in the last 7 days. This unusual clustering may indicate a systemic issue that needs immediate attention.`,
        metric: "weekly_cancellations",
        expectedValue: 1, // Typically low
        actualValue: recentCancellations,
        deviationPercent: Math.round(((recentCancellations - 1) / 1) * 100),
      });
    }
  } catch (error) {
    console.error("[ANOMALY_DETECTION] Cancellation cluster detection error:", error);
  }

  return anomalies;
}

// ============================================================
// 4. Payment Delays
// ============================================================

async function detectPaymentDelays(): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = [];

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find overdue invoices where dueDate is > 7 days ago
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: "OVERDUE",
        dueDate: { lt: sevenDaysAgo },
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        paidAmount: true,
        balanceDue: true,
        dueDate: true,
        contact: {
          select: { firstName: true, lastName: true, company: true },
        },
      },
    });

    if (overdueInvoices.length > 3) {
      const totalOverdue = overdueInvoices.reduce(
        (sum, inv) => sum + Number(inv.balanceDue ?? 0),
        0
      );

      let severity: string;
      if (totalOverdue > 500000) {
        severity = "CRITICAL";
      } else if (totalOverdue > 200000) {
        severity = "HIGH";
      } else {
        severity = "MEDIUM";
      }

      // Group by age
      const now = new Date();
      let over30Days = 0;
      let over14Days = 0;
      let over7Days = 0;

      for (const inv of overdueInvoices) {
        const daysDiff = Math.floor(
          (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 30) over30Days++;
        else if (daysDiff > 14) over14Days++;
        else over7Days++;
      }

      anomalies.push({
        type: "PAYMENT_DELAY",
        severity,
        title: "Multiple Payment Delays Detected",
        description: `${overdueInvoices.length} invoices are overdue by more than 7 days, totalling ${formatINR(totalOverdue)} outstanding. Breakdown: ${over30Days} over 30 days, ${over14Days} over 14 days, ${over7Days} over 7 days. Consider escalating collection efforts.`,
        metric: "overdue_invoices_amount",
        expectedValue: 0,
        actualValue: Math.round(totalOverdue),
        deviationPercent: 100, // fully overdue
      });
    }
  } catch (error) {
    console.error("[ANOMALY_DETECTION] Payment delay detection error:", error);
  }

  return anomalies;
}

// ============================================================
// 5. Conversion Rate Drops
// ============================================================

async function detectConversionRateDrops(): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = [];

  try {
    // Current month: leads created and deals won
    const thisMonthStart = startOfMonth(0);
    const thisMonthEnd = endOfMonth(0);

    const currentMonthLeads = await prisma.lead.count({
      where: {
        createdAt: { gte: thisMonthStart, lte: thisMonthEnd },
      },
    });

    const currentMonthDealsWon = await prisma.deal.count({
      where: {
        wonDate: { gte: thisMonthStart, lte: thisMonthEnd },
      },
    });

    const currentRate = currentMonthLeads > 0 ? currentMonthDealsWon / currentMonthLeads : 0;

    // Last 3 months average
    const monthlyRates: number[] = [];
    for (let m = 1; m <= 3; m++) {
      const mStart = startOfMonth(m);
      const mEnd = endOfMonth(m);

      const leads = await prisma.lead.count({
        where: { createdAt: { gte: mStart, lte: mEnd } },
      });

      const dealsWon = await prisma.deal.count({
        where: { wonDate: { gte: mStart, lte: mEnd } },
      });

      if (leads > 0) {
        monthlyRates.push(dealsWon / leads);
      }
    }

    const avgRate =
      monthlyRates.length > 0
        ? monthlyRates.reduce((a, b) => a + b, 0) / monthlyRates.length
        : 0;

    if (avgRate > 0 && currentMonthLeads > 0) {
      const ratio = currentRate / avgRate;
      const deviationPercent = Math.round((ratio - 1) * 100);

      if (ratio < 0.6) {
        anomalies.push({
          type: "CONVERSION_RATE_DROP",
          severity: "HIGH",
          title: "Conversion Rate Drop",
          description: `This month's lead-to-deal conversion rate (${(currentRate * 100).toFixed(1)}%) is ${Math.abs(deviationPercent)}% below the 3-month average (${(avgRate * 100).toFixed(1)}%). Review lead quality, sales processes, and follow-up timelines.`,
          metric: "monthly_conversion_rate",
          expectedValue: Math.round(avgRate * 10000) / 100, // as percentage
          actualValue: Math.round(currentRate * 10000) / 100,
          deviationPercent,
        });
      }
    }
  } catch (error) {
    console.error("[ANOMALY_DETECTION] Conversion rate detection error:", error);
  }

  return anomalies;
}

// ============================================================
// LLM Description Enhancement (optional)
// ============================================================

async function enhanceDescriptionsWithLLM(
  anomalies: DetectedAnomaly[]
): Promise<DetectedAnomaly[]> {
  if (anomalies.length === 0) return anomalies;

  try {
    const summaryData = anomalies
      .map(
        (a) =>
          `[${a.type}] ${a.severity}: ${a.title} - Expected: ${a.expectedValue}, Actual: ${a.actualValue}, Deviation: ${a.deviationPercent}%`
      )
      .join("\n");

    const enhancedText = await chatCompletionWithSystem({
      system: `You are a business analytics AI for an event management CRM. Provide brief, actionable insights for each detected anomaly. Keep each insight to 1-2 sentences. Format as numbered list matching the input order.`,
      user: `The following anomalies were detected in our business metrics. Provide brief actionable recommendations for each:\n\n${summaryData}`,
      temperature: 0.4,
      maxTokens: 1024,
    });

    // If we get a valid response, append recommendations to descriptions
    if (enhancedText && enhancedText !== "AI not configured") {
      const lines = enhancedText.split("\n").filter((l) => l.trim());
      for (let i = 0; i < Math.min(anomalies.length, lines.length); i++) {
        const recommendation = lines[i].replace(/^\d+[\.\)]\s*/, "").trim();
        if (recommendation) {
          anomalies[i].description += `\n\nAI Recommendation: ${recommendation}`;
        }
      }
    }
  } catch (error) {
    // LLM enhancement is optional — don't break detection if it fails
    console.error("[ANOMALY_DETECTION] LLM enhancement failed (non-critical):", error);
  }

  return anomalies;
}

// ============================================================
// Main Detection Function
// ============================================================

export async function detectAnomalies(): Promise<DetectedAnomaly[]> {
  console.log("[ANOMALY_DETECTION] Starting anomaly detection...");

  const results = await Promise.all([
    detectRevenueAnomalies(),
    detectLeadVolumeChanges(),
    detectBookingCancellationClusters(),
    detectPaymentDelays(),
    detectConversionRateDrops(),
  ]);

  let allAnomalies = results.flat();

  console.log(
    `[ANOMALY_DETECTION] Detected ${allAnomalies.length} anomalies before LLM enhancement`
  );

  // Optionally enhance descriptions with LLM (graceful degradation)
  allAnomalies = await enhanceDescriptionsWithLLM(allAnomalies);

  console.log(
    `[ANOMALY_DETECTION] Completed. Total anomalies: ${allAnomalies.length}`
  );

  return allAnomalies;
}
