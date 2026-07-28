"use client";

import { differenceInDays, format } from "date-fns";
import {
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
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatINR } from "@/lib/utils";
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
// Overdue Items Component
// ============================================================

export function OverdueItems({ tasks, payments }: OverdueItemsProps) {
  const hasItems = tasks.length > 0 || payments.length > 0;

  return (
    <Card className="card-hover-tint rounded-2xl border bg-card shadow-card transition-shadow hover:shadow-card-hover">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Overdue
            </CardTitle>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Tasks and payments past due
            </p>
          </div>
          {hasItems && (
            <Badge
              variant="outline"
              className="numeric border-destructive/30 bg-destructive/5 px-1.5 py-0 text-[11px] font-medium text-destructive"
            >
              {tasks.length + payments.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasItems ? (
          <EmptyState
            icon={<CircleAlert />}
            tone="success"
            title="All caught up"
            description="No tasks or payments are past due right now."
            className="py-12"
          />
        ) : (
          <div className="divide-y divide-border">
            {/* Overdue Tasks */}
            {tasks.map((task) => {
              const daysOverdue = differenceInDays(
                new Date(),
                new Date(task.dueDate as string)
              );
              return (
                <div
                  key={task.id}
                  className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors first:pt-2 last:pb-2 hover:bg-muted/40"
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <CheckSquare className="size-3.5 text-muted-foreground" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          PRIORITY_DOT[task.priority] || "bg-slate-400"
                        )}
                      />
                      <p className="truncate text-[13.5px] font-medium leading-tight text-foreground">
                        {task.title}
                      </p>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                      {task.assignee?.name && (
                        <span className="inline-flex items-center gap-1">
                          <User className="size-3" />
                          {task.assignee.name}
                        </span>
                      )}
                      <span>
                        Due {format(new Date(task.dueDate as string), "MMM d")}
                      </span>
                    </div>
                  </div>
                  <span className="numeric shrink-0 text-[11px] font-medium text-destructive">
                    {daysOverdue}d
                  </span>
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
                  className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors first:pt-2 last:pb-2 hover:bg-muted/40"
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <FileText className="size-3.5 text-muted-foreground" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="numeric truncate text-[13px] font-medium leading-tight text-foreground">
                      {payment.invoiceNumber}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                      <span>
                        {payment.contact.firstName} {payment.contact.lastName}
                      </span>
                      <span>·</span>
                      <span className="numeric font-medium text-foreground/80">
                        {formatINR(payment.balanceDue)}
                      </span>
                    </div>
                  </div>
                  <span className="numeric shrink-0 text-[11px] font-medium text-warning">
                    {daysOverdue}d
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
