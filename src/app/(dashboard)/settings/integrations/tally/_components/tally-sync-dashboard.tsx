"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { ACCOUNTING_SYNC_STATUS_COLORS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { triggerSync, retryFailedSync, clearSyncLogs } from "@/actions/accounting.actions";
import { toast } from "sonner";

interface SyncStats {
  pending: number;
  synced: number;
  failed: number;
}

interface SyncLog {
  id: string;
  type: string;
  entityId: string;
  status: string;
  externalRef: string | null;
  error: string | null;
  syncedAt: string | null;
  createdAt: string;
}

interface TallySyncDashboardProps {
  initialStats: SyncStats;
  initialLogs: SyncLog[];
}

export function TallySyncDashboard({
  initialStats,
  initialLogs,
}: TallySyncDashboardProps) {
  const [stats, setStats] = useState(initialStats);
  const [logs, setLogs] = useState(initialLogs);
  const [isPending, startTransition] = useTransition();

  function handleSyncAll() {
    startTransition(async () => {
      // Placeholder: trigger a test sync for each type
      const types = ["INVOICE", "PAYMENT", "PAYOUT"] as const;
      for (const type of types) {
        const result = await triggerSync({
          type,
          entityId: `test-${type.toLowerCase()}-${Date.now()}`,
        });
        if (!result.success) {
          toast.error(result.error);
          return;
        }
      }
      toast.success("All pending items synced (placeholder)");
      // Refresh stats by incrementing synced count
      setStats((prev) => ({
        ...prev,
        synced: prev.synced + 3,
      }));
      // Refresh page to get latest logs
      window.location.reload();
    });
  }

  function handleRetry(logId: string) {
    startTransition(async () => {
      const result = await retryFailedSync(logId);
      if (result.success) {
        toast.success("Sync retried successfully");
        setLogs((prev) =>
          prev.map((l) =>
            l.id === logId
              ? { ...l, status: "SYNCED", error: null, syncedAt: new Date().toISOString() }
              : l
          )
        );
        setStats((prev) => ({
          ...prev,
          failed: Math.max(0, prev.failed - 1),
          synced: prev.synced + 1,
        }));
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleClearOld() {
    startTransition(async () => {
      const result = await clearSyncLogs();
      if (result.success) {
        toast.success(`Cleared ${result.data.deletedCount} old log(s)`);
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  const totalSynced = stats.synced;
  const totalPending = stats.pending;
  const totalFailed = stats.failed;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalSynced}</p>
              <p className="text-xs text-muted-foreground">Synced</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-lg bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalPending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex size-11 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalFailed}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSyncAll} disabled={isPending}>
          <RefreshCw className={`mr-2 size-4 ${isPending ? "animate-spin" : ""}`} />
          Sync All Pending
        </Button>
        <Button variant="outline" onClick={handleClearOld} disabled={isPending}>
          <Trash2 className="mr-2 size-4" />
          Clear Old Logs
        </Button>
      </div>

      {/* Sync Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Sync Logs</CardTitle>
          <CardDescription>
            View the history of accounting sync operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No sync logs yet. Trigger a sync to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>External Ref</TableHead>
                    <TableHead>Synced At</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.type}</TableCell>
                      <TableCell className="max-w-[160px] truncate font-mono text-xs">
                        {log.entityId}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            ACCOUNTING_SYNC_STATUS_COLORS[log.status] ?? ""
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.externalRef ?? "--"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.syncedAt ? formatDate(log.syncedAt) : "--"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-red-600">
                        {log.error ?? "--"}
                      </TableCell>
                      <TableCell>
                        {log.status === "FAILED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(log.id)}
                            disabled={isPending}
                          >
                            <RefreshCw className="size-3.5" />
                          </Button>
                        )}
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
