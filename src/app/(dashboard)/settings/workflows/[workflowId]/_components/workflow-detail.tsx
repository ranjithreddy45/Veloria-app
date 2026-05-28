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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={workflow.isActive}
                  onCheckedChange={handleToggle}
                  disabled={isToggling}
                />
                <span className="text-sm">
                  {workflow.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Trigger</span>
              <Badge variant="secondary">
                {WORKFLOW_TRIGGER_LABELS[workflow.trigger] ?? workflow.trigger}
              </Badge>
            </div>
            {workflow.delayMinutes !== null && workflow.delayMinutes > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Delay</span>
                <span className="text-sm">{workflow.delayMinutes} minutes</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm">{formatDate(workflow.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Runs</span>
              <span className="text-sm">{workflow._count.logs}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Actions ({workflow.actions.length})</CardTitle>
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
          </CardHeader>
          <CardContent className="space-y-3">
            {workflow.actions.map((action, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-md border p-3"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  {ACTION_TYPE_ICONS[action.type] ?? (
                    <RefreshCwIcon className="size-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {ACTION_TYPE_LABELS[action.type] ?? action.type}
                  </p>
                  <div className="text-xs text-muted-foreground mt-1">
                    {action.type === "SEND_EMAIL" && (
                      <span>
                        Template: {String(action.config.template || "--")} |
                        To: {String(action.config.to || "--")}
                      </span>
                    )}
                    {action.type === "CREATE_TASK" && (
                      <span>
                        Title: {String(action.config.title || "--")}
                      </span>
                    )}
                    {action.type === "SEND_NOTIFICATION" && (
                      <span>
                        Message: {String(action.config.message || "--")}
                      </span>
                    )}
                    {action.type === "UPDATE_STATUS" && (
                      <span>
                        Status: {String(action.config.status || "--")}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  #{index + 1}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Execution Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Execution Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {workflow.logs.length === 0 ? (
            <p className="text-muted-foreground text-center text-sm py-8">
              No execution logs yet. Use the &quot;Run Now&quot; button to test
              this workflow.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workflow.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatDate(log.executedAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ACTION_TYPE_LABELS[log.action] ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={log.status}
                          colorMap={WORKFLOW_LOG_STATUS_COLORS}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {log.bookingId ?? "--"}
                      </TableCell>
                      <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                        {log.error ?? "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
