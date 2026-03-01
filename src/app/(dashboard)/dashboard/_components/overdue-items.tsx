"use client";

import { differenceInDays, format } from "date-fns";
import {
  AlertTriangle,
  CircleAlert,
  FileText,
  CheckSquare,
  User,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  OverduePayment,
  OverdueTask,
} from "@/actions/dashboard.actions";
import type { Serialized } from "@/lib/utils";

// ============================================================
// Types
// ============================================================

interface OverdueItemsProps {
  tasks: Serialized<OverdueTask>[];
  payments: Serialized<OverduePayment>[];
}

// ============================================================
// Priority colors
// ============================================================

const PRIORITY_DOT: Record<string, string> = {
  LOW: "bg-slate-400",
  MEDIUM: "bg-blue-500",
  HIGH: "bg-orange-500",
  URGENT: "bg-red-600",
};

// ============================================================
// Currency helper
// ============================================================

function formatCurrency(amount: number | { toNumber?: () => number }): string {
  const num = typeof amount === "number" ? amount : Number(amount);
  return `\u20B9${num.toLocaleString("en-IN")}`;
}

// ============================================================
// Overdue Items Component
// ============================================================

export function OverdueItems({ tasks, payments }: OverdueItemsProps) {
  const hasItems = tasks.length > 0 || payments.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">
            Overdue Items
          </CardTitle>
          {hasItems && (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 text-[10px] px-1.5 py-0">
              {tasks.length + payments.length}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Tasks and payments past due date</p>
      </CardHeader>
      <CardContent>
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/60">
            <CircleAlert className="mb-2 size-8" />
            <p className="text-sm font-medium">All caught up!</p>
            <p className="text-xs">No overdue items</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Overdue Tasks */}
            {tasks.map((task) => {
              const daysOverdue = differenceInDays(
                new Date(),
                new Date(task.dueDate!)
              );
              return (
                <div
                  key={task.id}
                  className="group flex items-start gap-3 rounded-xl p-3 transition-all duration-200 hover:bg-red-50/50 dark:hover:bg-red-950/20"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-100 to-red-200/50 dark:from-red-900/40 dark:to-red-800/20 transition-transform duration-200 group-hover:scale-105">
                    <CheckSquare className="size-3.5 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          PRIORITY_DOT[task.priority] || "bg-slate-400"
                        )}
                      />
                      <p className="truncate text-sm font-medium text-foreground">
                        {task.title}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground/70">
                      {task.assignee?.name && (
                        <span className="flex items-center gap-1">
                          <User className="size-3" />
                          {task.assignee.name}
                        </span>
                      )}
                      <span>
                        Due: {format(new Date(task.dueDate!), "MMM d")}
                      </span>
                    </div>
                  </div>
                  <Badge className="shrink-0 bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 text-[10px] px-1.5 py-0">
                    {daysOverdue}d overdue
                  </Badge>
                </div>
              );
            })}

            {/* Overdue Payments */}
            {payments.map((payment) => {
              const daysOverdue = differenceInDays(
                new Date(),
                new Date(payment.dueDate)
              );
              return (
                <div
                  key={payment.id}
                  className="group flex items-start gap-3 rounded-xl p-3 transition-all duration-200 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-amber-200/50 dark:from-amber-900/40 dark:to-amber-800/20 transition-transform duration-200 group-hover:scale-105">
                    <FileText className="size-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {payment.invoiceNumber}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground/70">
                      <span>
                        {payment.contact.firstName} {payment.contact.lastName}
                      </span>
                      <span>&middot;</span>
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {formatCurrency(payment.balanceDue)}
                      </span>
                    </div>
                  </div>
                  <Badge className="shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 text-[10px] px-1.5 py-0">
                    {daysOverdue}d overdue
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
