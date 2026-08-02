"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlayIcon,
  Loader2Icon,
  MailIcon,
  ClipboardListIcon,
  BellIcon,
  RefreshCwIcon,
} from "lucide-react";

import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  WORKFLOW_TRIGGER_LABELS,
  WORKFLOW_LOG_STATUS_COLORS,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import {
  executeWorkflow,
  toggleWorkflow,
} from "@/actions/workflow.actions";

// ============================================================
// Types
// ============================================================

interface WorkflowLog {
  id: string;
  action: string;
  status: string;
  executedAt: string;
  error: string | null;
  bookingId: string | null;
  contactId: string | null;
}

interface WorkflowData {
  id: string;
  name: string;
  trigger: string;
  actions: Array<{ type: string; config: Record<string, unknown> }>;
  isActive: boolean;
  delayMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  logs: WorkflowLog[];
  _count: {
    logs: number;
  };
}

interface WorkflowDetailProps {
  workflow: WorkflowData;
}

// ============================================================
// Action Type Labels & Icons
// ============================================================

const ACTION_TYPE_LABELS: Record<string, string> = {
  SEND_EMAIL: "Send Email",
  CREATE_TASK: "Create Task",
  SEND_NOTIFICATION: "Send Notification",
  UPDATE_STATUS: "Update Status",
};

const ACTION_TYPE_ICONS: Record<string, React.ReactNode> = {
  SEND_EMAIL: <MailIcon className="size-4" />,
  CREATE_TASK: <ClipboardListIcon className="size-4" />,
  SEND_NOTIFICATION: <BellIcon className="size-4" />,
  UPDATE_STATUS: <RefreshCwIcon className="size-4" />,
};

// ============================================================
// WorkflowDetail Component
// ============================================================

export function WorkflowDetail({ workflow }: WorkflowDetailProps) {
  const router = useRouter();
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [isToggling, setIsToggling] = React.useState(false);

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      const result = await executeWorkflow(workflow.id);
      if (result.success) {
        const { executed, succeeded, failed } = result.data;
        if (failed > 0) {
          toast.warning(
            `Workflow ran: ${succeeded}/${executed} action(s) ok, ${failed} failed`
          );
        } else {
          toast.success(`Workflow executed — ${executed} action(s) succeeded`);
        }
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to execute workflow");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleToggle = async () => {
    setIsToggling(true);
    try {
      const result = await toggleWorkflow(workflow.id);
      if (result.success) {
        toast.success(
          result.data.isActive
            ? "Workflow activated"
            : "Workflow deactivated"
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to toggle workflow");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workflow Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border bg-card shadow-card">
          <div className="border-b px-5 py-4">
            <h3 className="text-copy font-semibold tracking-[-0.01em]">
              Configuration
            </h3>
            <p className="mt-1 text-body text-muted-foreground">
              When this workflow fires and how it has behaved so far.
            </p>
          </div>
          <div className="divide-y">
            <div className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">Status</p>
                <p className="mt-0.5 text-detail text-muted-foreground">
                  {workflow.isActive
                    ? "Running — the trigger is live."
                    : "Paused — the trigger is ignored."}
                </p>
              </div>
              <Switch
                checked={workflow.isActive}
                onCheckedChange={handleToggle}
                disabled={isToggling}
                aria-label="Workflow active"
              />
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-3.5">
              <p className="text-sm font-medium">Trigger</p>
              <StatusPill
                label={
                  WORKFLOW_TRIGGER_LABELS[workflow.trigger] ?? workflow.trigger
                }
                hue="violet"
                size="xs"
              />
            </div>
            {workflow.delayMinutes !== null && workflow.delayMinutes > 0 && (
              <div className="flex items-center justify-between gap-4 px-5 py-3.5">
                <p className="text-sm font-medium">Delay</p>
                <span className="numeric text-sm">
                  {workflow.delayMinutes} min
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 px-5 py-3.5">
              <p className="text-sm font-medium">Created</p>
              <span className="numeric text-sm text-muted-foreground">
                {formatDate(workflow.createdAt)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-3.5">
              <p className="text-sm font-medium">Total runs</p>
              <span className="numeric text-sm font-medium">
                {workflow._count.logs}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card shadow-card">
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <h3 className="text-copy font-semibold tracking-[-0.01em]">
                Actions
              </h3>
              <p className="mt-1 text-body text-muted-foreground">
                Run top to bottom every time the trigger fires.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleExecute}
              disabled={isExecuting || !workflow.isActive}
            >
              {isExecuting ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              ) : (
                <PlayIcon className="mr-2 size-4" />
              )}
              Run Now
            </Button>
          </div>
          {workflow.actions.length === 0 ? (
            <EmptyState
              icon={<RefreshCwIcon />}
              title="No actions configured"
              description="This workflow fires but does nothing. Edit it to add at least one action."
            />
          ) : (
            <div className="divide-y">
              {workflow.actions.map((action, index) => (
                <div key={index} className="flex items-start gap-3 px-5 py-3.5">
                  <span
                    className="numeric mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {ACTION_TYPE_ICONS[action.type] ?? (
                      <RefreshCwIcon className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {ACTION_TYPE_LABELS[action.type] ?? action.type}
                    </p>
                    <div className="mt-0.5 text-detail text-muted-foreground">
                      {action.type === "SEND_EMAIL" && (
                        <span>
                          Template {String(action.config.template || "--")} · to{" "}
                          {String(action.config.to || "--")}
                        </span>
                      )}
                      {action.type === "CREATE_TASK" && (
                        <span>Title: {String(action.config.title || "--")}</span>
                      )}
                      {action.type === "SEND_NOTIFICATION" && (
                        <span>
                          Message: {String(action.config.message || "--")}
                        </span>
                      )}
                      {action.type === "UPDATE_STATUS" && (
                        <span>
                          Sets status to {String(action.config.status || "--")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Execution Logs */}
      <section className="rounded-2xl border bg-card shadow-card">
        <div className="border-b px-5 py-4">
          <h3 className="text-copy font-semibold tracking-[-0.01em]">
            Execution Log
          </h3>
          <p className="mt-1 text-body text-muted-foreground">
            Every run this workflow has made, newest first.
          </p>
        </div>
        {workflow.logs.length === 0 ? (
          <EmptyState
            icon={<PlayIcon />}
            title="No runs yet"
            description="This workflow hasn't fired since it was created. Hit Run Now to test it against live data."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-meta uppercase tracking-wide text-muted-foreground">
                    Date
                  </TableHead>
                  <TableHead className="text-meta uppercase tracking-wide text-muted-foreground">
                    Action
                  </TableHead>
                  <TableHead className="text-meta uppercase tracking-wide text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-meta uppercase tracking-wide text-muted-foreground">
                    Booking
                  </TableHead>
                  <TableHead className="text-meta uppercase tracking-wide text-muted-foreground">
                    Error
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflow.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="numeric whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(log.executedAt)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {ACTION_TYPE_LABELS[log.action] ?? log.action}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={log.status}
                        colorMap={WORKFLOW_LOG_STATUS_COLORS}
                      />
                    </TableCell>
                    <TableCell className="numeric text-sm text-muted-foreground">
                      {log.bookingId ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-destructive">
                      {log.error ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
