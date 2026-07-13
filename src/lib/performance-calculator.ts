import { prisma } from "@/lib/prisma";

// ============================================================
// Performance Score Calculator
// ============================================================
// Monthly batch processor that calculates performance scores
// for users and vendors based on ExecutionTask completion data.

interface CalculationResult {
  usersProcessed: number;
  vendorsProcessed: number;
}

// ============================================================
// Main Entry Point
// ============================================================

export async function calculateScoresForPeriod(
  period: string
): Promise<CalculationResult> {
  // Parse period "YYYY-MM" → date range
  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999); // last day of month

  // Fetch all completed tasks in the period with related data
  const completedTasks = await prisma.executionTask.findMany({
    where: {
      status: "COMPLETED",
      actualEnd: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      escalations: { select: { id: true } },
      timeLogs: {
        select: { action: true, timestamp: true, taskId: true, userId: true },
        orderBy: { timestamp: "asc" },
      },
    },
  });

  // Fetch all tasks assigned in the period (for totalTasksAssigned)
  const allAssignedTasks = await prisma.executionTask.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      assigneeId: true,
      vendorId: true,
      status: true,
    },
  });

  const usersProcessed = await calculateUserScores(
    period,
    completedTasks,
    allAssignedTasks,
    startDate,
    endDate
  );

  const vendorsProcessed = await calculateVendorScores(
    period,
    completedTasks,
    allAssignedTasks,
    startDate,
    endDate
  );

  return { usersProcessed, vendorsProcessed };
}

