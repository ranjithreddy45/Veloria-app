"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  CalendarCheck,
  IndianRupee,
  CheckCircle,
  Clock,
  Users,
  Loader2,
} from "lucide-react";
import {
  getDailyOperationsSummary,
  getTaskCompletionReport,
  type DateRange,
  type DailyOperationsSummaryData,
  type TaskCompletionReportData,
} from "@/actions/report.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ReportExportButton } from "./report-export-button";

// ============================================================
// Helpers
// ============================================================

function formatINR(value: number): string {
  if (value >= 10000000) return `\u20B9${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `\u20B9${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `\u20B9${(value / 1000).toFixed(0)}K`;
  return `\u20B9${value.toLocaleString("en-IN")}`;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ============================================================
// Component
// ============================================================

interface OperationsReportsProps {
  range: DateRange;
}

export function OperationsReports({ range }: OperationsReportsProps) {
  const [selectedDate, setSelectedDate] = React.useState<string>(formatDate(new Date()));
  const [dailyData, setDailyData] = React.useState<DailyOperationsSummaryData | null>(null);
  const [dailyLoading, setDailyLoading] = React.useState(true);
  const [taskData, setTaskData] = React.useState<TaskCompletionReportData | null>(null);
  const [taskLoading, setTaskLoading] = React.useState(true);

  // Fetch daily ops on date change
  React.useEffect(() => {
    setDailyLoading(true);
    getDailyOperationsSummary(new Date(selectedDate)).then((res) => {
      if (res.success) setDailyData(res.data);
      setDailyLoading(false);
    });
  }, [selectedDate]);

  // Fetch task completion on range change
  React.useEffect(() => {
    setTaskLoading(true);
    getTaskCompletionReport(range).then((res) => {
      if (res.success) setTaskData(res.data);
      setTaskLoading(false);
    });
  }, [range]);

  const taskChartConfig: ChartConfig = {
    completionRate: { label: "Completion Rate", color: "hsl(142, 71%, 45%)" },
  };

  return (
    <div className="space-y-6">
      {/* Card 1: Daily Operations Summary */}
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Daily Operations Summary</CardTitle>
              <p className="text-xs text-zinc-500">Overview for a selected day</p>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          {dailyLoading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500">
              <Loader2 className="mr-2 size-5 animate-spin" /> Loading daily summary...
            </div>
          ) : dailyData ? (
            <div className="space-y-4">
              {/* KPI Grid 2x3 */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100">
                    <CalendarCheck className="size-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Bookings Today</p>
                    <p className="text-lg font-bold">{dailyData.bookingsToday}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100">
                    <IndianRupee className="size-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Payments Collected</p>
                    <p className="text-lg font-bold">{formatINR(dailyData.paymentsCollected)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-green-100">
                    <CheckCircle className="size-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Tasks Completed</p>
                    <p className="text-lg font-bold">{dailyData.tasksCompleted}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-amber-100">
                    <Clock className="size-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Tasks Pending</p>
                    <p className="text-lg font-bold">{dailyData.tasksPending}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-zinc-100 p-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-violet-100">
                    <Users className="size-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Staff On Duty</p>
                    <p className="text-lg font-bold">{dailyData.staffOnDuty}</p>
                  </div>
                </div>
              </div>

              {/* Upcoming Events */}
              {dailyData.upcomingEvents.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Events for this Day
                  </h4>
                  <div className="space-y-2">
                    {dailyData.upcomingEvents.map((event, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{event.name}</p>
                          <p className="text-xs text-zinc-500">{event.venue}</p>
                        </div>
                        <span className="text-sm font-medium text-indigo-600">{event.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dailyData.upcomingEvents.length === 0 && (
                <p className="py-4 text-center text-sm text-zinc-400">No events scheduled for this day</p>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-400">No data available</p>
          )}
        </CardContent>
      </Card>

      {/* Card 2: Task Completion by Assignee */}
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Task Completion by Assignee</CardTitle>
              <p className="text-xs text-zinc-500">Performance metrics per team member</p>
            </div>
            {taskData && (
              <ReportExportButton
                data={taskData.assignees as unknown as Record<string, unknown>[]}
                columns={[
                  { key: "name", label: "Assignee Name" },
                  { key: "total", label: "Total Tasks" },
                  { key: "completed", label: "Completed" },
                  { key: "pending", label: "Pending" },
                  { key: "overdue", label: "Overdue" },
                  { key: "completionRate", label: "Completion Rate %" },
                ]}
                filename="task-completion"
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          {taskLoading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500">
              <Loader2 className="mr-2 size-5 animate-spin" /> Loading task data...
            </div>
          ) : taskData ? (
            <div className="space-y-4">
              {/* KPI: Overall Completion Rate */}
              <div className="flex items-center gap-3 rounded-lg bg-green-50 p-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-green-100">
                  <CheckCircle className="size-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-green-600">Overall Completion Rate</p>
                  <p className="text-xl font-bold text-green-700">{taskData.overall.completionRate}%</p>
                  <p className="text-xs text-green-500">
                    {taskData.overall.completed} of {taskData.overall.total} tasks completed
                  </p>
                </div>
              </div>

              {/* Charts Row: Task Status Pie + Stacked Assignee Bar */}
              {taskData.assignees.length > 0 && (() => {
                const totalCompleted = taskData.assignees.reduce((s, a) => s + a.completed, 0);
                const totalPending = taskData.assignees.reduce((s, a) => s + a.pending, 0);
                const totalOverdue = taskData.assignees.reduce((s, a) => s + a.overdue, 0);
                const taskStatusData = [
                  { name: "Completed", value: totalCompleted, fill: "hsl(142, 71%, 45%)" },
                  { name: "Pending", value: totalPending, fill: "hsl(38, 92%, 50%)" },
                  { name: "Overdue", value: totalOverdue, fill: "hsl(0, 84%, 60%)" },
                ].filter((d) => d.value > 0);

                return (
                  <div className="grid gap-6 lg:grid-cols-12">
                    {/* Task Status Overview Pie */}
                    <div className="lg:col-span-4">
                      <p className="mb-2 text-xs font-medium text-zinc-500 text-center">Task Status Overview</p>
                      <ChartContainer
                        config={taskStatusData.reduce((acc, s) => {
                          acc[s.name] = { label: s.name, color: s.fill };
                          return acc;
                        }, {} as Record<string, { label: string; color: string }>)}
                        className="mx-auto h-[200px] w-full"
                      >
                        <PieChart>
                          <Tooltip content={<ChartTooltipContent hideLabel />} />
                          <Pie data={taskStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" nameKey="name" stroke="white" strokeWidth={2}>
                            {taskStatusData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                        {taskStatusData.map((s) => (
                          <div key={s.name} className="flex items-center gap-1.5">
                            <div className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.fill }} />
                            <span className="text-meta text-zinc-600">{s.name}: {s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stacked Bar: Completed / Pending / Overdue per Assignee */}
                    <div className="lg:col-span-8">
                      <p className="mb-2 text-xs font-medium text-zinc-500 text-center">Tasks by Assignee (Completed / Pending / Overdue)</p>
                      <ChartContainer
                        config={{
                          completed: { label: "Completed", color: "hsl(142, 71%, 45%)" },
                          pending: { label: "Pending", color: "hsl(38, 92%, 50%)" },
                          overdue: { label: "Overdue", color: "hsl(0, 84%, 60%)" },
                        }}
                        className="h-[250px] w-full"
                      >
                        <BarChart
                          data={taskData.assignees}
                          layout="vertical"
                          margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(240, 5%, 92%)" />
                          <XAxis type="number" allowDecimals={false} fontSize={12} />
                          <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="completed" stackId="tasks" fill="hsl(142, 71%, 45%)" />
                          <Bar dataKey="pending" stackId="tasks" fill="hsl(38, 92%, 50%)" />
                          <Bar dataKey="overdue" stackId="tasks" fill="hsl(0, 84%, 60%)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ChartContainer>
                    </div>
                  </div>
                );
              })()}

              {/* Table */}
              {taskData.assignees.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-left">
                        <th className="pb-2 pr-4 font-medium text-zinc-500">Assignee Name</th>
                        <th className="pb-2 pr-4 font-medium text-zinc-500 text-right">Total</th>
                        <th className="pb-2 pr-4 font-medium text-zinc-500 text-right">Completed</th>
                        <th className="pb-2 pr-4 font-medium text-zinc-500 text-right">Pending</th>
                        <th className="pb-2 pr-4 font-medium text-zinc-500 text-right">Overdue</th>
                        <th className="pb-2 font-medium text-zinc-500 text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taskData.assignees.map((assignee) => (
                        <tr key={assignee.name} className="border-b border-zinc-100">
                          <td className="py-2.5 pr-4 font-medium">{assignee.name}</td>
                          <td className="py-2.5 pr-4 text-right">{assignee.total}</td>
                          <td className="py-2.5 pr-4 text-right text-green-700">{assignee.completed}</td>
                          <td className="py-2.5 pr-4 text-right text-amber-700">{assignee.pending}</td>
                          <td className="py-2.5 pr-4 text-right text-red-700">{assignee.overdue}</td>
                          <td className="py-2.5 text-right font-medium">{assignee.completionRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-zinc-400">No task data</p>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-400">No data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