// ============================================================
// User Score Calculation
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function calculateUserScores(
  period: string,
  completedTasks: any[],
  allAssignedTasks: any[],
  _startDate: Date,
  _endDate: Date
): Promise<number> {
  // Group completed tasks by assigneeId
  const userTaskMap = new Map<string, any[]>();
  for (const task of completedTasks) {
    if (!task.assigneeId) continue;
    const existing = userTaskMap.get(task.assigneeId) || [];
    existing.push(task);
    userTaskMap.set(task.assigneeId, existing);
  }

  // Group all assigned tasks by assigneeId for totalTasksAssigned
  const userAssignedMap = new Map<string, number>();
  for (const task of allAssignedTasks) {
    if (!task.assigneeId) continue;
    const count = userAssignedMap.get(task.assigneeId) || 0;
    userAssignedMap.set(task.assigneeId, count + 1);
  }

  // Ensure all users with assigned tasks are included
  for (const userId of userAssignedMap.keys()) {
    if (!userTaskMap.has(userId)) {
      userTaskMap.set(userId, []);
    }
  }

  let processedCount = 0;

  for (const [userId, tasks] of userTaskMap.entries()) {
    const totalTasksCompleted = tasks.length;
    const totalTasksAssigned = userAssignedMap.get(userId) || totalTasksCompleted;

    // On-time rate: tasks completed before or on SLA deadline
    const onTimeTasks = tasks.filter(
      (t: any) => t.slaFinishBy && t.actualEnd && new Date(t.actualEnd) <= new Date(t.slaFinishBy)
    );
    const onTimeRate =
      totalTasksCompleted > 0
        ? (onTimeTasks.length / totalTasksCompleted) * 100
        : 0;

    // Escalation count
    const escalationCount = tasks.reduce(
      (sum: number, t: any) => sum + (t.escalations?.length || 0),
      0
    );

    // Rework count: tasks that were COMPLETED then went back to IN_PROGRESS
    // Detected by checking timeLogs for a "completed" action followed by a "started" action
    let reworkCount = 0;
    for (const task of tasks) {
      const logs = task.timeLogs || [];
      let wasCompleted = false;
      for (const log of logs) {
        if (log.action === "completed") {
          wasCompleted = true;
        } else if (log.action === "started" && wasCompleted) {
          reworkCount++;
          break; // count once per task
        }
      }
    }

    // Quality score: tasks completed without rework or escalations
    const qualityTasks = tasks.filter((t: any) => {
      const hasEscalations = (t.escalations?.length || 0) > 0;
      const logs = t.timeLogs || [];
      let wasCompleted = false;
      let hasRework = false;
      for (const log of logs) {
        if (log.action === "completed") {
          wasCompleted = true;
        } else if (log.action === "started" && wasCompleted) {
          hasRework = true;
          break;
        }
      }
      return !hasEscalations && !hasRework;
    });
    const qualityScore =
      totalTasksCompleted > 0
        ? (qualityTasks.length / totalTasksCompleted) * 100
        : 0;

    // Average response time: from task creation to first "started" timeLog
    const responseTimes: number[] = [];
    for (const task of tasks) {
      const startedLog = (task.timeLogs || []).find(
        (log: any) => log.action === "started"
      );
      if (startedLog && task.createdAt) {
        const diffMs =
          new Date(startedLog.timestamp).getTime() -
          new Date(task.createdAt).getTime();
        const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
        responseTimes.push(diffMinutes);
      }
    }
    const avgResponseMinutes =
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          )
        : 0;

    // Overall score (weighted average)
    const escalationComponent = 100 - Math.min(escalationCount * 10, 100);
    const reworkComponent = 100 - Math.min(reworkCount * 20, 100);
    const completionRate = Math.min(
      (totalTasksCompleted / Math.max(totalTasksAssigned, 1)) * 100,
      100
    );

    const overallScore =
      onTimeRate * 0.3 +
      qualityScore * 0.3 +
      escalationComponent * 0.2 +
      reworkComponent * 0.1 +
      completionRate * 0.1;

    // Upsert performance score using unique constraint [userId, period]
    await prisma.performanceScore.upsert({
      where: {
        userId_period: { userId, period },
      },
      create: {
        userId,
        period,
        onTimeRate: Math.round(onTimeRate * 100) / 100,
        qualityScore: Math.round(qualityScore * 100) / 100,
        reworkCount,
        escalationCount,
        avgResponseMinutes,
        totalTasksCompleted,
        totalTasksAssigned,
        overallScore: Math.round(overallScore * 100) / 100,
      },
      update: {
        onTimeRate: Math.round(onTimeRate * 100) / 100,
        qualityScore: Math.round(qualityScore * 100) / 100,
        reworkCount,
        escalationCount,
        avgResponseMinutes,
        totalTasksCompleted,
        totalTasksAssigned,
        overallScore: Math.round(overallScore * 100) / 100,
      },
    });

    processedCount++;
  }

  return processedCount;
}

// ============================================================
// Vendor Score Calculation
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function calculateVendorScores(
  period: string,
  completedTasks: any[],
  allAssignedTasks: any[],
  _startDate: Date,
  _endDate: Date
): Promise<number> {
  // Group completed tasks by vendorId
  const vendorTaskMap = new Map<string, any[]>();
  for (const task of completedTasks) {
    if (!task.vendorId) continue;
    const existing = vendorTaskMap.get(task.vendorId) || [];
    existing.push(task);
    vendorTaskMap.set(task.vendorId, existing);
  }

  // Group all assigned tasks by vendorId for totalTasksAssigned
  const vendorAssignedMap = new Map<string, number>();
  for (const task of allAssignedTasks) {
    if (!task.vendorId) continue;
    const count = vendorAssignedMap.get(task.vendorId) || 0;
    vendorAssignedMap.set(task.vendorId, count + 1);
  }

  // Ensure all vendors with assigned tasks are included
  for (const vendorId of vendorAssignedMap.keys()) {
    if (!vendorTaskMap.has(vendorId)) {
      vendorTaskMap.set(vendorId, []);
    }
  }

  let processedCount = 0;

  for (const [vendorId, tasks] of vendorTaskMap.entries()) {
    const totalTasksCompleted = tasks.length;
    const totalTasksAssigned = vendorAssignedMap.get(vendorId) || totalTasksCompleted;

    // On-time rate
    const onTimeTasks = tasks.filter(
      (t: any) => t.slaFinishBy && t.actualEnd && new Date(t.actualEnd) <= new Date(t.slaFinishBy)
    );
    const onTimeRate =
      totalTasksCompleted > 0
        ? (onTimeTasks.length / totalTasksCompleted) * 100
        : 0;

    // Escalation count
    const escalationCount = tasks.reduce(
      (sum: number, t: any) => sum + (t.escalations?.length || 0),
      0
    );

    // Rework count
    let reworkCount = 0;
    for (const task of tasks) {
      const logs = task.timeLogs || [];
      let wasCompleted = false;
      for (const log of logs) {
        if (log.action === "completed") {
          wasCompleted = true;
        } else if (log.action === "started" && wasCompleted) {
          reworkCount++;
          break;
        }
      }
    }

    // Quality score
    const qualityTasks = tasks.filter((t: any) => {
      const hasEscalations = (t.escalations?.length || 0) > 0;
      const logs = t.timeLogs || [];
      let wasCompleted = false;
      let hasRework = false;
      for (const log of logs) {
        if (log.action === "completed") {
          wasCompleted = true;
        } else if (log.action === "started" && wasCompleted) {
          hasRework = true;
          break;
        }
      }
      return !hasEscalations && !hasRework;
    });
    const qualityScore =
      totalTasksCompleted > 0
        ? (qualityTasks.length / totalTasksCompleted) * 100
        : 0;

    // Average response time
    const responseTimes: number[] = [];
    for (const task of tasks) {
      const startedLog = (task.timeLogs || []).find(
        (log: any) => log.action === "started"
      );
      if (startedLog && task.createdAt) {
        const diffMs =
          new Date(startedLog.timestamp).getTime() -
          new Date(task.createdAt).getTime();
        const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
        responseTimes.push(diffMinutes);
      }
    }
    const avgResponseMinutes =
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          )
        : 0;

    // Overall score (weighted average)
    const escalationComponent = 100 - Math.min(escalationCount * 10, 100);
    const reworkComponent = 100 - Math.min(reworkCount * 20, 100);
    const completionRate = Math.min(
      (totalTasksCompleted / Math.max(totalTasksAssigned, 1)) * 100,
      100
    );

    const overallScore =
      onTimeRate * 0.3 +
      qualityScore * 0.3 +
      escalationComponent * 0.2 +
      reworkComponent * 0.1 +
      completionRate * 0.1;

    // Upsert performance score using unique constraint [vendorId, period]
    await prisma.performanceScore.upsert({
      where: {
        vendorId_period: { vendorId, period },
      },
      create: {
        vendorId,
        period,
        onTimeRate: Math.round(onTimeRate * 100) / 100,
        qualityScore: Math.round(qualityScore * 100) / 100,
        reworkCount,
        escalationCount,
        avgResponseMinutes,
        totalTasksCompleted,
        totalTasksAssigned,
        overallScore: Math.round(overallScore * 100) / 100,
      },
      update: {
        onTimeRate: Math.round(onTimeRate * 100) / 100,
        qualityScore: Math.round(qualityScore * 100) / 100,
        reworkCount,
        escalationCount,
        avgResponseMinutes,
        totalTasksCompleted,
        totalTasksAssigned,
        overallScore: Math.round(overallScore * 100) / 100,
      },
    });

    // Also persist the rolling quality score onto the Vendor row so the
    // vendor list/detail UI has a live value (best-effort, non-throwing).
    await prisma.vendor
      .update({
        where: { id: vendorId },
        data: {
          qualityScore: Math.max(0, Math.min(100, Math.round(qualityScore))),
        },
      })
      .catch(() => {});

    processedCount++;
  }

  return processedCount;
}
